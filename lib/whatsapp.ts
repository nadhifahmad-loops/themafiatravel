// ─── WhatsApp API Client (Fonnte) ────────────────────────────────────────────
// Dokumentasi: https://docs.fonnte.com/
// Env: FONNTE_API_TOKEN

import { randomInt } from 'node:crypto';

const FONNTE_API_URL = 'https://api.fonnte.com/send';

export type WhatsAppSendResult =
  | { success: true }
  | { success: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Kirim pesan WhatsApp via Fonnte API
 * @param phone - Nomor tujuan full international (e.g. "6281234567890", "14155551234")
 * @param message - Isi pesan
 */
export async function sendWhatsAppWithResult(phone: string, message: string): Promise<WhatsAppSendResult> {
  const token = process.env.FONNTE_API_TOKEN;
  if (!token) {
    console.error('[WhatsApp] FONNTE_API_TOKEN tidak dikonfigurasi');
    return { success: false, reason: 'FONNTE_API_TOKEN tidak dikonfigurasi' };
  }

  try {
    const res = await fetch(FONNTE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({
        target: phone,
        message,
      }),
    });

    const payload: unknown = await res.json();
    const data = isRecord(payload) ? payload : {};

    if (res.ok && (data.status === true || data.success === true)) {
      console.log('[WhatsApp] Pesan terkirim ke:', phone);
      return { success: true };
    }

    const reason = typeof data.reason === 'string'
      ? data.reason
      : `Provider menolak pengiriman (HTTP ${res.status})`;
    console.error('[WhatsApp] Gagal kirim:', { status: res.status, reason, requestid: data.requestid });
    return { success: false, reason };
  } catch (err) {
    console.error('[WhatsApp] Error:', err);
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'Kesalahan saat menghubungi provider WhatsApp',
    };
  }
}

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const result = await sendWhatsAppWithResult(phone, message);
  return result.success;
}

/**
 * Generate kode OTP 6 digit acak
 */
export function generateOTP(): string {
  return randomInt(100_000, 1_000_000).toString();
}

/**
 * Format pesan OTP untuk WhatsApp
 */
export function formatOTPPrefix(): string {
  return '[Mafia Travel] ';
}

export function formatOTPMessage(code: string, purpose: string = 'verifikasi nomor telepon'): string {
  return `${formatOTPPrefix()}Kode verifikasi kamu adalah: *${code}*\n\nKode ini berlaku dalam 5 menit. Jangan bagikan kode ini kepada siapapun.\n\nGunakan untuk ${purpose}.`;
}

export function formatBookingConfirmationMessage(booking: {
  orderNumber?: string | null;
  bookingType?: string | null;
  routeLabel?: string | null;
  hotelName?: string | null;
  totalAmount?: number | null;
  pnr?: string | null;
}): string {
  const title = booking.hotelName || booking.routeLabel || booking.bookingType || 'pesanan';
  const orderNumber = booking.orderNumber || 'pesanan';
  const amount = booking.totalAmount ? `Rp ${booking.totalAmount.toLocaleString('id-ID')}` : 'tertera di detail pesanan';
  const pnr = booking.pnr ? `\nPNR: ${booking.pnr}` : '';

  return `${formatOTPPrefix()}Pembayaran berhasil untuk pesanan ${orderNumber}.\n\nDetail: ${title}\nTotal: ${amount}${pnr}\n\nSilakan cek akun Anda untuk melihat detail tiket atau pesanan.`;
}
