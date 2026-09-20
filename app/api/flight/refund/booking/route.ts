import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';

/**
 * Get Refund Booking — Orbis Airline API v2.2 §3.23
 *
 * Mendapatkan detail refund booking (termasuk harga refund, biaya admin, dll).
 * Request: { order_number, provider_bookings: [{pnr, journeys: [...]}], captcha?: {pnr: value} }
 * Response: Sama seperti commit booking response (§3.18.2.1)
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

  const { order_id, provider_bookings, captcha } = body;

  if (!order_id) {
    return NextResponse.json({ success: false, error: 'order_id wajib diisi.' }, { status: 400 });
  }

  const user = session.user as { id?: string; email?: string; role?: string };
  const booking = await bookingStore.findById(order_id);

  if (!booking) {
    return NextResponse.json({ success: false, error: 'Booking tidak ditemukan.' }, { status: 404 });
  }

  if (!canManageBooking(booking, {
    sessionUserId: user.id ?? null,
    sessionEmail: user.email ?? null,
    isAdmin: user.role === 'admin',
    bookerEmail: body.booker_email,
  })) {
    return NextResponse.json({ success: false, error: 'Akses tidak diizinkan.' }, { status: 403 });
  }

  // Bangun provider_bookings dari data booking jika tidak disediakan
  let resolvedProviderBookings = provider_bookings;
  if (!resolvedProviderBookings || !Array.isArray(resolvedProviderBookings) || resolvedProviderBookings.length === 0) {
    const bookingData = booking.bookingData as any;

    if (bookingData?.provider_bookings && Array.isArray(bookingData.provider_bookings) && bookingData.provider_bookings.length > 0) {
      const paxData = booking.passengerData as any[];
      const totalPax = Array.isArray(paxData) ? paxData.length : 1;
      const paxNumbers = Array.from({ length: totalPax }, (_, i) => i);

      resolvedProviderBookings = bookingData.provider_bookings.map((pb: any) => {
        const segments = pb.segments || pb.journeys || [];
        return {
          pnr: pb.pnr || booking.pnr || booking.orderNumber,
          journeys: segments.map((seg: any) => {
            const rawPax = seg.passengers || seg.pax || [];
            let pax = rawPax.map((p: any) => typeof p === 'number' ? p : (p.passenger_number ?? p.number ?? 0));
            if (!pax || pax.length === 0) pax = paxNumbers;
            return {
              origin: seg.origin || booking.origin,
              destination: seg.destination || booking.destination,
              departure_date: seg.departure_date,
              pax,
            };
          }),
        };
      });
    }

    if (!resolvedProviderBookings || resolvedProviderBookings.length === 0) {
      resolvedProviderBookings = [{
        pnr: booking.pnr || booking.orderNumber,
        journeys: [{
          origin: booking.origin,
          destination: booking.destination,
          departure_date: booking.departureDate?.toISOString?.() || booking.departureDate,
          pax: Array.from({ length: (booking.passengerData as any[])?.length || 1 }, (_, i) => i),
        }],
      }];
    }
  }

  try {
    const data = await flightAPI.getRefundBooking({
      order_number: booking.orderNumber,
      provider_bookings: resolvedProviderBookings,
      ...(captcha && { captcha }),
    });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg = error.message || '';

    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    console.error('[Get Refund Booking Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil data refund booking' },
      { status: 500 }
    );
  }
}
