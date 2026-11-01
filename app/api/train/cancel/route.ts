import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { settleRefundAfterCancel } from '@/lib/refund';
import { extractVendorRefundAmount } from '@/lib/refund-amount';
import { canManageBooking } from '@/lib/booking-access';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Kesalahan tidak diketahui';
}

function getOrbisCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('orbisCode' in error)) return undefined;
  const code = error.orbisCode;
  return typeof code === 'number' ? code : undefined;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { orderId, orderNumber, reason } = body;

    if (!orderId && !orderNumber) {
      return NextResponse.json({ success: false, error: 'orderId atau orderNumber wajib diisi' }, { status: 400 });
    }

    // Cari booking di database
    const booking = orderId
      ? await bookingStore.findById(orderId)
      : await bookingStore.findByOrderNumber(orderNumber);

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking tidak ditemukan' }, { status: 404 });
    }

    // Validasi ownership
    const user = session.user as { id?: string; email?: string; role?: string };
    if (!canManageBooking(booking, {
      sessionUserId: user.id ?? null,
      sessionEmail: user.email ?? null,
      isAdmin: user.role === 'admin',
      bookerEmail: body.booker_email,
    })) {
      return NextResponse.json({ success: false, error: 'Tidak memiliki akses ke booking ini' }, { status: 403 });
    }

    // Validasi status — hanya bisa cancel jika masih pending atau paid
    if (['cancelled', 'refunded'].includes(booking.status)) {
      return NextResponse.json({ success: false, error: `Booking sudah berstatus: ${booking.status}` }, { status: 400 });
    }

    const derivedCancelType = booking.status === 'pending_payment'
      ? 'void'
      : ['paid', 'issued'].includes(booking.status)
        ? 'refund'
        : null;

    if (!derivedCancelType) {
      return NextResponse.json({ success: false, error: 'Status booking tidak mendukung pembatalan saat ini.' }, { status: 400 });
    }

    // Cancel ke KAI Orbis (pakai orderNumber dari KAI, bukan internal orderId)
    const kaiOrderNumber = booking.orderNumber; // format: TN.xxxxxxx
    let cancelResult: unknown;

    try {
      cancelResult = await trainAPI.cancelBooking(kaiOrderNumber);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('[KAI cancelBooking ERROR]', message);
      return NextResponse.json({
        success: false,
        error: `Gagal membatalkan di KAI: ${message}`,
        orbisCode: getOrbisCode(error),
      }, { status: 422 });
    }

    if (derivedCancelType === 'void') {
      await bookingStore.cancelBooking(booking.id, {
        reason: reason || 'Dibatalkan oleh pengguna',
        cancelType: 'void',
      });

      return NextResponse.json({
        success: true,
        message: 'Booking berhasil dibatalkan (void).',
        cancel_type: 'void',
        kaiOrderNumber,
        cancelResult,
      });
    }

    const vendorRefundAmount = extractVendorRefundAmount(cancelResult);
    const settle = await settleRefundAfterCancel(
      booking,
      reason || 'Refund booking train',
      vendorRefundAmount
    );

    return NextResponse.json({
      success: true,
      message: settle.mode === 'auto'
        ? 'Booking berhasil dibatalkan dan refund diproses otomatis.'
        : vendorRefundAmount === null
          ? 'Pembatalan vendor berhasil. Nominal refund belum tersedia dari API dan harus diverifikasi admin sebelum dana dikembalikan.'
          : 'Booking berhasil dibatalkan. Refund menunggu review admin.',
      cancel_type: 'refund',
      refund_mode: settle.mode,
      refund_amount: settle.amount,
      kaiOrderNumber,
      cancelResult,
    });

  } catch (error: unknown) {
    console.error('[Train Cancel ERROR]', getErrorMessage(error));
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem.' }, { status: 500 });
  }
}
