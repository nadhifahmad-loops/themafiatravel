import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import RefundQueueClient from './RefundQueueClient';

export const metadata = {
  title: 'Antrian Refund',
};

function mapBooking(booking: any) {
  const data = (booking.bookingData as Record<string, any>) || {};
  return {
    id: booking.id,
    orderNumber: booking.orderNumber,
    bookingType: booking.bookingType,
    status: booking.status,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    pnr: booking.pnr,
    routeLabel: booking.routeLabel,
    hotelName: booking.hotelName,
    flightNumber: booking.flightNumber,
    provider: booking.provider,
    cancelReason: booking.cancelReason,
    cancelType: booking.cancelType,
    refundRequest: data.refundRequest ?? null,
    refundResult: data.refundResult ?? null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    user: booking.user,
  };
}

export default async function RefundQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/admin/refund-queue&error=Unauthorized');
  }

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!admin || admin.role !== 'admin') {
    redirect('/login?callbackUrl=/admin/refund-queue&error=Unauthorized');
  }

  const [reviewBookings, historyBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: ['refund_requested', 'refund'] },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        cancelType: 'refund',
        status: { notIn: ['refund_requested', 'refund'] },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 20,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <RefundQueueClient
      initialReview={reviewBookings.map(mapBooking)}
      initialHistory={historyBookings.map(mapBooking)}
    />
  );
}
