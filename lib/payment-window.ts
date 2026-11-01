/**
 * Batas waktu pembayaran — SATU sumber kebenaran untuk server & client.
 *
 * Hitungannya sejak `booking.createdAt` (saat booking dibuat), sama seperti
 * Traveloka: **1 jam**. Semua salinan `24 * 60 * 60 * 1000` yang tersebar di
 * route API & halaman dashboard dikonsolidasikan ke sini.
 *
 * Modul ini sengaja bebas Prisma/React sehingga aman diimpor dari route server
 * maupun komponen 'use client'.
 */

/** Durasi window pembayaran sejak booking dibuat (jam). */
export const PAYMENT_WINDOW_HOURS = 1;

/** Milidetik window pembayaran (1 jam). */
export const PAYMENT_TIMEOUT_MS = PAYMENT_WINDOW_HOURS * 60 * 60 * 1000;

/** Sisa waktu <= nilai ini → countdown diberi penanda merah (mendesak). */
export const PAYMENT_URGENCY_MS = 15 * 60 * 1000;

export type PaymentCountdown = {
  expired: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  /** Sisa milidetik; 0 saat sudah lewat. */
  total: number;
};

const EXPIRED_COUNTDOWN: PaymentCountdown = {
  expired: true,
  hours: 0,
  minutes: 0,
  seconds: 0,
  total: 0,
};

function toTime(value: string | Date | number): number {
  return typeof value === 'number' ? value : new Date(value).getTime();
}

/** Deadline pembayaran (epoch ms), atau null bila `createdAt` tidak valid. */
export function getPaymentDeadline(
  createdAt: string | Date | number | null | undefined
): number | null {
  if (createdAt === null || createdAt === undefined) return null;
  const created = toTime(createdAt);
  if (Number.isNaN(created)) return null;
  return created + PAYMENT_TIMEOUT_MS;
}

/** true bila window pembayaran sudah lewat (dihitung dari `createdAt`). */
export function isPaymentWindowPassed(
  createdAt: string | Date | number | null | undefined,
  now: number = Date.now()
): boolean {
  const deadline = getPaymentDeadline(createdAt);
  return deadline !== null && now >= deadline;
}

/** Sisa waktu bayar (jam:menit:detik) dari `createdAt`. */
export function getPaymentCountdown(
  createdAt: string | Date | number | null | undefined,
  now: number = Date.now()
): PaymentCountdown {
  const deadline = getPaymentDeadline(createdAt);
  if (deadline === null) return EXPIRED_COUNTDOWN;

  const remaining = deadline - now;
  if (remaining <= 0) return EXPIRED_COUNTDOWN;

  return {
    expired: false,
    hours: Math.floor(remaining / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
    total: remaining,
  };
}
