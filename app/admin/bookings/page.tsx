import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import BookingsClient from './BookingsClient';

export const metadata: Metadata = { title: 'Manajemen Pesanan' };

const PAGE_SIZE = 10;

type BookingType = 'flight' | 'hotel' | 'train' | 'insurance';

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const tab = (sp.tab && sp.tab !== 'all' ? sp.tab : 'all') as BookingType | 'all';
  const q = (sp.q || '').trim();

  const where: {
    bookingType?: BookingType;
    OR?: Array<Record<string, unknown>>;
  } = {};
  if (tab !== 'all') where.bookingType = tab;
  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' as const } },
      { pnr: { contains: q, mode: 'insensitive' as const } },
      { user: { name: { contains: q, mode: 'insensitive' as const } } },
      { user: { email: { contains: q, mode: 'insensitive' as const } } },
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);

  return (
    <BookingsClient
      initialBookings={bookings}
      initialTotal={total}
      initialPage={page}
      initialTab={tab}
      initialQuery={q}
    />
  );
}