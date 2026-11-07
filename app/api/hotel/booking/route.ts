import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { getOrbisHotelBookingIdentifiers } from '@/lib/orbis-hotel-payload';
import { normalizeHotelBookingStatus } from '@/lib/hotel-booking-status';
import { resolveHotelApiError } from '@/lib/hotel-errors';
import { bookingStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const currentUserId = session.user.id;
  if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { order_number?: unknown };
    if (typeof body.order_number !== 'string' || !body.order_number.trim()) {
      return NextResponse.json({ error: 'order_number wajib diisi' }, { status: 400 });
    }
    const orderNumber = body.order_number.trim();

    // Verifikasi kepemilikan di DB lokal DULU — jangan pernah teruskan
    // order_number bebas dari client langsung ke Orbis, karena siapa pun
    // yang login bisa menebak/tahu order_number booking hotel milik user
    // lain dan membaca statusnya (IDOR). 404 generik supaya tidak
    // mengonfirmasi ke penyerang bahwa order_number itu valid.
    const localBooking = await bookingStore.findByOrderNumber(orderNumber);
    if (!localBooking || localBooking.userId !== currentUserId) {
      return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
    }

    const identifiers = getOrbisHotelBookingIdentifiers(
      localBooking.bookingData,
      localBooking.provider || '',
      localBooking.pnr || '',
    );
    const provider = localBooking.provider || identifiers.provider;
    const issuedName = identifiers.issuedName || localBooking.pnr;
    if (!issuedName || !provider) {
      return NextResponse.json(
        { error: 'Data status voucher hotel belum lengkap pada booking.' },
        { status: 409 },
      );
    }

    // Status Orbis hanya menggunakan identitas yang tersimpan di booking milik user.
    const data = await hotelAPI.getBooking(localBooking.orderNumber, issuedName, provider);
    return NextResponse.json({
      success: true,
      data: normalizeHotelBookingStatus(data),
    });
  } catch (error: unknown) {
    const resolved = resolveHotelApiError(
      error,
      'Gagal memeriksa status booking hotel. Silakan coba lagi beberapa saat.'
    );
    console.error('[HOTEL BOOKING STATUS ERROR]', resolved.orbisCode, error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: resolved.message, code: resolved.code },
      { status: resolved.status },
    );
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userBookings = await bookingStore.getUserBookingsByType(userId, 'hotel');
  return NextResponse.json({ success: true, data: userBookings });
}