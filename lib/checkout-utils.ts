// ============================================================
// Utilitas validasi & pemrosesan data bersama untuk halaman checkout
// Dipakai oleh: flight, train, hotel, insurance
// ============================================================

// Membangun callbackUrl agar pengguna kembali ke halaman checkout yang sama
// setelah login/register. Query string wajib disertakan karena halaman checkout
// hotel/train/insurance membaca data dari parameter URL. Hasil sudah ter-encode
// sehingga siap ditempel langsung pada href (mis. `/login?callbackUrl=${cb}`).
export function buildCheckoutCallbackUrl(pathname: string, search?: string | null): string {
  const qs = (search || '').replace(/^\?/, '');
  return encodeURIComponent(pathname + (qs ? `?${qs}` : ''));
}

// Konversi Date → 'YYYY-MM-DD' memakai komponen tanggal LOKAL (bukan UTC).
// Dipakai agar memilih 27 Feb tidak tersimpan menjadi 26 Feb di zona WIB (UTC+7).
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Konversi 'YYYY-MM-DD' → Date pada tengah malam waktu LOKAL.
// Aman untuk date picker yang bekerja dengan waktu lokal.
export function parseLocalISODate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

export function isValidName(value: string): boolean {
  return value.trim().length >= 2;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidPhone(digits: string): boolean {
  const d = (digits || '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15;
}

export function isValidKtp(no: string): boolean {
  return /^\d{16}$/.test((no || '').replace(/\D/g, ''));
}

export function isValidPassport(no: string): boolean {
  return /^[A-Za-z0-9]{6,20}$/.test((no || '').trim());
}

export function isValidIdentityNumber(no: string, type: string): boolean {
  if (type === 'passport') return isValidPassport(no);
  if (type === 'sim') return no.length >= 12;
  if (type === 'other') return no.length >= 1;
  return isValidKtp(no);
}

export function isValidBirthDate(date: string): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

export function isValidPassportExpiry(date: string): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

// Parsing nomor HP tersimpan (mis. "6281234567890" / "081234567890")
// → { code, number } dengan code tanpa tanda '+'
export function parsePhoneWithCode(raw: string): { code: string; number: string } {
  if (!raw) return { code: '62', number: '' };
  const normalized = (raw || '').replace(/\D/g, '');
  if (!normalized) return { code: '62', number: '' };
  if (normalized.startsWith('0')) return { code: '62', number: normalized.slice(1) };
  if (normalized.startsWith('62') && normalized.length > 9) return { code: '62', number: normalized.slice(2) };
  if (normalized.startsWith('65')) return { code: '65', number: normalized.slice(2) };
  if (normalized.startsWith('60')) return { code: '60', number: normalized.slice(2) };
  if (normalized.startsWith('1') && normalized.length === 11) return { code: '1', number: normalized.slice(1) };
  if (normalized.startsWith('44')) return { code: '44', number: normalized.slice(2) };
  return { code: '62', number: normalized };
}

// Gabungkan calling code + nomor menjadi satu string angka (untuk payload/akun)
export function fullPhone(callingCode: string, number: string): string {
  const code = (callingCode || '').replace(/\D/g, '');
  const digits = (number || '').replace(/\D/g, '');
  return code + digits;
}

// Scroll halus ke elemen pertama yang error
export function scrollToFirstError(ids: string[]): void {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      return;
    }
  }
}
