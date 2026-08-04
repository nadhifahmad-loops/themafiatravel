// lib/refund.ts
// Estimasi biaya pembatalan lokal (tanpa panggil Orbis API).
// Dipakai oleh route /api/bookings/[id]/refund-estimate DAN route cancel
// (flight/train/insurance) agar jumlah refund SELALU dihitung server-side,
// tidak pernah dipercaya dari body request.

import { bookingStore } from './store';
import { refundTransaction } from './midtrans';

export const REFUND_ADMIN_FEE = 50_000; // Biaya admin tetap
export const DEFAULT_REFUND_AUTO_MAX = 500_000; // Ambang nominal auto-refund flight

export function estimateRefundByType(bookingType: string, totalAmount: number) {
  let penaltyRate: number;

  switch (bookingType) {
    case 'flight':
      // Maskapai: 20% penalty + admin fee
      penaltyRate = 0.20;
      break;
    case 'train':
      // KAI: 10% admin fee (sudah termasuk admin, tidak ada penalty terpisah)
      return {
        penalty_fee: 0,
        admin_fee: Math.round(totalAmount * 0.10),
        estimated_refund_amount: Math.round(totalAmount * 0.90),
      };
    case 'insurance':
      // Asuransi: biasanya full refund dalam free-look period
      return {
        penalty_fee: 0,
        admin_fee: 0,
        estimated_refund_amount: totalAmount,
      };
    default:
      penaltyRate = 0.20;
  }

  const penaltyFee = Math.round(totalAmount * penaltyRate);
  const totalDeduction = penaltyFee + REFUND_ADMIN_FEE;
  const refundAmount = Math.max(0, totalAmount - totalDeduction);

  return {
    penalty_fee: penaltyFee,
    admin_fee: REFUND_ADMIN_FEE,
    estimated_refund_amount: refundAmount,
  };
}

export function getRefundAutoMax() {
  const raw = process.env.REFUND_AUTO_MAX;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFUND_AUTO_MAX;
}

export type RefundMode = 'auto' | 'manual';

// Keputusan auto vs manual (bisa diubah di satu tempat tanpa ubah route).
export function refundDecision(bookingType: string, amount: number, maxAuto: number = getRefundAutoMax()): RefundMode {
  switch (bookingType) {
    case 'insurance':
    case 'train':
      return 'auto';
    case 'flight':
      return amount <= maxAuto ? 'auto' : 'manual';
    case 'hotel':
    default:
      return 'manual';
  }
}

export function computeRefundAmount(booking: { bookingType: string; totalAmount: number }): number {
  const total = Number(booking.totalAmount ?? 0);
  if (booking.bookingType === 'hotel') {
    return Math.max(0, total);
  }
  return Math.max(0, estimateRefundByType(booking.bookingType, total).estimated_refund_amount);
}

export type RefundSettleResult = {
  mode: RefundMode;
  amount: number;
  auto: boolean;
  degraded?: boolean;
};

// Dipanggil SETELAH cancel vendor sukses. Menentukan auto vs manual:
// - auto   → refund Midtrans langsung + status 'cancelled'
// - manual → status 'refund_requested' (masuk antrian review admin)
// Jika refund auto gagal, degrade ke manual queue (jangan 502 — tiket sudah batal di vendor).
export async function settleRefundAfterCancel(
  booking: { id: string; bookingType: string; totalAmount: number },
  reason: string
): Promise<RefundSettleResult> {
  const amount = computeRefundAmount(booking);
  const mode = refundDecision(booking.bookingType, amount);

  if (mode === 'auto') {
    try {
      const midtrans = await refundTransaction(booking.id, amount, reason || 'Refund booking');
      await bookingStore.autoRefund(booking.id, { amount, reason: reason || 'Refund booking', midtrans });
      return { mode, amount, auto: true };
    } catch (err: unknown) {
      console.error('[Refund] Auto refund gagal, degrade ke manual queue:', err instanceof Error ? err.message : String(err));
      await bookingStore.requestRefund(booking.id, { amount, reason: reason || 'Refund booking' });
      return { mode: 'manual', amount, auto: false, degraded: true };
    }
  }

  await bookingStore.requestRefund(booking.id, { amount, reason: reason || 'Refund booking' });
  return { mode, amount, auto: false };
}

export class RefundExecutionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'RefundExecutionError';
    this.status = status;
  }
}

// Eksekusi refund manual oleh admin (dari antrian review).
export async function executeBookingRefund(bookingId: string, processedBy: string) {
  const booking = await bookingStore.findById(bookingId);
  if (!booking) {
    throw new RefundExecutionError(404, 'Booking tidak ditemukan.');
  }
  if (booking.status !== 'refund_requested') {
    throw new RefundExecutionError(400, `Status booking harus "refund_requested" (sekarang: ${booking.status}).`);
  }

  const refundRequestRaw = (booking.bookingData as Record<string, unknown> | null)?.refundRequest;
  const refundRequest = refundRequestRaw && typeof refundRequestRaw === 'object'
    ? (refundRequestRaw as Record<string, unknown>)
    : null;
  const amount = typeof refundRequest?.amount === 'number' && refundRequest.amount > 0
    ? refundRequest.amount
    : computeRefundAmount(booking);
  const reason = typeof refundRequest?.reason === 'string' && refundRequest.reason
    ? refundRequest.reason
    : 'Refund booking';

  const midtrans = await refundTransaction(booking.id, amount, reason);

  await bookingStore.completeRefund(booking.id, {
    amount,
    reason,
    midtrans,
    processedBy: `admin:${processedBy}`,
  });

  return { amount, midtrans };
}
