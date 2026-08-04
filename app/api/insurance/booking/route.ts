import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const bookings = await prisma.booking.findMany({
      where: { userId, bookingType: 'insurance' },
      orderBy: { createdAt: 'desc' },
      include: { payments: true },
    });
    return NextResponse.json({ success: true, data: bookings });
  } catch (e: any) {
    console.error('[Insurance Booking List] Error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
