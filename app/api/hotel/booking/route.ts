import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const currentUserId = session.user.id;
  if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { order_number, issued_name, provider } = await req.json();
    if (!order_number) {
      return NextResponse.json({ error: 'order_number wajib diisi' }, { status: 400 });
    }

    // Verifikasi kepemilikan di DB lokal DULU — jangan pernah teruskan
    // order_number bebas dari client langsung ke Orbis, karena siapa pun
    // yang login bisa menebak/tahu order_number booking hotel milik user
    // lain dan membaca statusnya (IDOR). 404 generik supaya tidak
    // mengonfirmasi ke penyerang bahwa order_number itu valid.
    const localBooking = await bookingStore.findByOrderNumber(order_number);
    if (!localBooking || localBooking.userId !== currentUserId) {
      return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
    }

    // 3.9 Check Booking Status
    const data = await hotelAPI.getBooking(order_number, issued_name, provider);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('[HOTEL BOOKING STATUS ERROR]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userBookings = await bookingStore.getUserBookings(userId);
  return NextResponse.json({ success: true, data: userBookings });
}