import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';

/**
 * Update Booking — Orbis Airline API v2.2 §3.31
 *
 * Update data booking setelah reschedule/SSR/seat.
 * Request: { order_number, schedules: [{pnr}] }
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

  // Bangun schedules dari data booking jika tidak disediakan
  let resolvedSchedules = schedules;
  if (!resolvedSchedules || !Array.isArray(resolvedSchedules) || resolvedSchedules.length === 0) {
    const pnr = booking.pnr;
    if (!pnr) {
      return NextResponse.json(
        { success: false, error: 'PNR tidak ditemukan untuk booking ini.' },
        { status: 400 }
      );
    }
    resolvedSchedules = [{ pnr }];
  }

  try {
    const data = await flightAPI.updateBooking({
      order_number: booking.orderNumber,
      schedules: resolvedSchedules,
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

    if (code === 4042) {
      return NextResponse.json({
        success: true,
        data: null,
        noChange: true,
        message: 'Tidak ada perubahan yang terdeteksi pada booking.',
      });
    }

    console.error('[Update Booking Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengupdate booking' },
      { status: 500 }
    );
  }
}
