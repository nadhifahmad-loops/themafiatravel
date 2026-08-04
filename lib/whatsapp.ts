// ─── WhatsApp API Client (Fonnte) ────────────────────────────────────────────
// Dokumentasi: https://docs.fonnte.com/
// Env: FONNTE_API_TOKEN

import { randomInt } from 'node:crypto';

const FONNTE_API_URL = 'https://api.fonnte.com/send';

/**
 * Kirim pesan WhatsApp via Fonnte API
 * @param phone - Nomor tujuan full international (e.g. "6281234567890", "14155551234")
 * @param message - Isi pesan
 */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const token = process.env.FONNTE_API_TOKEN;
  if (!token) {
    console.error('[WhatsApp] FONNTE_API_TOKEN tidak dikonfigurasi');
    return false;
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

    const data = await res.json();

    if (data.status === true || data.success === true) {
      console.log('[WhatsApp] Pesan terkirim ke:', phone);
      return true;
    }

    console.error('[WhatsApp] Gagal kirim:', data);
    return false;
  } catch (err) {
    console.error('[WhatsApp] Error:', err);
    return false;
  }
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
