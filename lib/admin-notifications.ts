import { prisma } from '@/lib/prisma';

const HOURS = 24;
const RECENT = 3;

export interface AdminNotification {
  key: string;
  type: string;
  title: string;
  msg: string;
  time: string;
  unread: boolean;
  href: string;
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.abs(n));
}

export async function getAdminNotifications(userId: string): Promise<{ items: AdminNotification[]; unreadCount: number }> {
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const [recentPayments, recentBookings, readRows] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'settlement', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: RECENT,
      include: {
        booking: { select: { orderNumber: true, bookingType: true, routeLabel: true, hotelName: true } },
      },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: RECENT,
      select: {
        id: true,
        orderNumber: true,
        bookingType: true,
        status: true,
        routeLabel: true,
        hotelName: true,
        totalAmount: true,
        createdAt: true,
      },
    }),
    prisma.adminNotificationRead.findMany({
      where: { userId },
      select: { key: true },
    }),
  ]);

  const readKeys = new Set(readRows.map((r) => r.key));
  const items: AdminNotification[] = [];

  for (const p of recentPayments) {
    const key = `pay-${p.id}`;
    items.push({
      key,
      type: 'payment',
      title: 'Pembayaran Masuk',
      msg: `${p.booking?.orderNumber || p.orderId} — ${fmtRp(p.amount)} settlement`,
      time: p.createdAt.toISOString(),
      unread: !readKeys.has(key),
      href: `/admin/bookings/${p.bookingId}`,
    });
  }

  for (const b of recentBookings) {
    const key = `bk-${b.id}`;
    const label = b.routeLabel || b.hotelName || b.bookingType;
    items.push({
      key,
      type: 'booking',
      title: 'Pesanan Baru',
      msg: `${b.orderNumber} — ${label} • ${fmtRp(b.totalAmount)}`,
      time: b.createdAt.toISOString(),
      unread: !readKeys.has(key),
      href: `/admin/bookings/${b.id}`,
    });
  }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const capped = items.slice(0, 10);

  return { items: capped, unreadCount: capped.filter((i) => i.unread).length };
}

export async function markNotificationsRead(userId: string, keys: string[]): Promise<{ count: number }> {
  const unique = [...new Set(keys)];
  if (!unique.length) return { count: 0 };
  const result = await prisma.adminNotificationRead.createMany({
    data: unique.map((key) => ({ userId, key })),
    skipDuplicates: true,
  });
  return { count: result.count };
}
