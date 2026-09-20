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

interface GuestProofBooking {
  orderNumber?: string | null;
  userId?: string | null;
  bookingData?: unknown;
  passengerData?: unknown;
}

function normalizePhoneForMatch(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  return '62' + digits.replace(/^0/, '');
}

/**
 * Bukti kepemilikan ala guest flow (find-booking): orderNumber + email/HP yang
 * cocok dengan isi bookingData/passengerData. Dipakai endpoint yang bisa
 * diakses tamu (ubah kursi / lihat peta kursi) agar konsisten dengan verifikasi
 * tampilan di /find-booking/[id]. Booking milik user login tidak lolos jalur ini
 * — mereka tetap diverifikasi lewat session (canManageBooking).
 */
export function verifyGuestBookingProof(
  booking: GuestProofBooking,
  orderNumber?: string | null,
  phone?: string | null
): boolean {
  if (!orderNumber || !phone || booking.userId) return false;
  const storedOrder = (booking.orderNumber ?? '').trim().toLowerCase();
  if (!storedOrder || storedOrder !== String(orderNumber).trim().toLowerCase()) return false;

  const inputStr = String(phone).trim();
  if (!inputStr) return false;

  const bd = booking.bookingData ?? {};
  const pd = booking.passengerData ?? {};
  const allDataStr = JSON.stringify(bd) + JSON.stringify(pd);

  const isEmail = inputStr.includes('@');
  if (isEmail) return allDataStr.toLowerCase().includes(inputStr.toLowerCase());

  const cleanInput = normalizePhoneForMatch(inputStr);
  if (cleanInput.length < 10) return false;
  const localFormat = cleanInput.replace(/^62/, '0');
  return allDataStr.includes(localFormat)
    || allDataStr.includes(cleanInput)
    || allDataStr.includes('+' + cleanInput)
    || allDataStr.includes(cleanInput.replace(/^62/, ''));
}