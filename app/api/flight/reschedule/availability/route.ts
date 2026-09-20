import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';

/**
 * Get Reschedule Availability — Orbis Airline API v2.2 §3.25
 *
 * Mendapatkan jadwal penerbangan yang tersedia untuk reschedule.
 * Request: { order_number, cabin_class, reschedule_list: [{pnr, journeys: [{origin, destination, departure_date}]}] }
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

  const { order_id, cabin_class, reschedule_list } = body;

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

  if (!['paid', 'issued'].includes(booking.status)) {
    return NextResponse.json(
      { success: false, error: 'Reschedule hanya tersedia untuk booking yang sudah issued/dibayar.' },
      { status: 400 }
    );
  }

  // Bangun reschedule_list dari data booking jika tidak disediakan
  let resolvedRescheduleList = reschedule_list;
  if (!resolvedRescheduleList || !Array.isArray(resolvedRescheduleList) || resolvedRescheduleList.length === 0) {
    const bookingData = booking.bookingData as any;
    const pnr = booking.pnr || bookingData?.pnr;

    if (!pnr) {
      return NextResponse.json(
        { success: false, error: 'PNR tidak ditemukan untuk booking ini.' },
        { status: 400 }
      );
    }

    resolvedRescheduleList = [{
      pnr,
      journeys: [{
        origin: booking.origin,
        destination: booking.destination,
        departure_date: booking.departureDate?.toISOString?.()?.split('T')[0] || booking.departureDate,
      }],
    }];
  }

  try {
    const data = await flightAPI.getRescheduleAvailability({
      order_number: booking.orderNumber,
      cabin_class: cabin_class || 'Y',
      reschedule_list: resolvedRescheduleList,
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

    console.error('[Reschedule Availability Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil jadwal reschedule' },
      { status: 500 }
    );
  }
}
