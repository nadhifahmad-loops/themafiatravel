import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/** Normalize phone to digits-only with 62 prefix (e.g. 08123 → 628123, +628123 → 628123) */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  return '62' + digits.replace(/^0/, '');
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req as unknown as Request);
    const rateLimit = await checkRateLimit(`guest-booking:${ip}`, 'booking');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan pencarian booking. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const body = await req.json();
    const { orderNumber, phone } = body;

    if (!orderNumber || !phone) {
      return NextResponse.json({ success: false, error: 'Nomor Pesanan dan Email/HP wajib diisi.' }, { status: 400 });
    }

    // 1. Cari pesanan di database berdasarkan orderNumber (case-insensitive)
    const booking = await prisma.booking.findFirst({
      where: { orderNumber: { equals: orderNumber, mode: 'insensitive' } }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan. Periksa kembali Kode Booking Anda.' }, { status: 404 });
    }

    // 2. Validasi Email atau Nomor HP
    const inputStr = typeof phone === 'string' ? phone.trim() : '';
    const isEmail = inputStr.includes('@');

    const bookingDataStr = JSON.stringify(booking.bookingData || {});
    const passengerDataStr = JSON.stringify(booking.passengerData || {});
    const allDataStr = bookingDataStr + passengerDataStr;

    let isMatch = false;

    if (isEmail) {
      const cleanEmail = inputStr.toLowerCase();
      isMatch = allDataStr.toLowerCase().includes(cleanEmail);
      console.log('[Find Booking] Email search:', { cleanEmail, isMatch, dataSnippet: allDataStr.substring(0, 200) });
    } else {
      const cleanInput = normalizePhone(inputStr);
      if (cleanInput.length < 10) {
        return NextResponse.json({ success: false, error: 'Nomor HP tidak valid.' }, { status: 400 });
      }

      const localFormat = cleanInput.replace(/^62/, '0');
      const intlFormat = cleanInput;
      const withPlus = '+' + cleanInput;

      isMatch = allDataStr.includes(localFormat) 
             || allDataStr.includes(intlFormat)
             || allDataStr.includes(withPlus)
             || allDataStr.includes(cleanInput.replace(/^62/, ''));
      
      console.log('[Find Booking] Phone search:', { cleanInput, localFormat, intlFormat, withPlus, isMatch });
    }

    if (!isMatch) {
      const errorMsg = isEmail
        ? 'Email tidak cocok dengan data pemesan tiket ini.'
        : 'Nomor HP tidak cocok dengan data pemesan tiket ini.';
      return NextResponse.json({ success: false, error: errorMsg }, { status: 403 });
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
      }
    }, { status: 200 });

  } catch (error) {
    console.error('[GUEST BOOKING SEARCH ERROR]:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem. Silakan coba lagi nanti.' }, { status: 500 });
  }
}