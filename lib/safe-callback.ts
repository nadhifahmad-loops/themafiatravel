// lib/safe-callback.ts
// Helper kecil yang aman dipakai di client maupun server (tanpa import Node).

// Proteksi open redirect: hanya izinkan URL relatif internal (mis. /account, /checkout).
// Menolak `//evil.com`, `/\evil.com`, maupun URL absolut.
export function safeCallbackUrl(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
