import { randomBytes } from 'crypto';

// ─── Security helpers ─────────────────────────────────────────────────────────

// FIX (Bug #2 — IDOR/enumeration): ID booking sebelumnya dibuat dari `Date.now()`
// saja (mis. `TMT-FLT-1735900000000`), yang sepenuhnya predictable — siapapun yang
// tahu kira-kira jam booking dibuat bisa menebak/brute-force ID yang valid, dan dua
// request di milidetik yang sama bisa collision. Fungsi ini tetap menyertakan
// timestamp (agar ID tetap urut & mudah dibaca untuk debugging) tapi menambahkan
// 6 byte random (48 bit, ~2.8 * 10^14 kemungkinan) sehingga tidak bisa ditebak.
export function generateBookingId(prefix: 'FLT' | 'HTL' | 'TRN' | 'INS'): string {
  const random = randomBytes(6).toString('hex'); // 12 hex char, cryptographically random
  return `TMT-${prefix}-${Date.now()}-${random}`;
}

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

// Normalisasi email: trim + lowercase untuk mencegah akun duplikat (kasus huruf berbeda)
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Ambil IP klien dari headers, mendukung web-standard `Headers` maupun plain object
// (mis. `req.headers` pada callback `authorize` milik NextAuth).
//
// FIX (Bug #4 — rate limit bypass): `x-forwarded-for` bisa diisi bebas oleh client
// jika request tidak lewat proxy tepercaya yang menimpa header ini — artinya
// penyerang bisa spoof IP baru di tiap request untuk melewati rate limit
// login/booking/forgot-password. Di Vercel, `x-vercel-forwarded-for` di-set oleh
// edge network Vercel sendiri (menimpa nilai dari client), jadi lebih bisa
// dipercaya — kita pakai itu dulu sebelum fallback ke `x-forwarded-for`.
// Catatan: jika self-hosted (bukan Vercel), pastikan reverse proxy (nginx dll)
// SELALU menimpa `x-forwarded-for`, bukan meneruskan header dari client mentah.
export function getRequestIp(headers?: HeaderSource): string {
  if (!headers) return 'unknown';

  const read = (key: string): string | undefined => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(key) ?? undefined;
    }
    const value = (headers as Record<string, string | string[] | undefined>)[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const trustedVercel = read('x-vercel-forwarded-for');
  if (trustedVercel) return trustedVercel.split(',')[0].trim();

  const forwarded = read('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return read('x-real-ip') || 'unknown';
}

// Proteksi open redirect dipindah ke lib/safe-callback.ts agar bisa di-import
// komponen client tanpa ikut menarik modul Node `crypto`.
export { safeCallbackUrl } from './safe-callback';
