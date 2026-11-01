import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';
import { getAirlineProviderBookings, hasFlightDeparted } from '@/lib/orbis-post-booking';

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

  if (typeof order_id !== 'string' || !order_id.trim()) {
    return NextResponse.json({ success: false, error: 'order_id wajib diisi.' }, { status: 400 });
  }

  const user = session.user as { id?: string; email?: string; role?: string };
  const booking = await bookingStore.findById(order_id);

  if (!booking) {
    return NextResponse.json({ success: false, error: 'Booking tidak ditemukan.' }, { status: 404 }    );
  }

  if (booking.bookingType !== 'flight') {
    return NextResponse.json({ success: false, error: 'Refund maskapai hanya berlaku untuk booking pesawat.' }, { status: 400 });
  }

  if (!canManageBooking(booking, {
    sessionUserId: user.id ?? null,
    sessionEmail: user.email ?? null,
    isAdmin: user.role === 'admin',
    bookerEmail: typeof body.booker_email === 'string' ? body.booker_email : undefined,
  })) {
    return NextResponse.json({ success: false, error: 'Akses tidak diizinkan.' }, { status: 403 });
  }

  if (!['paid', 'issued'].includes(booking.status)) {
    return NextResponse.json(
      { success: false, error: 'Refund hanya tersedia untuk booking yang sudah issued/dibayar.' },
      { status: 400 }
    );
  }

  if (hasFlightDeparted(booking)) {
    return NextResponse.json(
      { success: false, error: 'Penerbangan sudah berangkat atau tanggalnya lewat. Refund mandiri tidak tersedia; hubungi customer service untuk pemeriksaan kebijakan maskapai.' },
      { status: 409 }
    );
  }

  const providerBookings = getAirlineProviderBookings(booking);
  const providers = providerBookings.map((item) => item.provider);
  if (!providerBookings.length || providers.some((provider) => !provider)) {
    return NextResponse.json(
      { success: false, error: 'Data PNR/provider booking tidak lengkap.' },
      { status: 400 }
    );
  }

  try {
    const data = await flightAPI.preRefundLoginList({
      order_number: booking.orderNumber,
      provider: providers.filter((provider): provider is string => Boolean(provider)),
      pnr: providerBookings.map((item) => item.pnr),
    });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const code = error && typeof error === 'object' ? (error as { orbisCode?: number }).orbisCode : undefined;
    const msg = error instanceof Error ? error.message : '';

    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    if (code === 4013) {
      console.error('[Pre Refund Login Validation Error]', code, msg);
      return NextResponse.json(
        { success: false, error: msg || 'Data refund tidak sesuai dengan validasi vendor.' },
        { status: 422 }
      );
    }

    console.error('[Pre Refund Login Error]', code, msg);
    if (typeof code === 'number' && code >= 500) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maskapai gagal menyiapkan captcha refund. Coba lagi nanti atau hubungi customer service.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil data captcha refund' },
      { status: 500 }
    );
  }
}
