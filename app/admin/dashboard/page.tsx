import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';
import { startOfMonth, subDays, format } from 'date-fns';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const sevenDaysAgo = subDays(now, 6);

  // Jalankan query paralel ke Prisma
  const [
    revenueThisMonth,
    activeBookings,
    pendingPayment,
    totalUsers,
    recentBookings,
    bookingsLast7Days,
  ] = await Promise.all([
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ['paid', 'issued'] }, createdAt: { gte: monthStart } },
    }),
    prisma.booking.count({ where: { status: 'paid' } }),
    prisma.booking.count({ where: { status: 'pending_payment' } }),
    prisma.user.count(),
    prisma.booking.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, totalAmount: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Siapkan data grafik tren per hari
  const trendMap: Record<string, { orders: number; revenue: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(now, i), 'dd MMM');
    trendMap[d] = { orders: 0, revenue: 0 };
  }
  for (const b of bookingsLast7Days) {
    const key = format(b.createdAt, 'dd MMM');
    if (trendMap[key]) {
      trendMap[key].orders += 1;
      trendMap[key].revenue += b.totalAmount;
    }
  }
  const trendData = Object.entries(trendMap).map(([date, v]) => ({ date, ...v }));

  const data = {
    revenue: revenueThisMonth._sum.totalAmount ?? 0,
    activeBookings,
    pendingPayment,
    totalUsers,
    recentBookings,
    trendData,
  };

  return <DashboardClient data={data} />;
}