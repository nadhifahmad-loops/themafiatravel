import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { safeTrainProviderBookings } from '@/lib/train-seat-data';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  return '62' + digits.replace(/^0/, '');
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req as unknown as Request);
    const rateLimit = await checkRateLimit(`guest-detail:${ip}`, 'booking');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429 }
      );
    }

    const orderNumber = req.nextUrl.searchParams.get('orderNumber');
    const phone = req.nextUrl.searchParams.get('phone');

    if (!orderNumber || !phone) {
      return NextResponse.json({ success: false, error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: { orderNumber: { equals: orderNumber, mode: 'insensitive' } }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const inputStr = phone.trim();
    const isEmail = inputStr.includes('@');
    const allDataStr = JSON.stringify(booking.bookingData || {}) + JSON.stringify(booking.passengerData || {});

    let isMatch = false;
    if (isEmail) {
      isMatch = allDataStr.toLowerCase().includes(inputStr.toLowerCase());
    } else {
      const cleanInput = normalizePhone(inputStr);
      if (cleanInput.length >= 10) {
        const localFormat = cleanInput.replace(/^62/, '0');
        isMatch = allDataStr.includes(localFormat)
               || allDataStr.includes(cleanInput)
               || allDataStr.includes('+' + cleanInput)
               || allDataStr.includes(cleanInput.replace(/^62/, ''));
      }
    }

    if (!isMatch) {
      return NextResponse.json({ success: false, error: 'Verifikasi gagal.' }, { status: 403 });
    }

    const bd = (booking.bookingData ?? {}) as any;
    const contacts = Array.isArray(bd.contacts) ? bd.contacts : [];
    const booker = bd.booker || contacts[0] || {};
    const passengers = Array.isArray(booking.passengerData) ? booking.passengerData : [];

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        orderNumber: booking.orderNumber,
        bookingType: booking.bookingType,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        origin: booking.origin,
        destination: booking.destination,
        departureDate: booking.departureDate,
        arrivalDate: bd.arrival_date_from_search || null,
        flightNumber: booking.flightNumber,
        airlineName: booking.airlineName,
        pnr: booking.pnr,
        provider: booking.provider,
        routeLabel: booking.routeLabel,
        cabinClass: bd.cabin_class || bd.subclass || '',
        selectedBaggage: bd.selectedBaggage || null,
        couponCode: booking.couponCode || null,
        discountAmount: booking.discountAmount || 0,
        passengers: passengers.map((p: any) => ({
          name: `${p.title || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim(),
          type: p.pax_type || 'ADT',
          seat: p.seat || null,
          nationality: p.nationality_code || null,
        })),
        bookerName: `${booker.first_name || ''} ${booker.last_name || ''}`.trim(),
        bookerEmail: booker.email || null,
        bookerPhone: booker.mobile || null,
        // Journeys train (KAI) untuk tampilan/ubah kursi — subset aman tanpa harga.
        providerBookings: safeTrainProviderBookings(bd.provider_bookings),
      }
    }, { status: 200 });

  } catch (error) {
    console.error('[GUEST BOOKING DETAIL ERROR]:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem.' }, { status: 500 });
  }
}
