/**
 * Pencocokan kontak tamu (email / nomor telepon) terhadap data pesanan.
 *
 * Dipakai tiga rute tamu: /api/booking/find, /api/booking/guest-detail,
 * dan /api/booking/guest-check-payment — satu logika, satu sumber kebenaran.
 *
 * Pendekatan presisi: kandidat email/telepon diekstrak dari JSON data pemesan
 * lalu dibandingkan per-kandidat — email persis (case-insensitive), telepon
 * ternormalisasi (08xx ↔ 628xx). Substring mentah HANYA jadi fallback
 * kompatibilitas bila tidak ada kandidat terekstrak (format tak lazim),
 * sehingga kasus lama tidak rusak tetapi angka sebagian dari nomor yang lebih
 * panjang tidak lagi dianggap cocok (false positive lama hilang).
 */

/** Normalize phone to digits-only with 62 prefix (e.g. 08123 → 628123, +628123 → 628123) */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  return '62' + digits.replace(/^0/, '');
}

export type ContactMatchResult =
  | { ok: true }
  | { ok: false; reason: 'invalid-input' }
  | { ok: false; reason: 'mismatch' };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_RE = /\+?\d[\d\s\-().]{7,}\d/g;

/**
 * Cocokkan input tamu (email ATAU telepon) terhadap bookingData + passengerData.
 *
 * - `invalid-input`: input kosong, atau telepon dengan < 10 digit ternormalisasi.
 * - `mismatch`: data ada tapi kontak tidak cocok.
 * Caller menentukan status HTTP-nya sendiri (400 vs 403) dan pesannya.
 */
export function matchGuestContact(
  inputRaw: string,
  bookingData: unknown,
  passengerData: unknown,
): ContactMatchResult {
  const input = typeof inputRaw === 'string' ? inputRaw.trim() : '';
  if (!input) return { ok: false, reason: 'invalid-input' };

  const allDataStr = JSON.stringify(bookingData ?? {}) + JSON.stringify(passengerData ?? {});

  if (input.includes('@')) {
    const email = input.toLowerCase();
    const candidates = allDataStr.match(EMAIL_RE) || [];
    if (candidates.some((c) => c.toLowerCase() === email)) return { ok: true };
    // Fallback kompatibilitas: hanya bila tidak ada email terekstrak sama sekali
    // (mis. alamat di luar format regex, tanpa TLD).
    if (candidates.length === 0 && allDataStr.toLowerCase().includes(email)) return { ok: true };
    return { ok: false, reason: 'mismatch' };
  }

  const clean = normalizePhone(input);
  if (clean.length < 10) return { ok: false, reason: 'invalid-input' };

  const candidates = allDataStr.match(PHONE_CANDIDATE_RE) || [];
  if (candidates.some((c) => normalizePhone(c) === clean)) return { ok: true };
  // Fallback kompatibilitas: hanya bila tidak ada kandidat digit panjang terekstrak.
  if (candidates.length === 0) {
    const local = clean.replace(/^62/, '0');
    if (
      allDataStr.includes(local) ||
      allDataStr.includes(clean) ||
      allDataStr.includes('+' + clean)
    ) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'mismatch' };
}
