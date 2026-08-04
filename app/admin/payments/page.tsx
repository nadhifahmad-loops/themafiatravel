import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import PaymentsClient from './PaymentsClient';

export const metadata: Metadata = { title: 'Log Pembayaran' };

export default async function PaymentsPage() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: { booking: { select: { id: true, user: { select: { name: true } } } } },
  });
  return <PaymentsClient initialPayments={payments} />;
}