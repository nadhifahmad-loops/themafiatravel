export interface BookingLike {
  userId: string | null | undefined;
  bookingData?: unknown;
}

export interface AccessClaim {
  sessionUserId?: string | null;
  sessionEmail?: string | null;
  isAdmin?: boolean;
  bookerEmail?: string;
}

const norm = (e?: string | null) => (e ?? '').trim().toLowerCase();

function storedBookingEmails(booking: BookingLike): string[] {
  const emails: string[] = [];
  const bd = (booking.bookingData ?? {}) as Record<string, unknown>;
  const booker = bd?.booker && typeof bd.booker === 'object' ? (bd.booker as Record<string, unknown>) : null;
  if (typeof booker?.email === 'string') emails.push(booker.email);
  const rawContacts: unknown[] = Array.isArray(bd?.contacts)
    ? (bd.contacts as unknown[])
    : Array.isArray(bd?.contact)
      ? (bd.contact as unknown[])
      : bd?.contact && typeof bd.contact === 'object'
        ? [bd.contact]
        : [];
  for (const c of rawContacts) {
    if (c && typeof c === 'object') {
      const email = (c as Record<string, unknown>).email;
      if (typeof email === 'string') emails.push(email);
    }
  }
  return emails;
}

function hasMatchingEmail(emails: string[], email?: string | null): boolean {
  const target = norm(email);
  return !!target && emails.some((e) => norm(e) === target);
}

/**
 * Verifikasi bahwa pemanggil berhak mengelola (mis. membatalkan) sebuah booking.
 * - Booking milik user (userId terisi): hanya pemiliknya atau admin.
 * - Booking guest (userId null): pemesan tidak punya akun sehingga harus
 *   terbukti lewat email pemesan — cocokkan session email atau booker_email
 *   yang dikirim body dengan email yang tersimpan di bookingData.
 * Admin selalu diperbolehkan.
 */
export function canManageBooking(booking: BookingLike, claim: AccessClaim): boolean {
  if (booking.userId) {
    if (claim.isAdmin) return true;
    return !!claim.sessionUserId && claim.sessionUserId === booking.userId;
  }

  if (claim.isAdmin) return true;
  const emails = storedBookingEmails(booking);
  if (claim.bookerEmail) return hasMatchingEmail(emails, claim.bookerEmail);
  return hasMatchingEmail(emails, claim.sessionEmail);
}