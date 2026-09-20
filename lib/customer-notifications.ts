import { prisma } from '@/lib/prisma';

const HOURS_24 = 24;
const HOURS_168 = 7 * 24; // 1 minggu

export interface CustomerNotification {
  key: string;
  type: 'payment' | 'booking' | 'reminder' | 'expired';
  title: string;
  msg: string;
  time: string;
  unread: boolean;
  href: string;
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.abs(n));
}

function routeLabel(b: { routeLabel?: string | null; hotelName?: string | null; bookingType: string; origin?: string | null; destination?: string | null }) {
  return b.routeLabel || b.hotelName || (b.origin && b.destination ? `${b.origin} → ${b.destination}` : b.bookingType);
}

function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return diff / (1000 * 60 * 60 * 24);
}

export async function getCustomerNotifications(userId: string): Promise<{ items: CustomerNotification[]; unreadCount: number }> {
  const since24h = new Date(Date.now() - HOURS_24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - HOURS_168 * 60 * 60 * 1000);

  const [recentPayments, recentBookings, reminderBookings, expiredBookings, readRows] = await Promise.all([
    // Pembayaran berhasil (24 jam terakhir)
    prisma.payment.findMany({
      where: {
        status: 'settlement',
        createdAt: { gte: since24h },
        booking: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        booking: { select: { id: true, orderNumber: true, routeLabel: true, hotelName: true, bookingType: true, origin: true, destination: true } },
      },
    }),
    // Pesanan baru (24 jam terakhir)
    prisma.booking.findMany({
      where: { userId, createdAt: { gte: since24h } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, orderNumber: true, bookingType: true, routeLabel: true, hotelName: true,
        totalAmount: true, origin: true, destination: true, createdAt: true,
      },
    }),
    // Reminder: booking berangkat dalam 1-7 hari
    prisma.booking.findMany({
      where: {
        userId,
        status: { in: ['paid', 'issued'] },
        departureDate: { not: null, gte: new Date(), lte: new Date(Date.now() + HOURS_168 * 60 * 60 * 1000) },
      },
      select: {
        id: true, orderNumber: true, bookingType: true, routeLabel: true, hotelName: true,
        departureDate: true, origin: true, destination: true,
      },
    }),
    // Booking kedaluwarsa (pending > 24 jam, 7 hari terakhir)
    prisma.booking.findMany({
      where: {
        userId,
        status: 'payment_failed',
        createdAt: { gte: since7d },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true, orderNumber: true, bookingType: true, routeLabel: true, hotelName: true,
        totalAmount: true, origin: true, destination: true, createdAt: true,
      },
    }),
    // Read status
    prisma.customerNotificationRead.findMany({
      where: { userId },
      select: { key: true },
    }),
  ]);

  const readKeys = new Set(readRows.map((r) => r.key));
  const items: CustomerNotification[] = [];

  // 1. Pembayaran berhasil
  for (const p of recentPayments) {
    const key = `pay-${p.id}`;
    items.push({
      key,
      type: 'payment',
      title: 'Pembayaran Diterima',
      msg: `${p.booking?.orderNumber || ''} — ${fmtRp(p.amount)}`,
      time: p.createdAt.toISOString(),
      unread: !readKeys.has(key),
      href: `/bookings/${p.bookingId}`,
    });
  }

  // 2. Pesanan baru
  for (const b of recentBookings) {
    const key = `bk-${b.id}`;
    items.push({
      key,
      type: 'booking',
      title: 'Pesanan Baru',
      msg: `${b.orderNumber} — ${routeLabel(b)} • ${fmtRp(b.totalAmount)}`,
      time: b.createdAt.toISOString(),
      unread: !readKeys.has(key),
      href: `/bookings/${b.id}`,
    });
  }

  // 3. Reminder H-3 / H-1
  for (const b of reminderBookings) {
    if (!b.departureDate) continue;
    const days = daysUntil(b.departureDate);
    let window: string | null = null;
    if (days >= 0.9 && days <= 1.1) window = 'H-1';
    else if (days >= 2.8 && days <= 3.2) window = 'H-3';
    else if (days >= 6.5 && days <= 7.5) window = 'H-7';

    if (window) {
      const key = `remind-${window.toLowerCase()}-${b.id}`;
      items.push({
        key,
        type: 'reminder',
        title: `Reminder ${window}`,
        msg: `${b.orderNumber} — ${routeLabel(b)} berangkat ${window}`,
        time: b.departureDate.toISOString(),
        unread: !readKeys.has(key),
        href: `/bookings/${b.id}`,
      });
    }
  }

  // 4. Booking kedaluwarsa
  for (const b of expiredBookings) {
    const key = `expired-${b.id}`;
    items.push({
      key,
      type: 'expired',
      title: 'Pesanan Kedaluwarsa',
      msg: `${b.orderNumber} — ${routeLabel(b)} melewati batas pembayaran`,
      time: b.createdAt.toISOString(),
      unread: !readKeys.has(key),
      href: `/bookings/${b.id}`,
    });
  }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const capped = items.slice(0, 10);

  return { items: capped, unreadCount: capped.filter((i) => i.unread).length };
}

export async function markCustomerNotificationsRead(userId: string, keys: string[]): Promise<{ count: number }> {
  const unique = [...new Set(keys)];
  if (!unique.length) return { count: 0 };
  const result = await prisma.customerNotificationRead.createMany({
    data: unique.map((key) => ({ userId, key })),
    skipDuplicates: true,
  });
  return { count: result.count };
}
