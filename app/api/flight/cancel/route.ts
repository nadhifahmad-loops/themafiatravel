import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { settleRefundAfterCancel } from '@/lib/refund';
import { canManageBooking } from '@/lib/booking-access';

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Request body tidak valid.' }, { status: 400 });
  }

  const {
    order_id,         // ID booking di database kita (TMT-FLT-xxx)
    provider_bookings, // Wajib untuk refund: [{ pnr, journeys: [...] }]
    reason,           // Alasan pembatalan
  } = body;

  if (!order_id) {
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
    bookerEmail: body.booker_email,
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

  // Cek apakah penerbangan sudah lewat
  const depDate = booking.departureDate ? new Date(booking.departureDate) : null;
  const now = new Date();
  if (depDate && depDate < now) {
    console.warn('[Flight Cancel] Penerbangan sudah lewat:', depDate.toISOString());
    return NextResponse.json(
      {
        success: false,
        error: 'Pembatalan tidak dapat dilakukan karena penerbangan sudah berangkat/sudah lewat. Hubungi CS untuk bantuan lebih lanjut.',
        departed: true,
        departureDate: depDate.toISOString(),
      },
      { status: 400 }
    );
  }

  try {
    let cancelResult: any;

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
      let resolvedProviderBookings = provider_bookings;

      if (!resolvedProviderBookings || !Array.isArray(resolvedProviderBookings) || resolvedProviderBookings.length === 0) {
        const bookingData = booking.bookingData as any;

        // Hitung jumlah penumpang dari passengerData
        const paxData = booking.passengerData as any[];
        const totalPax = Array.isArray(paxData) ? paxData.length : 1;
        const paxNumbers = Array.from({ length: totalPax }, (_, i) => i);

        // Coba ambil dari bookingData.provider_bookings
        if (bookingData?.provider_bookings && Array.isArray(bookingData.provider_bookings) && bookingData.provider_bookings.length > 0) {
          resolvedProviderBookings = bookingData.provider_bookings.map((pb: any) => {
            const segments = pb.segments || pb.journeys || [];
            return {
              pnr: pb.pnr || booking.pnr || orderNumber,
              journeys: segments.map((seg: any) => {
                // Handle passengers: bisa array of objects atau array of numbers
                const rawPax = seg.passengers || seg.pax || [];
                let pax = rawPax.map((p: any) => typeof p === 'number' ? p : (p.passenger_number ?? p.number ?? 0));

                // Jika pax kosong, isi dari passengerData
                if (!pax || pax.length === 0) {
                  pax = paxNumbers;
                }

                return {
                  origin: seg.origin || booking.origin,
                  destination: seg.destination || booking.destination,
                  departure_date: seg.departure_date,
                  pax,
                };
              }),
            };
          });
          console.log('[Flight Cancel] provider_bookings dari bookingData DB:', JSON.stringify(resolvedProviderBookings, null, 2));
        }

        // Fallback: bangun dari data booking langsung
        if (!resolvedProviderBookings || resolvedProviderBookings.length === 0) {
          resolvedProviderBookings = [{
            pnr: booking.pnr || orderNumber,
            journeys: [{
              origin: booking.origin,
              destination: booking.destination,
              departure_date: booking.departureDate?.toISOString?.() || booking.departureDate,
              pax: paxNumbers,
            }],
          }];
          console.log('[Flight Cancel] provider_bookings dari fallback data booking');
        }
      }

      console.log('[Flight Cancel] Refund cancel untuk order_number:', orderNumber, '| provider_bookings:', JSON.stringify(resolvedProviderBookings, null, 2));
      cancelResult = await flightAPI.cancelRefund({
        order_number: orderNumber,
        provider_bookings: resolvedProviderBookings,
      });

      // Auto vs manual queue — tiket sudah batal di vendor, dana mengikuti keputusan.
      const settle = await settleRefundAfterCancel(booking, reason || 'Refund booking flight');

      console.log('[Flight Cancel] ✅ Refund settle | mode:', settle.mode, '| amount:', settle.amount, '| degraded:', Boolean(settle.degraded));

      return NextResponse.json({
        success: true,
        cancel_type: 'refund',
        refund_mode: settle.mode,
        orderNumber,
        data: cancelResult,
        message: settle.mode === 'auto'
          ? 'Booking berhasil dibatalkan dan refund diproses otomatis.'
          : 'Booking berhasil dibatalkan. Permintaan refund diterima dan menunggu review admin.',
      });
    }
  } catch (e: unknown) {
    const orbisCode = (e as any)?.orbisCode || (e as any)?.code || '';
    const orbisMsg = (e as any)?.orbisMessage || (e as any)?.message || 'Gagal membatalkan booking.';
    console.error('[Flight Cancel] Error:', orbisCode, orbisMsg, e);
    return NextResponse.json(
      { success: false, error: orbisMsg, orbisCode },
      { status: 500 }
    );
  }
}