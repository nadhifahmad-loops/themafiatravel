import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { settleRefundAfterCancel } from '@/lib/refund';
import { canManageBooking } from '@/lib/booking-access';
import { extractAirlineRefundAmount, getAirlineProviderBookings, getAirlineRefundCancellationStatus, hasFlightDeparted, toAirlineRefundBookings } from '@/lib/orbis-post-booking';

/**
 * Cancel Booking Pesawat — Orbis Airline API v2.2
 *
 * Ada 2 jenis cancel:
 * ─ VOID  : Booking belum issued/bayar → cukup kirim { order_number }
 * ─ REFUND: Booking sudah issued/bayar → kirim { order_number, provider_bookings }
 *
 * Jenis cancel ditentukan dari status booking di server, bukan dari field body
 * yang bisa dipalsukan client.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid request body');
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Request body tidak valid.' }, { status: 400 });
  }

  const order_id = body.order_id;
  const reason = typeof body.reason === 'string' ? body.reason : '';

  if (typeof order_id !== 'string' || !order_id.trim()) {
    return NextResponse.json({ success: false, error: 'order_id wajib diisi.' }, { status: 400 });
  }

  // Cek kepemilikan booking
  const user = session.user as { id?: string; email?: string; role?: string };
  const booking = await bookingStore.findById(order_id);

  if (!booking) {
    return NextResponse.json({ success: false, error: 'Booking tidak ditemukan.' }, { status: 404 });
  }
  // Guest bookings (userId=null) hanya boleh dikelola pemesan aslinya —
  // dibuktikan lewat email pemesan (session atau booker_email dari body).
  if (!canManageBooking(booking, {
    sessionUserId: user.id ?? null,
    sessionEmail: user.email ?? null,
    isAdmin: user.role === 'admin',
    bookerEmail: typeof body.booker_email === 'string' ? body.booker_email : undefined,
  })) {
    return NextResponse.json({ success: false, error: 'Akses tidak diizinkan.' }, { status: 403 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json({ success: false, error: 'Booking sudah dibatalkan sebelumnya.' }, { status: 400 });
  }

  const derivedCancelType = booking.status === 'pending_payment'
    ? 'void'
    : ['paid', 'issued'].includes(booking.status)
      ? 'refund'
      : null;

  if (!derivedCancelType) {
    return NextResponse.json(
      { success: false, error: 'Status booking tidak mendukung pembatalan saat ini.' },
      { status: 400 }
    );
  }

  const orderNumber = booking.orderNumber;

  if (derivedCancelType === 'refund' && hasFlightDeparted(booking)) {
    console.warn('[Flight Cancel] Refund mandiri ditolak karena penerbangan sudah berangkat:', booking.id);
    return NextResponse.json(
      {
        success: false,
        error: 'Refund mandiri tidak dapat dilakukan karena penerbangan sudah berangkat atau tanggalnya lewat. Hubungi customer service untuk pemeriksaan kebijakan maskapai.',
        departed: true,
      },
      { status: 409 }
    );
  }

  try {
    let cancelResult: unknown;

    if (derivedCancelType === 'void') {
      // ─ VOID CANCEL ─────────────────────────────────────────────────────────
      // REQ: { order_number }
      console.log('[Flight Cancel] Void cancel untuk order_number:', orderNumber);
      cancelResult = await flightAPI.cancelVoid(orderNumber);

      await bookingStore.cancelBooking(order_id, {
        reason: reason || 'Dibatalkan oleh pengguna',
        cancelType: 'void',
      });

      return NextResponse.json({
        success: true,
        cancel_type: 'void',
        orderNumber,
        data: cancelResult,
        message: 'Booking berhasil dibatalkan (void).',
      });
    } else {
      // ─ REFUND CANCEL ────────────────────────────────────────────────────────
      // REQ: { order_number, provider_bookings: [{ pnr, journeys }] }
      // Jika client tidak kirim provider_bookings, ambil dari bookingData di DB
      const resolvedProviderBookings = getAirlineProviderBookings(booking);
      if (!resolvedProviderBookings.length) {
        return NextResponse.json({ success: false, error: 'Data itinerary refund tidak lengkap.' }, { status: 400 });
      }

      const bookingData = booking.bookingData && typeof booking.bookingData === 'object'
        ? booking.bookingData as Record<string, unknown>
        : {};
      const savedEstimateData = bookingData.flightRefundEstimate && typeof bookingData.flightRefundEstimate === 'object'
        ? bookingData.flightRefundEstimate as Record<string, unknown>
        : {};
      const savedEstimateAt = typeof savedEstimateData.capturedAt === 'string'
        ? Date.parse(savedEstimateData.capturedAt)
        : NaN;
      if (!Number.isFinite(savedEstimateAt) || savedEstimateAt > Date.now() || Date.now() - savedEstimateAt > 30 * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: 'Periksa estimasi refund maskapai kembali sebelum membatalkan booking.' },
          { status: 409 }
        );
      }
      const savedEstimate = typeof savedEstimateData.amount === 'number'
        && Number.isFinite(savedEstimateData.amount)
        && savedEstimateData.amount >= 0
        ? savedEstimateData.amount
        : null;

      console.log('[Flight Cancel] Refund cancel untuk order_number:', orderNumber);
      cancelResult = await flightAPI.cancelRefund({
        order_number: orderNumber,
        provider_bookings: toAirlineRefundBookings(booking),
      });

      const cancellationStatus = getAirlineRefundCancellationStatus(
        cancelResult,
        resolvedProviderBookings.map(({ pnr }) => pnr)
      );
      if (!cancellationStatus.confirmed) {
        const statusSummary = cancellationStatus.providers
          .map(({ pnr, state, error }) => `${pnr || 'PNR tidak diketahui'}: ${state || 'status tidak tersedia'}${error ? ` (${error})` : ''}`)
          .join('; ') || 'status provider tidak tersedia';
        const reviewReason = `${reason || 'Refund booking flight'} — status refund vendor belum terkonfirmasi (${statusSummary}); verifikasi status PNR sebelum memproses dana.`;
        const settle = await settleRefundAfterCancel(booking, reviewReason, null);

        console.warn('[Flight Cancel] Status refund provider belum terkonfirmasi; masuk review manual:', statusSummary);
        return NextResponse.json({
          success: true,
          cancel_type: 'refund',
          refund_mode: settle.mode,
          refund_amount: null,
          manual_review_required: true,
          provider_statuses: cancellationStatus.providers,
          orderNumber,
          data: cancelResult,
          message: 'Status refund vendor belum terkonfirmasi untuk seluruh PNR. Permintaan diamankan di antrean review admin; jangan ajukan ulang sebelum status booking diverifikasi.',
        });
      }

      const vendorRefundAmount = extractAirlineRefundAmount(cancelResult);
      const settledAmount = vendorRefundAmount ?? savedEstimate ?? null;

      // Auto vs manual queue — tiket sudah batal di vendor, dana mengikuti keputusan.
      const settle = await settleRefundAfterCancel(booking, reason || 'Refund booking flight', settledAmount);

      if (vendorRefundAmount !== null) {
        await bookingStore.mergeBookingData(booking.id, {
          bookingData: {
            flightRefundEstimate: {
              amount: vendorRefundAmount,
              source: 'cancel_response',
              capturedAt: new Date().toISOString(),
            },
          },
        });
      }

      console.log('[Flight Cancel] ✅ Refund settle | mode:', settle.mode, '| amount:', settle.amount, '| degraded:', Boolean(settle.degraded));

      return NextResponse.json({
        success: true,
        cancel_type: 'refund',
        refund_mode: settle.mode,
        refund_amount: settle.amount,
        refund_amount_source: vendorRefundAmount !== null
          ? 'vendor_cancel'
          : savedEstimate !== null
            ? 'vendor_quote'
            : 'unknown',
        ...(settledAmount === null
          ? { refund_amount_warning: 'Nominal refund dari vendor tidak tersedia; admin harus memverifikasi sebelum memproses dana.' }
          : {}),
        orderNumber,
        data: cancelResult,
        message: settle.mode === 'auto'
          ? 'Booking berhasil dibatalkan dan refund diproses otomatis.'
          : 'Booking berhasil dibatalkan. Permintaan refund diterima dan menunggu review admin.',
      });
    }
  } catch (e: unknown) {
    const errorData = e && typeof e === 'object'
      ? e as { orbisCode?: unknown; code?: unknown; orbisMessage?: unknown; message?: unknown }
      : {};
    const orbisCode = errorData.orbisCode ?? errorData.code ?? '';
    const orbisMsg = typeof errorData.orbisMessage === 'string'
      ? errorData.orbisMessage
      : e instanceof Error ? e.message : 'Gagal membatalkan booking.';
    console.error('[Flight Cancel] Error:', orbisCode, orbisMsg, e);
    return NextResponse.json(
      { success: false, error: orbisMsg, orbisCode },
      { status: 500 }
    );
  }
}