import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { safeTrainProviderBookings } from '@/lib/train-seat-data';
import { normalizeBookingSegments } from '@/lib/booking-segments';
import { authorizeBookingAccess } from '@/lib/booking-access';
import { genVerificationHash, verifyPath } from '@/lib/ticket-verify';

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX (Bug #11): endpoint ini bisa diakses tanpa login untuk guest booking,
    // jadi wajib dibatasi rate-nya sama seperti endpoint pencarian booking lain —
    // agar enumerasi ID tidak bisa dilakukan cepat/murah.
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`booking-detail:${ip}`, 'booking');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const session = await getServerSession(authOptions);
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const requester = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null;

    // Cari booking berdasarkan id atau orderNumber
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { id: id },
          { orderNumber: id },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Pesanan tidak ditemukan' },
        { status: 404 }
      );
    }

    const isAdmin = requester?.role === 'admin';
    if (!booking.userId && !isAdmin) {
      const proofLimit = await checkRateLimit(`guest-booking-proof:${ip}:${booking.id}`, 'auth');
      if (!proofLimit.allowed) {
        return NextResponse.json(
          { success: false, message: 'Terlalu banyak percobaan verifikasi. Silakan coba lagi nanti.' },
          { status: 429, headers: { 'Retry-After': String(proofLimit.retryAfter ?? 60) } }
        );
      }
    }

    const access = authorizeBookingAccess({
      bookingUserId: booking.userId,
      requesterId: requester?.id ?? null,
      isAdmin,
      guestContact: request.headers.get('x-booking-contact'),
      bookingData: booking.bookingData,
      passengerData: booking.passengerData,
    });
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // FIX (Bug #3 — sensitive data exposure): sebelumnya seluruh field mentah
    // (`...booking`) dikirim ke client, termasuk `bookingData` — yaitu respons
    // mentah dari Orbis (`commit_booking`) yang berpotensi memuat harga net/cost
    // vendor SEBELUM markup diterapkan (lihat lib/markup.ts), plus identifier
    // internal vendor. Field itu tidak pernah dibutuhkan oleh tampilan pelanggan.
    // Hanya admin yang boleh melihat data mentah ini (mis. untuk troubleshooting).
    const { bookingData, ...safeBooking } = booking;

    // Expose hanya field display-safe dari bookingData untuk non-admin
    const bd = (bookingData as Record<string, unknown>) || {};
    const safeTrainPbs = safeTrainProviderBookings(bd.provider_bookings);
    const safeBookingData = {
      arrival_date_from_search: bd.arrival_date_from_search ?? null,
      cabin_class: bd.cabin_class ?? null,
      subclass: bd.subclass ?? null,
      refundable: bd.refundable ?? null,
      is_refundable: bd.is_refundable ?? null,
      selectedBaggage: bd.selectedBaggage ?? null,
      coverage: bd.coverage ?? null,
      roomType: bd.roomType ?? null,
      // Field hotel yang aman ditampilkan. Data operasional lengkap tetap
      // diambil live dari get_summary_booking, bukan dari respons mentah vendor.
      hotel_name: bd.hotel_name ?? null,
      hotel_address: bd.hotel_address ?? null,
      hotel_phone: bd.hotel_phone ?? null,
      hotel_city_name: bd.hotel_city_name ?? bd.hotel_city ?? null,
      hotel_country_name: bd.hotel_country_name ?? null,
      hotel_rating: bd.hotel_rating ?? null,
      meal_type: bd.meal_type ?? null,
      room_name: bd.room_name ?? null,
      cancellation_policy: Array.isArray(bd.cancellation_policy) ? bd.cancellation_policy : null,
      cancellation_policy_str: bd.cancellation_policy_str ?? null,
      special_request: bd.special_request ?? null,
      // Segmen ternormalisasi untuk tampilan (rute, nama kota, jadwal).
      // Menyatukan format vendor (segments[] vs journeys[].segments[].legs[]).
      segments: normalizeBookingSegments(bd.provider_bookings).map((s) => ({
        origin: s.origin ?? null,
        destination: s.destination ?? null,
        origin_name: s.originName ?? null,
        destination_name: s.destinationName ?? null,
        origin_terminal: s.originTerminal ?? null,
        destination_terminal: s.destinationTerminal ?? null,
        departure_date: s.departureDate ?? null,
        arrival_date: s.arrivalDate ?? null,
        carrier_name: s.carrierName ?? null,
        flight_number: s.flightNumber ?? null,
        cabin_baggage: s.baggage ?? null,
        // Hanya field kursi yang aman ditampilkan (tanpa data identitas).
        passengers: (s.passengers ?? []).map((sp) => ({
          passenger_number: sp?.passenger_number ?? null,
          number: sp?.number ?? null,
          seat: sp?.seat ?? null,
          seat_code: sp?.seat_code ?? null,
          seat_assignment: sp?.seat_assignment ?? null,
        })),
      })),
      // provider_bookings dipertahankan untuk alur pilih kursi train
      // (hanya journeys yang aman dikirim ke client).
      provider_bookings: Array.isArray(bd.provider_bookings)
        ? (bd.provider_bookings as unknown[]).map((_pb, idx) => ({
            journeys: safeTrainPbs[idx]?.journeys ?? [],
          }))
        : [],
    };

    const responseData = {
      ...safeBooking,
      bookingData: isAdmin ? bookingData : safeBookingData,
      serviceType: booking.bookingType,
      verificationCode: genVerificationHash(booking.id),
      verificationHref: verifyPath(booking.id),
    };

    return NextResponse.json(
      { success: true, data: responseData },
      { headers: { 'Cache-Control': 'no-store' } }
    );

  } catch (error) {
    console.error('Error Fetch My Booking Detail:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Akses ditolak: bukan admin' }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Status pesanan tidak dapat diubah manual. Gunakan alur pembayaran, pembatalan, atau refund agar catatan layanan tetap sinkron.',
      },
      { status: 409 }
    );
  } catch (error) {
    console.error('Error Rejecting Manual Booking Status Update:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}