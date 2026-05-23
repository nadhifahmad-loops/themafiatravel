import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.id }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Data tidak ditemukan.' }, { status: 404 });
    }

    // 1. TEMBEK KE API VENDOR SESUAI LAYANAN
    if (booking.bookingType === 'flight' || booking.bookingType === 'hotel') {
      // Menggunakan Orbis Request, panggil endpoint pembatalan tiket
      // const orbisRes = await orbisRequest('/booking/airline', 'cancel', { order_number: booking.orderNumber });
    } else if (booking.bookingType === 'train') {
      // Menggunakan Rodextrip API, panggil action cancel_booking
      // const rodextripRes = await rodextripRequest('/booking/train', 'cancel_booking', { order_number: booking.orderNumber });
    }

    // 2. UPDATE STATUS DATABASE PRISMA INTERNAL
    await prisma.booking.update({
      where: { id: params.id },
      data: {
        status: 'refund', // Status berubah menjadi Proses Refund
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}