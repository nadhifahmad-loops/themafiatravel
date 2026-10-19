import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/security';

export async function linkGuestBookingsToUser(email: string, userId: string): Promise<number> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return 0;

  return prisma.$executeRaw`
    UPDATE "Booking"
    SET "userId" = ${userId}
    WHERE "userId" IS NULL
      AND (
        lower(btrim("bookingData"->'booker'->>'email')) = ${normalizedEmail}
        OR lower(btrim("bookingData"->'contacts'->0->>'email')) = ${normalizedEmail}
        OR lower(btrim("bookingData"->'contact'->0->>'email')) = ${normalizedEmail}
        OR lower(btrim("bookingData"->'contact'->>'email')) = ${normalizedEmail}
        OR lower(btrim("passengerData"->0->>'email')) = ${normalizedEmail}
      )
  `;
}
