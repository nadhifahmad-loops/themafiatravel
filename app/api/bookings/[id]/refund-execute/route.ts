import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Data tidak ditemukan.' }, { status: 404 });
    }

    if (booking.bookingType === 'flight' || booking.bookingType === 'hotel') {
      // const orbisRes = await orbisRequest('/booking/airline', 'cancel', { order_number: booking.orderNumber });
    } else if (booking.bookingType === 'train') {
      // const rodextripRes = await rodextripRequest('/booking/train', 'cancel_booking', { order_number: booking.orderNumber });
    }

    await prisma.booking.update({
      where: { id },
      data: {
        status: 'refund',
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}