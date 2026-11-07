import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isValidVerificationHash } from '@/lib/ticket-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/verify/[id]?h=<hash>
 *
 * Verifikasi publik keaslian dokumen. Hanya mengembalikan field display-safe:
 * tidak ada harga, data kontak, atau data mentah vendor.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ip = getClientIp(request);
    const rate = await checkRateLimit(`verify:${ip}`, 'general');
    if (!rate.allowed) {
      return NextResponse.json(
        { valid: false, message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 60) } },
      );
    }

    const { id } = await params;
    const hash = new URL(request.url).searchParams.get('h') || '';

    if (!id || !hash) {
      return NextResponse.json({ valid: false, message: 'Kode verifikasi tidak lengkap.' }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      select: {
        id: true,
        orderNumber: true,
        bookingType: true,
        status: true,
        hotelName: true,
        airlineName: true,
        origin: true,
        destination: true,
        routeLabel: true,
        departureDate: true,
        checkinDate: true,
        checkoutDate: true,
        paidAt: true,
        createdAt: true,
        passengerData: true,
      },
    });

    if (!booking || !isValidVerificationHash(booking.id, hash)) {
      return NextResponse.json(
        { valid: false, message: 'Dokumen tidak ditemukan atau kode verifikasi tidak cocok.' },
        { status: 404 },
      );
    }

    const passengerCount = Array.isArray(booking.passengerData) ? booking.passengerData.length : 0;

    return NextResponse.json({
      valid: true,
      document: {
        orderNumber: booking.orderNumber,
        bookingType: booking.bookingType,
        status: booking.status,
        itemName:
          booking.bookingType === 'hotel'
            ? booking.hotelName
            : booking.bookingType === 'insurance'
              ? 'Asuransi Perjalanan'
              : booking.airlineName,
        origin: booking.origin,
        destination: booking.destination,
        routeLabel: booking.routeLabel,
        startDate:
          booking.bookingType === 'hotel'
            ? booking.checkinDate
            : booking.departureDate,
        endDate:
          booking.bookingType === 'hotel'
            ? booking.checkoutDate
            : null,
        passengerCount,
        issuedAt: booking.paidAt || booking.createdAt,
      },
    });
  } catch (error) {
    console.error('[Verify Error]', error);
    return NextResponse.json({ valid: false, message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
