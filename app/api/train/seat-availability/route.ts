import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking, verifyGuestBookingProof } from '@/lib/booking-access';
import { deriveTrainFareCodes } from '@/lib/train-seat-data';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// POST /api/train/seat-availability
// - Mode orderId (utama): derivasi fare_code dilakukan server-side dari bookingData
//   (tanpa perlu client mengirim/mengetahui fare_code). Akses diverifikasi lewat
//   session / email pemesan / bukti guest (orderNumber + email/HP).
// - Mode fare_codes (legacy): tanpa auth, sama seperti pencarian (search).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { orderId, booker_email, orderNumber, phone, fare_codes, provider } = body;

    let fareCodes: string[];

    if (orderId) {
      const booking = await bookingStore.findById(orderId);
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Booking tidak ditemukan.' }, { status: 404 });
      }
      if (booking.bookingType !== 'train') {
        return NextResponse.json({ success: false, error: 'Bukan booking kereta.' }, { status: 400 });
      }

      const session = await getServerSession(authOptions);
      const user = session?.user as { id?: string; email?: string; role?: string } | undefined;
      const allowed = canManageBooking(booking, {
        sessionUserId: user?.id ?? null,
        sessionEmail: user?.email ?? null,
        isAdmin: user?.role === 'admin',
        bookerEmail: typeof booker_email === 'string' ? booker_email : undefined,
      }) || verifyGuestBookingProof(booking, orderNumber, phone);

      if (!allowed) {
        return NextResponse.json({ success: false, error: 'Tidak memiliki akses ke booking ini.' }, { status: 403 });
      }

      fareCodes = deriveTrainFareCodes(booking.bookingData);
      if (!fareCodes.length) {
        return NextResponse.json(
          { success: false, error: 'Fare code tidak ditemukan pada booking ini.' },
          { status: 422 }
        );
      }
    } else {
      if (!fare_codes || !Array.isArray(fare_codes) || fare_codes.length === 0) {
        return NextResponse.json({ success: false, error: 'fare_codes wajib diisi' }, { status: 400 });
      }
      fareCodes = fare_codes as string[];
    }

    const data = await trainAPI.getSeatAvailability({
      fare_codes: fareCodes,
      provider: provider || 'kai',
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('[Train Seat Availability ERROR]', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}