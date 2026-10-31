// lib/ticket-verify.ts
// Fungsi verifikasi dokumen yang aman dipakai di server maupun client.
// Tidak boleh mengimpor modul Node apa pun.

export function genVerificationHash(id: string): string {
  let hash = 0;
  const str = `TMT-VERIFY-${id}-2024`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `TMT-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function verifyUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://themafiatravel.com').replace(/\/+$/, '');
  return `${base}/verify/${encodeURIComponent(id)}?h=${genVerificationHash(id)}`;
}

export function verifyPath(id: string): string {
  return `/verify/${encodeURIComponent(id)}?h=${genVerificationHash(id)}`;
}
