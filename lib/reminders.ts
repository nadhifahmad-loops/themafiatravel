import { prisma } from '@/lib/prisma';
import { sendWhatsApp } from '@/lib/whatsapp';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { getBookingContact } from '@/lib/notify';

export type ReminderWindow = 'H-3' | 'H-1';

export function getReminderWindow(targetDate: Date, now: Date): ReminderWindow | null {
  const diffMs = targetDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (Math.abs(diffDays - 3) < 0.01) return 'H-3';
  if (Math.abs(diffDays - 1) < 0.01) return 'H-1';
  return null;
}

export async function sendTripReminders(now = new Date()) {
  const bookingDateCandidates = await prisma.booking.findMany({
    where: {
      status: 'paid',
      OR: [
        { departureDate: { not: null } },
        { checkinDate: { not: null } },
      ],
    },
    include: {
      user: {
        select: { id: true, email: true, name: true, phone: true },
      },
    },
  });

  const reminders: Array<{ bookingId: string; window: ReminderWindow }> = [];

  for (const booking of bookingDateCandidates) {
    const targetDate = booking.departureDate || booking.checkinDate;
    if (!targetDate) continue;

    const window = getReminderWindow(new Date(targetDate), now);
    if (!window) continue;

    reminders.push({ bookingId: booking.id, window });
  }

  for (const reminder of reminders) {
    const booking = bookingDateCandidates.find((item) => item.id === reminder.bookingId);
    if (!booking) continue;

    // Guest booking tanpa akun: kontak diambil dari bookingData/passengerData.
    const contact = getBookingContact(booking);
    if (!contact.email && !contact.phone) continue;

    const title = booking.hotelName || booking.routeLabel || booking.bookingType || 'pesanan';
    const message = `${title}\nReminder ${reminder.window}: perjalanan Anda akan segera dimulai. Silakan cek detail pesanan dan siapkan dokumen yang diperlukan.`;

    try {
      if (contact.email) {
        await sendBookingConfirmationEmail({
          to: contact.email,
          userName: contact.name || 'pelanggan',
          booking: {
            id: booking.id,
            orderNumber: booking.orderNumber,
            bookingType: booking.bookingType,
            routeLabel: booking.routeLabel,
            hotelName: booking.hotelName,
            totalAmount: booking.totalAmount,
            pnr: booking.pnr,
            provider: booking.provider,
          },
        });
      }

      if (contact.phone) {
        await sendWhatsApp(contact.phone, message);
      }
    } catch (error: unknown) {
      console.warn(`[Reminder] Failed for booking ${booking.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  return reminders;
}
