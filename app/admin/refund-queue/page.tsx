import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import RefundQueueClient from './RefundQueueClient';

export const metadata = {
  title: 'Antrian Refund',
};

type RefundQueueBooking = Prisma.BookingGetPayload<{
  include: { user: { select: { name: true; email: true } } };
}>;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function mapRefundRequest(value: unknown) {
  const data = objectValue(value);
  if (!data) return null;
  return {
    ...(typeof data.amount === 'number' ? { amount: data.amount } : {}),
    ...(typeof data.reason === 'string' ? { reason: data.reason } : {}),
    ...(typeof data.requestedAt === 'string' ? { requestedAt: data.requestedAt } : {}),
    ...(typeof data.mode === 'string' ? { mode: data.mode } : {}),
  };
}

function mapRefundResult(value: unknown) {
  const data = objectValue(value);
  if (!data) return null;
  return {
    ...(typeof data.amount === 'number' ? { amount: data.amount } : {}),
    ...(typeof data.refundedAt === 'string' ? { refundedAt: data.refundedAt } : {}),
    ...(typeof data.processedBy === 'string' ? { processedBy: data.processedBy } : {}),
  };
}

function mapFlightRefundEstimate(value: unknown) {
  const data = objectValue(value);
  if (!data) return null;
  return {
    ...(typeof data.amount === 'number' ? { amount: data.amount } : {}),
    ...(typeof data.capturedAt === 'string' ? { capturedAt: data.capturedAt } : {}),
    ...(typeof data.source === 'string' ? { source: data.source } : {}),
  };
}

function mapBooking(booking: RefundQueueBooking) {
  const data = objectValue(booking.bookingData) || {};
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
    paymentStatus: booking.paymentStatus,
    paymentId: booking.paymentId,
    paymentType: booking.paymentType,
    refundRequest: mapRefundRequest(data.refundRequest),
    refundResult: mapRefundResult(data.refundResult),
    flightRefundEstimate: mapFlightRefundEstimate(data.flightRefundEstimate),
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    user: booking.user,
  };
}

export default async function RefundQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/admin/login?callbackUrl=/admin/refund-queue&error=Unauthorized');
  }

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!admin || admin.role !== 'admin') {
    redirect('/admin/login?callbackUrl=/admin/refund-queue&error=Unauthorized');
  }

  // Pembayaran telat (lib/late-settlement.ts): status booking `payment_failed`
  // tapi dana sudah diterima Midtrans — tidak kena filter antrian review di atas,
  // jadi diambil terpisah supaya kasir tetap bisa melihat & refund manual.
  const [reviewBookings, lateBookings, historyBookings] = await Promise.all([
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
      where: { paymentStatus: 'late_settlement' },
      orderBy: { updatedAt: 'desc' },
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
      initialLate={lateBookings.map(mapBooking)}
      initialHistory={historyBookings.map(mapBooking)}
    />
  );
}
