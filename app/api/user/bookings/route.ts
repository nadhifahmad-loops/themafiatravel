import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        pnr: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, bookings });
  } catch (error: unknown) {
    console.error('[User Bookings Error]', error);
    return NextResponse.json({ error: 'Gagal mengambil data pesanan' }, { status: 500 });
  }
}
