import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import AdminBookingDetailClient from './AdminBookingDetailClient';

export const metadata: Metadata = { title: 'Detail Pesanan Admin' };

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const booking = await prisma.booking.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  if (!booking) notFound();

  return <AdminBookingDetailClient booking={booking} />;
}
