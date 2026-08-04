import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import FinanceClient from './FinanceClient';
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export const metadata: Metadata = { title: 'Laporan Keuangan' };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const now = new Date();

  // Parse selected month (format: "2026-05") or default to current month
  let selectedDate = now;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number);
    selectedDate = new Date(y, m - 1, 1);
  }

  const startCurrent = startOfMonth(selectedDate);
  const endCurrent = endOfMonth(selectedDate);
  const startPrevious = startOfMonth(subMonths(selectedDate, 1));
  const endPrevious = endOfMonth(subMonths(selectedDate, 1));
  const startYear = startOfYear(selectedDate);

  const [currentBookings, yearBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: ['paid', 'issued'] },
        createdAt: { gte: startCurrent, lte: endCurrent },
      },
      select: {
        id: true,
        totalAmount: true,
        bookingType: true,
        createdAt: true,
        hotelName: true,
        routeLabel: true,
        user: { select: { name: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ['paid', 'issued'] },
        createdAt: { gte: startYear, lte: endCurrent },
      },
      select: { totalAmount: true, createdAt: true },
    }),
  ]);

  const prevRevenueAgg = await prisma.booking.aggregate({
    _sum: { totalAmount: true },
    where: {
      status: { in: ['paid', 'issued'] },
      createdAt: { gte: startPrevious, lte: endPrevious },
    },
  });

  const currentRevenue = currentBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const previousRevenue = prevRevenueAgg._sum.totalAmount || 0;
  const estimatedProfit = currentRevenue * 0.08;

  const summary = {
    currentRevenue,
    previousRevenue,
    estimatedProfit,
    totalTransactions: currentBookings.length,
  };

  const months: { name: string; revenue: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const start = startOfMonth(new Date(selectedDate.getFullYear(), m, 1));
    const name = format(start, 'MMM');
    months.push({ name, revenue: 0 });
  }
  for (const b of yearBookings) {
    const idx = new Date(b.createdAt).getMonth();
    months[idx].revenue += b.totalAmount;
  }

  const chartData = months.map((d) => ({ name: d.name, revenue: d.revenue, profit: Math.round(d.revenue * 0.08) }));

  const recentTransactions = currentBookings.slice(0, 50).map((b) => ({
    id: b.id,
    createdAt: b.createdAt,
    totalAmount: b.totalAmount,
    bookingType: b.bookingType,
    customerName: b.user?.name || '-',
    label: b.hotelName || b.routeLabel || '-',
  }));

  // Build list of available months (distinct months with transactions)
  // Dibatasi `take` supaya query tetap terikat saat volume transaksi membesar.
  const allPaidBookings = await prisma.booking.findMany({
    where: { status: { in: ['paid', 'issued'] } },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 12000,
  });
  const monthSet = new Set<string>();
  for (const b of allPaidBookings) {
    const d = b.createdAt;
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  // Always include selected month
  const selectedKey = format(startCurrent, 'yyyy-MM');
  monthSet.add(selectedKey);
  const availableMonths = Array.from(monthSet).sort().reverse();

  return (
    <FinanceClient
      summary={summary}
      recentTransactions={recentTransactions}
      chartData={chartData}
      currentYear={selectedDate.getFullYear()}
      currentMonth={format(startCurrent, 'MMMM yyyy', { locale: localeId })}
      selectedMonth={selectedKey}
      availableMonths={availableMonths}
    />
  );
}
