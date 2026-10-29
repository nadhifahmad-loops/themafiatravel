import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { safeTrainProviderBookings } from '@/lib/train-seat-data';
import { matchGuestContact } from '@/lib/booking-contact-match';

/** Bentuk mentah passenger di passengerData (JSON) — untuk pemetaan respons. */
type GuestPassengerRow = {
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  pax_type?: string | null;
  seat?: string | null;
  nationality_code?: string | null;
  ticket_number?: string | null;
};

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

    // Pencocokan presisi bersama (lib/booking-contact-match) — kredensial yang
    // lolos /api/booking/find pasti lolos di sini; pesan 403 dipertahankan.
    const match = matchGuestContact(phone, booking.bookingData, booking.passengerData);
    if (!match.ok) {
      return NextResponse.json({ success: false, error: 'Verifikasi gagal.' }, { status: 403 });
    }

    const bd = (booking.bookingData ?? {}) as Record<string, unknown>;
    const contacts = Array.isArray(bd.contacts) ? bd.contacts : [];
    const booker = bd.booker || contacts[0] || {};
    const passengers = (Array.isArray(booking.passengerData) ? booking.passengerData : []) as GuestPassengerRow[];

    // Subset aman dari segmen penerbangan provider (tanpa data harga/tarif).
    const rawSegments =
      Array.isArray(bd.provider_bookings) && bd.provider_bookings[0] && Array.isArray(bd.provider_bookings[0].segments)
        ? bd.provider_bookings[0].segments
        : [];
    const flightSegments = rawSegments.map((s: Record<string, unknown>) => ({
      origin: s.origin || null,
      destination: s.destination || null,
      origin_name: s.origin_name || null,
      destination_name: s.destination_name || null,
      departure_date: s.departure_date || null,
      arrival_date: s.arrival_date || null,
      origin_terminal: s.origin_terminal || s.terminal || null,
      destination_terminal: s.destination_terminal || null,
      carrier_code: s.carrier_code || null,
      carrier_name: s.carrier_name || null,
      baggage_allowance: s.baggage_allowance || null,
    }));

    // Refundable flag (konsisten dengan halaman pesanan login).
    const refundable =
      typeof bd.refundable === 'boolean'
        ? bd.refundable
        : typeof bd.is_refundable === 'boolean'
          ? bd.is_refundable
          : typeof bd.fare_refundable === 'boolean'
            ? bd.fare_refundable
            : false;

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
        cabinClass: bd.cabin_class || bd.subclass || bd.roomType || '',
        selectedBaggage: bd.selectedBaggage || null,
        couponCode: booking.couponCode || null,
        discountAmount: booking.discountAmount || 0,
        // Field tambahan untuk kebutuhan dokumen PDF (voucher/e-ticket).
        // Field voucher hotel — booking hotel menyimpan nama & tanggal di KOLOM;
        // bookingData (respons Orbis createBooking) tidak memuatnya, jadi kolom
        // dipakai sebagai fallback agar kartu hotel/PDF tamu terisi.
        hotelName: bd.hotel_name || bd.hotelName || booking.hotelName || null,
        checkinDate: bd.checkin_date || bd.checkinDate || booking.checkinDate || null,
        checkoutDate: bd.checkout_date || bd.checkoutDate || booking.checkoutDate || null,
        coverage: bd.coverage || null,
        refundable,
        flightSegments,
        passengers: passengers.map((p) => ({
          name: `${p.title || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim(),
          type: p.pax_type || 'ADT',
          seat: p.seat || null,
          nationality: p.nationality_code || null,
          // Field mentah untuk rendering nama di template PDF.
          title: p.title || null,
          first_name: p.first_name || null,
          last_name: p.last_name || null,
          pax_type: p.pax_type || 'ADT',
          ticket_number: p.ticket_number || null,
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
