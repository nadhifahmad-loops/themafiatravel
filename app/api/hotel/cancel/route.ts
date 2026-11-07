import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { getOrbisHotelBookingIdentifiers } from '@/lib/orbis-hotel-payload';
import { bookingStore } from '@/lib/store';
import { settleRefundAfterCancel } from '@/lib/refund';
import { extractVendorRefundAmount } from '@/lib/refund-amount';
import { canManageBooking } from '@/lib/booking-access';
import { resolveHotelApiError } from '@/lib/hotel-errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!isRecord(parsed)) throw new Error('Invalid request body');
    body = parsed;
  } catch {
    return NextResponse.json({ success: false, error: 'Request body tidak valid.' }, { status: 400 });
  }

  if (typeof body.order_number !== 'string' || !body.order_number.trim()) {
    return NextResponse.json({ success: false, error: 'order_number wajib diisi.' }, { status: 400 });
  }

  const booking = await bookingStore.findByOrderNumber(body.order_number.trim());
  if (!booking || booking.bookingType !== 'hotel') {
    return NextResponse.json({ success: false, error: 'Booking hotel tidak ditemukan.' }, { status: 404 });
  }

  const user = session.user as { id?: string; email?: string; role?: string };
  if (!canManageBooking(booking, {
    sessionUserId: user.id ?? null,
    sessionEmail: user.email ?? null,
    isAdmin: user.role === 'admin',
    bookerEmail: typeof body.booker_email === 'string' ? body.booker_email : undefined,
  })) {
    return NextResponse.json({ success: false, error: 'Akses tidak diizinkan.' }, { status: 403 });
  }

  const checkOnly = body.check_only === true;
  const isPending = booking.status === 'pending_payment';
  const isPaid = ['paid', 'issued'].includes(booking.status);
  if (checkOnly && !isPaid) {
    return NextResponse.json(
      { success: false, error: 'Estimasi refund hotel hanya tersedia untuk booking yang sudah dibayar/issued.' },
      { status: 400 }
    );
  }
  if (!checkOnly && !isPending && !isPaid) {
    return NextResponse.json(
      { success: false, error: `Status booking tidak mendukung pembatalan: ${booking.status}.` },
      { status: 400 }
    );
  }

  const identifiers = getOrbisHotelBookingIdentifiers(
    booking.bookingData,
    booking.provider || '',
    booking.pnr || '',
  );
  const issuedName = identifiers.issuedName || booking.pnr?.trim();
  const provider = booking.provider?.trim() || identifiers.provider;
  if (!issuedName || !provider) {
    return NextResponse.json(
      { success: false, error: 'Data issued_name/provider hotel tidak lengkap pada booking.' },
      { status: 422 }
    );
  }

  try {
    if (checkOnly) {
      const quote: unknown = await hotelAPI.checkRefundAmount(booking.orderNumber, issuedName, provider);
      const amount = extractVendorRefundAmount(quote);
      if (amount === null) {
        console.error('[Hotel Refund Quote] Vendor response tidak memuat nominal refund.');
        return NextResponse.json(
          { success: false, error: 'Vendor tidak mengembalikan nominal refund yang valid. Hubungi customer service.' },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        data: quote,
        refundAmount: amount,
        identifiers: { issued_name: issuedName },
      });
    }

    let quotedAmount: number | null = null;
    if (isPaid) {
      const expectedAmount = body.expected_refund_amount;
      if (typeof expectedAmount !== 'number' || !Number.isFinite(expectedAmount) || expectedAmount < 0) {
        return NextResponse.json(
          { success: false, error: 'Periksa estimasi refund hotel sebelum mengonfirmasi pembatalan.' },
          { status: 409 }
        );
      }

      const quote: unknown = await hotelAPI.checkRefundAmount(booking.orderNumber, issuedName, provider);
      quotedAmount = extractVendorRefundAmount(quote);
      if (quotedAmount === null) {
        return NextResponse.json(
          { success: false, error: 'Vendor tidak mengembalikan nominal refund yang valid. Pembatalan tidak dilanjutkan.' },
          { status: 502 }
        );
      }
      if (Math.abs(quotedAmount - expectedAmount) > 0.5) {
        return NextResponse.json(
          {
            success: false,
            error: 'Estimasi refund berubah. Periksa kembali kebijakan dan nominal terbaru sebelum melanjutkan.',
            quoteChanged: true,
            data: quote,
            refundAmount: quotedAmount,
          },
          { status: 409 }
        );
      }
    }

    const cancelResult: unknown = await hotelAPI.cancelBooking(booking.orderNumber, issuedName, provider);
    if (isPending) {
      try {
        await bookingStore.cancelBooking(booking.id, {
          reason: 'Dibatalkan oleh pengguna',
          cancelType: 'void',
        });
      } catch (syncError: unknown) {
        // Vendor sudah membatalkan. Jangan mengembalikan error yang membuat
        // pengguna menekan tombol batal lagi; minta rekonsiliasi admin.
        console.error('[Hotel Cancel] Vendor void sukses, sinkronisasi lokal gagal:', syncError);
        return NextResponse.json({
          success: true,
          data: cancelResult,
          cancel_type: 'void',
          refund_mode: 'void',
          refund_amount: null,
          warning:
            'Pembatalan di vendor berhasil, tetapi status lokal belum tersinkron. Jangan ulangi pembatalan; hubungi customer service dengan nomor pesanan ini.',
          needs_reconciliation: true,
        });
      }
      return NextResponse.json({
        success: true,
        data: cancelResult,
        cancel_type: 'void',
        refund_mode: 'void',
        refund_amount: null,
        identifiers: { issued_name: issuedName },
      });
    }

    const vendorAmount = extractVendorRefundAmount(cancelResult) ?? quotedAmount;
    try {
      const settle = await settleRefundAfterCancel(
        booking,
        typeof body.reason === 'string' ? body.reason : 'Refund booking hotel',
        vendorAmount
      );
      console.log('[Hotel Cancel] Refund settle | mode:', settle.mode, '| amount:', settle.amount);

      return NextResponse.json({
        success: true,
        data: cancelResult,
        cancel_type: 'refund',
        refund_mode: settle.mode,
        refund_amount: settle.amount,
        identifiers: { issued_name: issuedName },
      });
    } catch (syncError: unknown) {
      // Pembatalan vendor sudah final. Jika pencatatan refund lokal gagal,
      // tetap tampilkan keberhasilan pembatalan + peringatan rekonsiliasi.
      console.error('[Hotel Cancel] Vendor cancel sukses, refund lokal gagal:', syncError);
      return NextResponse.json({
        success: true,
        data: cancelResult,
        cancel_type: 'refund',
        refund_mode: 'manual',
        refund_amount: vendorAmount,
        warning:
          'Pembatalan di vendor berhasil, tetapi permintaan refund belum tersinkron ke antrean admin. Jangan ulangi pembatalan; hubungi customer service dengan nomor pesanan ini.',
        needs_reconciliation: true,
        identifiers: { issued_name: issuedName },
      });
    }
  } catch (error: unknown) {
    const resolved = resolveHotelApiError(error, 'Gagal memproses pembatalan hotel. Silakan coba lagi.');
    console.error('[HOTEL CANCEL ERROR]', resolved.orbisCode, error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: resolved.message, code: resolved.code },
      { status: resolved.status },
    );
  }
}
