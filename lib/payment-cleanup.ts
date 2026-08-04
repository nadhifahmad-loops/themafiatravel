import { flightAPI, trainAPI, hotelAPI, insuranceAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function releaseVendorHold(
  booking: {
    id: string;
    bookingType: string;
    orderNumber: string;
    pnr?: string | null;
    provider?: string | null;
  },
  options?: { maxAttempts?: number; baseDelayMs?: number }
) {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bookingStore.mergeBookingData(booking.id, {
        bookingData: {
          cleanup: {
            status: 'pending',
            attempts: attempt,
            lastAttemptAt: new Date().toISOString(),
          },
        },
      });

      if (booking.bookingType === 'flight') {
        await flightAPI.cancelVoid(booking.orderNumber);
      } else if (booking.bookingType === 'train') {
        await trainAPI.cancelBooking(booking.orderNumber);
      } else if (booking.bookingType === 'hotel') {
        await hotelAPI.cancelBooking(booking.orderNumber, booking.pnr || booking.orderNumber, booking.provider || '');
      } else if (booking.bookingType === 'insurance') {
        await insuranceAPI.cancelBooking(booking.orderNumber);
      } else {
        console.log(`[Payment Cleanup] No vendor cleanup action defined for bookingType=${booking.bookingType}`);
      }

      await bookingStore.mergeBookingData(booking.id, {
        bookingData: {
          cleanup: {
            status: 'succeeded',
            attempts: attempt,
            lastAttemptAt: new Date().toISOString(),
            lastError: null,
          },
        },
      });

      console.log(`[Payment Cleanup] Vendor release succeeded for ${booking.bookingType} order=${booking.orderNumber}`);
      return { success: true, attempts: attempt };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown cleanup error';
      console.warn(`[Payment Cleanup] Attempt ${attempt}/${maxAttempts} failed for ${booking.bookingType} order=${booking.orderNumber}:`, message);

      await bookingStore.mergeBookingData(booking.id, {
        bookingData: {
          cleanup: {
            status: 'failed',
            attempts: attempt,
            lastAttemptAt: new Date().toISOString(),
            lastError: message,
          },
        },
      });

      if (attempt < maxAttempts) {
        await delay(baseDelayMs * attempt);
      }
    }
  }

  return { success: false, attempts: maxAttempts };
}
