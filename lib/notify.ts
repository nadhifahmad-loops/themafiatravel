// lib/notify.ts
// Resolusi target notifikasi (email/WA) dari sebuah booking.
// Prioritas: kontak checkout (bookingData.contacts/contact/booker) → penumpang pertama
// (passengerData) → akun terdaftar (booking.user). Guest booking tak punya user,
// jadi kontaknya hanya tersedia lewat JSON blobs.

export type BookingContact = {
  name: string;
  email: string;
  phone: string;
};

export function normalizePhone(raw: string, callingCode?: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (/^62/.test(digits)) return digits;
  return `${callingCode || '62'}${digits.replace(/^0/, '')}`;
}

type LooseContact = {
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  calling_code?: string;
  [key: string]: unknown;
};

export function getBookingContact(booking: {
  userId?: string | null;
  bookingData?: unknown;
  passengerData?: unknown;
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
}): BookingContact {
  const bd = (booking.bookingData ?? {}) as LooseContact;
  const rawContacts: unknown = bd.contacts ?? bd.contact ?? [];
  const contacts: LooseContact[] = Array.isArray(rawContacts)
    ? (rawContacts as LooseContact[])
    : [rawContacts as LooseContact];
  const contact = contacts[0] ?? null;
  const booker = (contact ?? bd.booker) as LooseContact | null;
  const pax = Array.isArray(booking.passengerData)
    ? (booking.passengerData[0] as LooseContact)
    : null;

  const name =
    (booker?.first_name ? `${booker.first_name} ${booker.last_name || ''}`.trim() : '') ||
    (pax?.first_name ? `${pax.first_name} ${pax.last_name || ''}`.trim() : '') ||
    booking.user?.name ||
    '';

  const email = booker?.email || pax?.email || booking.user?.email || '';

  const rawPhone = booker?.mobile || booker?.phone || pax?.mobile || '';
  const phone = rawPhone
    ? normalizePhone(String(rawPhone), booker?.calling_code || pax?.calling_code)
    : booking.user?.phone || '';

  return { name, email, phone };
}
