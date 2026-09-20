import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';

/**
 * Pre Refund Login List — Orbis Airline API v2.2 §3.22
 *
 * Mendapatkan captcha untuk proses refund (jika vendor menyediakan captcha).
 * Request: { order_id }
 * Response: { pre_refund_login: { pnr, img (base64) } }
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

  const { order_id } = body;

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
      { success: false, error: 'Refund hanya tersedia untuk booking yang sudah issued/dibayar.' },
      { status: 400 }
    );
  }

  const pnr = booking.pnr;
  const provider = booking.provider || '';

  if (!pnr || !provider) {
    return NextResponse.json(
      { success: false, error: 'Data PNR/provider tidak lengkap.' },
      { status: 400 }
    );
  }

  try {
    const data = await flightAPI.preRefundLoginList({
      provider: [provider],
      pnr: [pnr],
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

    console.error('[Pre Refund Login Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil data captcha refund' },
      { status: 500 }
    );
  }
}
