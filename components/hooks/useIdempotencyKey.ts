'use client';
import { useCallback, useRef } from 'react';

/**
 * Menghasilkan UUID v4 untuk Idempotency-Key checkout.
 * `crypto.randomUUID` tersedia di semua browser modern (secure context);
 * fallback ditulis manual untuk environment lama / non-secure context.
 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // versi 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * SATU key per attempt checkout.
 *
 * Key dibuat sekali saat halaman mount dan TIDAK berubah antar klik — karena
 * itulah dua klik cepat dikirim dengan key yang sama sehingga server bisa
 * mengenali keduanya sebagai satu permintaan.
 *
 * Panggil `regenerate()` HANYA setelah server memberi respons kegagalan yang
 * final (validasi / price changed / 5xx). Alasannya:
 *   • server sudah melepas klaimnya → percobaan berikutnya harus mulai segar;
 *   • JANGAN regenerate bila request gagal di level jaringan (timeout /
 *     Failed to fetch) — bisa jadi request pertama justru SUDAH sukses di
 *     server, dan key yang sama akan membalas `duplicate: true` dengan orderId
 *     yang benar alih-alih membuat order kedua.
 */
export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null);
  if (keyRef.current === null) keyRef.current = newIdempotencyKey();

  const getKey = useCallback(() => keyRef.current as string, []);
  const regenerate = useCallback(() => {
    keyRef.current = newIdempotencyKey();
    return keyRef.current;
  }, []);

  return { getKey, regenerate };
}
