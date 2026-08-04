import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const BASE_URL = IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { orderId } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
  const res = await fetch(`${BASE_URL}/${orderId}/status`, {
    headers: { Authorization: `Basic ${authString}` },
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Midtrans API error: ${res.status}`, detail: err }, { status: 502 });
  }

  const data = await res.json();
  const txn = data.transaction_status as string;
  const fraud = data.fraud_status as string;

  let newPaymentStatus = txn;
  let newBookingStatus: string | null = null;

  if ((txn === 'capture' && fraud === 'accept') || txn === 'settlement') {
    newBookingStatus = 'paid';
  } else if (['cancel', 'deny', 'expire'].includes(txn)) {
    newBookingStatus = 'payment_failed';
  } else if (txn === 'pending') {
    newBookingStatus = 'pending_payment';
  }

  await prisma.payment.update({
    where: { orderId },
    data: {
      status: newPaymentStatus,
      paymentType: data.payment_type,
      midtransResponse: data,
      ...(newPaymentStatus === 'settlement' && { paidAt: new Date() }),
    },
  });

  if (newBookingStatus) {
    const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
    if (booking && booking.status !== newBookingStatus) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: newBookingStatus,
          paymentId: data.transaction_id,
          paymentStatus: txn,
          paymentType: data.payment_type,
          ...(newBookingStatus === 'paid' && { paidAt: new Date() }),
        },
      });
    }
  }

  const updated = await prisma.payment.findUnique({
    where: { orderId },
    include: { booking: { select: { id: true, status: true, user: { select: { name: true } } } } },
  });

  return NextResponse.json({ success: true, payment: updated, midtrans: data });
}
