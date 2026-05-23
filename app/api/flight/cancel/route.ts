import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';

/**
 * Cancel Booking Pesawat — Orbis Airline API v2.2
 *
 * Ada 2 jenis cancel:
 * ─ VOID  : Booking belum issued/bayar → cukup kirim { order_number }
 * ─ REFUND: Booking sudah issued/bayar → kirim { order_number, provider_bookings }
 *
 * Client menentukan jenis cancel lewat field `cancel_type` di body request:
 *   cancel_type = 'void'   → Void cancel
 *   cancel_type = 'refund' → Refund cancel
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Request body tidak valid.' }, { status: 400 });
  }

  const {
    order_id,         // ID booking di database kita (TMT-FLT-xxx)
    cancel_type,      // 'void' | 'refund'
    provider_bookings, // Wajib untuk refund: [{ pnr, journeys: [...] }]
  } = body;

  if (!order_id) {
    return NextResponse.json({ success: false, error: 'order_id wajib diisi.' }, { status: 400 });
  }
  if (!cancel_type || !['void', 'refund'].includes(cancel_type)) {
    return NextResponse.json(
      { success: false, error: 'cancel_type harus berisi "void" atau "refund".' },
      { status: 400 }
    );
  }

  // Cek kepemilikan booking
  const userId = (session.user as any).id;
  const booking = await bookingStore.findById(order_id);

  if (!booking) {
    return NextResponse.json({ success: false, error: 'Booking tidak ditemukan.' }, { status: 404 });
  }
  if (booking.userId !== userId) {
    return NextResponse.json({ success: false, error: 'Akses tidak diizinkan.' }, { status: 403 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json({ success: false, error: 'Booking sudah dibatalkan sebelumnya.' }, { status: 400 });
  }

  const orderNumber = booking.orderNumber;

  try {
    let cancelResult: any;

    if (cancel_type === 'void') {
      // ─ VOID CANCEL ─────────────────────────────────────────────────────────
      // REQ: { order_number }
      console.log('[Flight Cancel] Void cancel untuk order_number:', orderNumber);
      cancelResult = await flightAPI.cancelVoid(orderNumber);
    } else {
      // ─ REFUND CANCEL ────────────────────────────────────────────────────────
      // REQ: { order_number, provider_bookings: [{ pnr, journeys }] }
      if (!provider_bookings || !Array.isArray(provider_bookings) || provider_bookings.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'provider_bookings wajib diisi untuk refund cancel. Format: [{ pnr, journeys: [{ origin, destination, departure_date, pax: [] }] }]',
          },
          { status: 400 }
        );
      }

      console.log('[Flight Cancel] Refund cancel untuk order_number:', orderNumber);
      cancelResult = await flightAPI.cancelRefund({
        order_number: orderNumber,
        provider_bookings,
      });
    }

    // Update status di database
    await bookingStore.cancelBooking(order_id);

    console.log('[Flight Cancel] ✅ Cancel berhasil | type:', cancel_type, '| order:', orderNumber);

    return NextResponse.json({
      success: true,
      cancel_type,
      orderNumber,
      data: cancelResult,
      message: cancel_type === 'void'
        ? 'Booking berhasil dibatalkan (void).'
        : 'Permintaan refund berhasil diajukan.',
    });

  } catch (e: any) {
    console.error('[Flight Cancel] Error:', e.message);
    return NextResponse.json(
      { success: false, error: e.message || 'Gagal membatalkan booking.' },
      { status: 500 }
    );
  }
}