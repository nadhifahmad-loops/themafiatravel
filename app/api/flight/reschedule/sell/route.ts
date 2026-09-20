import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';

/**
 * Sell Reschedule — Orbis Airline API v2.2 §3.26
 *
 * Menetapkan jadwal baru untuk reschedule.
 * Request: { order_number, schedules: [{pnr, journeys: [{segments: [{segment_code, fare_code}]}]}] }
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

  const { order_id, schedules } = body;

  if (!order_id) {
    return NextResponse.json({ success: false, error: 'order_id wajib diisi.' }, { status: 400 });
  }

  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    return NextResponse.json({ success: false, error: 'schedules wajib diisi.' }, { status: 400 });
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

  try {
    const data = await flightAPI.sellReschedule({
      order_number: booking.orderNumber,
      schedules,
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

    if (code === 4019 || code === 4009 || code === 4010) {
      return NextResponse.json(
        { success: false, error: msg || 'Gagal melakukan reschedule' },
        { status: 422 }
      );
    }

    console.error('[Reschedule Sell Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal menjual jadwal reschedule' },
      { status: 500 }
    );
  }
}
