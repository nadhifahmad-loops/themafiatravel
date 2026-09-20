import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAYMENT_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 jam

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Auto-expire pending bookings yang sudah lewat 24 jam
    const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MS);
    const expiredBookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: 'pending_payment',
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (expiredBookings.length > 0) {
      await prisma.booking.updateMany({
        where: {
          id: { in: expiredBookings.map(b => b.id) },
        },
        data: {
          status: 'payment_failed',
          paymentStatus: 'expire',
        },
      });
    }

    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        bookingType: true,
        status: true,
        totalAmount: true,
        currency: true,
        routeLabel: true,
        hotelName: true,
        origin: true,
        destination: true,
        departureDate: true,
        checkinDate: true,
        checkoutDate: true,
        flightNumber: true,
        airlineName: true,
        provider: true,
        pnr: true,
        passengerData: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, bookings });
  } catch (error: unknown) {
    console.error('[User Bookings Error]', error);
    return NextResponse.json({ error: 'Gagal mengambil data pesanan' }, { status: 500 });
  }
}
