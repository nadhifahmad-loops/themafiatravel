import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';
import { extractAirlineRefundAmount, getAirlineProviderBookings, hasFlightDeparted, toAirlineRefundBookings } from '@/lib/orbis-post-booking';

/**
 * Get Refund Booking — Orbis Airline API v2.2 §3.23
 *
 * Mendapatkan detail refund booking (termasuk harga refund, biaya admin, dll).
 * Request: { order_number, provider_bookings: [{pnr, journeys: [...]}], captcha: {pnr: value} }
 * Response: Sama seperti commit booking response (§3.18.2.1)
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
  if (!providerBookings.length) {
    return NextResponse.json({ success: false, error: 'Data itinerary refund tidak lengkap.' }, { status: 400 });
  }

  if (!body.captcha || typeof body.captcha !== 'object' || Array.isArray(body.captcha)) {
    return NextResponse.json(
      { success: false, error: 'Captcha maskapai wajib diisi sebelum meminta estimasi refund.' },
      { status: 400 }
    );
  }
  const captchaEntries = Object.entries(body.captcha as Record<string, unknown>);
  if (
    captchaEntries.length !== providerBookings.length
    || captchaEntries.some(([pnr, value]) =>
      !providerBookings.some((providerBooking) => providerBooking.pnr === pnr)
      || typeof value !== 'string'
      || !value.trim()
    )
  ) {
    return NextResponse.json(
      { success: false, error: 'Captcha wajib diisi untuk setiap PNR booking.' },
      { status: 400 }
    );
  }
  const captcha = Object.fromEntries(captchaEntries.map(([pnr, value]) => [pnr, (value as string).trim()]));

  try {
    const data = await flightAPI.getRefundBooking({
      order_number: booking.orderNumber,
      provider_bookings: toAirlineRefundBookings(booking),
      captcha,
    });
    const refundableAmount = extractAirlineRefundAmount(data);
    await bookingStore.mergeBookingData(booking.id, {
      bookingData: {
        flightRefundEstimate: {
          amount: refundableAmount,
          capturedAt: new Date().toISOString(),
        },
      },
    });
    return NextResponse.json({ success: true, data, refundableAmount });
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
      console.error('[Get Refund Booking Validation Error]', code, msg);
      return NextResponse.json(
        {
          success: false,
          error: msg.toLowerCase().includes('captcha')
            ? 'Captcha tidak diterima atau sudah kedaluwarsa. Muat ulang captcha lalu coba lagi.'
            : msg || 'Data refund tidak sesuai dengan validasi vendor.',
        },
        { status: 422 }
      );
    }

    console.error('[Get Refund Booking Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil data refund booking' },
      { status: 500 }
    );
  }
}
