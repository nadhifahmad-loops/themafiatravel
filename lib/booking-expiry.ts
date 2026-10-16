import { prisma } from '@/lib/prisma';
import { bookingStore } from '@/lib/store';
import { releaseVendorHold } from '@/lib/payment-cleanup';
import { cleanupIdempotencyKeys } from '@/lib/idempotency';

const PAYMENT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function getExpiryWindow(createdAt: Date, now: Date): boolean {
  return createdAt.getTime() + PAYMENT_TIMEOUT_MS <= now.getTime();
}

export async function expireUnpaidBookings(now = new Date()) {
  const cutoff = new Date(now.getTime() - PAYMENT_TIMEOUT_MS);

  const expiredBookings = await prisma.booking.findMany({
    where: {
      status: 'pending_payment',
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const booking of expiredBookings) {
    try {
      await bookingStore.updateStatus(booking.id, 'payment_failed', {
        paymentStatus: 'expire',
      });

      await bookingStore.mergeBookingData(booking.id, {
        bookingData: {
          expiry: {
            reason: 'payment_window_expired',
            expiredAt: now.toISOString(),
          },
        },
      });

      await releaseVendorHold(
        {
          id: booking.id,
          bookingType: booking.bookingType,
          orderNumber: booking.orderNumber,
          pnr: booking.pnr,
          provider: booking.provider,
        },
        { maxAttempts: 2, baseDelayMs: 1000 }
      );
    } catch (error: unknown) {
      console.warn(`[Booking Expiry] Failed for booking ${booking.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Baris IdempotencyKey juga dibuang agar tidak menumpuk (key sudah lewat
  // masa replay-nya). `processing` yang masih dalam masa reclaim TIDAK ikut
  // dihapus — lihat catatan di lib/idempotency.ts.
  await cleanupIdempotencyKeys(now);

  return expiredBookings.map((booking) => ({ id: booking.id, orderNumber: booking.orderNumber }));
}
