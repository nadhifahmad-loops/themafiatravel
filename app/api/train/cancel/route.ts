import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { orderId, orderNumber, reason } = body;

    if (!orderId && !orderNumber) {
      return NextResponse.json({ success: false, error: 'orderId atau orderNumber wajib diisi' }, { status: 400 });
    }

    // Cari booking di database
    const booking = orderId
      ? await bookingStore.findById(orderId)
      : await bookingStore.findByOrderNumber(orderNumber);

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking tidak ditemukan' }, { status: 404 });
    }

    // Validasi ownership
    const userId = (session.user as any).id;
    if (booking.userId && booking.userId !== userId) {
      return NextResponse.json({ success: false, error: 'Tidak memiliki akses ke booking ini' }, { status: 403 });
    }

    // Validasi status — hanya bisa cancel jika masih pending atau paid
    if (['cancelled', 'refunded'].includes(booking.status)) {
      return NextResponse.json({ success: false, error: `Booking sudah berstatus: ${booking.status}` }, { status: 400 });
    }

    // Cancel ke KAI Orbis (pakai orderNumber dari KAI, bukan internal orderId)
    const kaiOrderNumber = booking.orderNumber; // format: TN.xxxxxxx
    let cancelResult: any = null;

    try {
      cancelResult = await trainAPI.cancelBooking(kaiOrderNumber);
    } catch (e: any) {
      console.error('[KAI cancelBooking ERROR]', e.message);
      return NextResponse.json({
        success: false,
        error: `Gagal membatalkan di KAI: ${e.message}`,
        orbisCode: e.orbisCode,
      }, { status: 422 });
    }

    // Update status di database
    await bookingStore.cancelBooking(booking.id, {
      reason: reason || 'Dibatalkan oleh pengguna',
      cancelType: 'refund',
    });

    return NextResponse.json({
      success: true,
      message: 'Booking berhasil dibatalkan',
      kaiOrderNumber,
      cancelResult,
    });

  } catch (e: any) {
    console.error('[Train Cancel ERROR]', e.message);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem.' }, { status: 500 });
  }
}
