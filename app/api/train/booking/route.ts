import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';

// GET /api/train/booking?orderId=xxx  → ambil dari DB + detail KAI
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  try {
    if (orderId) {
      // Ambil booking spesifik
      const booking = await bookingStore.findById(orderId);
      if (!booking) return NextResponse.json({ success: false, error: 'Booking tidak ditemukan' }, { status: 404 });
      if (booking.userId !== userId) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

      // Ambil detail live dari KAI jika ada orderNumber
      let kaiDetail: any = null;
      if (booking.orderNumber && booking.orderNumber.startsWith('TN.')) {
        try {
          kaiDetail = await trainAPI.getBooking(booking.orderNumber);
        } catch (e: any) {
          console.warn('[KAI getBooking warn]', e.message);
        }
      }

      return NextResponse.json({ success: true, data: booking, kaiDetail });
    }

    // Ambil semua booking kereta milik user
    const trainBookings = await bookingStore.getUserBookingsByType(userId, 'train');
    return NextResponse.json({ success: true, data: trainBookings });

  } catch (e: any) {
    console.error('[Train Booking GET ERROR]', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
