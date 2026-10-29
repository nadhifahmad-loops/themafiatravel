import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { matchGuestContact } from '@/lib/booking-contact-match';

/** Pesan error API dalam kedua bahasa — dipilih berdasarkan header Accept-Language. */
const ERROR_MESSAGES: Record<'ID' | 'EN', Record<string, string>> = {
  ID: {
    'booking.not_found': 'Pesanan tidak ditemukan. Periksa kembali Kode Booking Anda.',
    'booking.invalid_phone': 'Nomor HP tidak valid.',
    'booking.email_mismatch': 'Email tidak cocok dengan data pemesan tiket ini.',
    'booking.phone_mismatch': 'Nomor HP tidak cocok dengan data pemesan tiket ini.',
    'booking.missing_credentials': 'Nomor Pesanan dan Email/HP wajib diisi.',
    'booking.rate_limited': 'Terlalu banyak permintaan pencarian booking. Silakan coba lagi nanti.',
    'booking.server_error': 'Terjadi kesalahan sistem. Silakan coba lagi nanti.',
  },
  EN: {
    'booking.not_found': 'Booking not found. Please check your Booking Code.',
    'booking.invalid_phone': 'Invalid phone number.',
    'booking.email_mismatch': 'Email does not match the ticket booker data.',
    'booking.phone_mismatch': 'Phone number does not match the ticket booker data.',
    'booking.missing_credentials': 'Order Number and Email/Phone are required.',
    'booking.rate_limited': 'Too many booking search requests. Please try again later.',
    'booking.server_error': 'A system error occurred. Please try again later.',
  },
};

function getLang(req: NextRequest): 'ID' | 'EN' {
  const accept = req.headers.get('accept-language') || '';
  return accept.split(',')[0]?.trim().toLowerCase().startsWith('en') ? 'EN' : 'ID';
}

function t(lang: 'ID' | 'EN', key: string): string {
  return ERROR_MESSAGES[lang][key] || ERROR_MESSAGES.ID[key];
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req as unknown as Request);
    const rateLimit = await checkRateLimit(`guest-booking:${ip}`, 'booking');
    if (!rateLimit.allowed) {
      const lang = getLang(req);
      return NextResponse.json(
        { success: false, error: t(lang, 'booking.rate_limited'), retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const body = await req.json();
    const { orderNumber, phone } = body;

    if (!orderNumber || !phone) {
      const lang = getLang(req);
      return NextResponse.json({ success: false, error: t(lang, 'booking.missing_credentials') }, { status: 400 });
    }

    // 1. Cari pesanan di database berdasarkan orderNumber (case-insensitive)
    const booking = await prisma.booking.findFirst({
      where: { orderNumber: { equals: orderNumber, mode: 'insensitive' } }
    });

    if (!booking) {
      const lang = getLang(req);
      return NextResponse.json({ success: false, error: t(lang, 'booking.not_found') }, { status: 404 });
    }

    // 2. Validasi Email atau Nomor HP — logika pencocokan presisi dari
    //    lib/booking-contact-match (dipakai bersama oleh find/guest-detail/
    //    guest-check-payment). Substring mentah hanya fallback kompatibilitas.
    const inputStr = typeof phone === 'string' ? phone.trim() : '';
    const isEmail = inputStr.includes('@');
    const match = matchGuestContact(inputStr, booking.bookingData, booking.passengerData);

    if (!match.ok) {
      const lang = getLang(req);
      if (match.reason === 'invalid-input') {
        return NextResponse.json({ success: false, error: t(lang, 'booking.invalid_phone') }, { status: 400 });
      }
      const errorKey = isEmail ? 'booking.email_mismatch' : 'booking.phone_mismatch';
      return NextResponse.json({ success: false, error: t(lang, errorKey) }, { status: 403 });
    }

    // 3. Kembalikan data booking
    return NextResponse.json({ 
      success: true, 
      bookingId: booking.id,
      booking: {
        id: booking.id,
        orderNumber: booking.orderNumber,
        bookingType: booking.bookingType,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
        totalAmount: booking.totalAmount,
        origin: booking.origin,
        destination: booking.destination,
        departureDate: booking.departureDate,
        routeLabel: booking.routeLabel || null,
        hotelName: booking.hotelName || null,
        checkinDate: booking.checkinDate || null,
        checkoutDate: booking.checkoutDate || null,
      }
    }, { status: 200 });

  } catch (error) {
    const lang = getLang(req);
    console.error('[GUEST BOOKING SEARCH ERROR]:', error);
    return NextResponse.json({ success: false, error: t(lang, 'booking.server_error') }, { status: 500 });
  }
}