import { bookingStore } from './store';
import { refundTransaction } from './midtrans';

export const DEFAULT_REFUND_AUTO_MAX = 500_000; // Ambang nominal auto-refund flight

export function getRefundAutoMax() {
  const raw = process.env.REFUND_AUTO_MAX;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFUND_AUTO_MAX;
}

export type RefundMode = 'auto' | 'manual';

// Keputusan auto vs manual (bisa diubah di satu tempat tanpa ubah route).
export function refundDecision(bookingType: string, amount: number, maxAuto: number = getRefundAutoMax()): RefundMode {
  if (amount <= 0) return 'manual';
  switch (bookingType) {
    case 'flight':
      return amount <= maxAuto ? 'auto' : 'manual';
    case 'hotel':
    case 'train':
    case 'insurance':
    default:
      return 'manual';
  }
}

export type RefundSettleResult = {
  mode: RefundMode;
  amount: number | null;
  auto: boolean;
  degraded?: boolean;
};

// Dipanggil SETELAH cancel vendor sukses. Menentukan auto vs manual:
// - auto   → refund Midtrans langsung + status 'cancelled'
// - manual → status 'refund_requested' (masuk antrian review admin)
// Jika refund auto gagal, degrade ke manual queue (jangan 502 — tiket sudah batal di vendor).
export async function settleRefundAfterCancel(
  booking: { id: string; bookingType: string; totalAmount: number },
  reason: string,
  amountOverride?: number | null
): Promise<RefundSettleResult> {
  if (amountOverride !== null && amountOverride !== undefined
    && (!Number.isFinite(amountOverride) || amountOverride < 0)) {
    throw new Error('Nominal refund dari vendor tidak valid.');
  }
  const amount = amountOverride === null || amountOverride === undefined
    ? null
    : Math.round(amountOverride);
  if (amount !== null && amount > booking.totalAmount) {
    throw new Error('Nominal refund dari vendor melebihi total pembayaran booking.');
  }
  const mode = amount === null ? 'manual' : refundDecision(booking.bookingType, amount);

  if (mode === 'auto' && amount !== null) {
    let midtrans: unknown;
    try {
      midtrans = await refundTransaction(booking.id, amount, reason || 'Refund booking');
    } catch (err: unknown) {
      console.error('[Refund] Auto refund gagal, degrade ke manual queue:', err instanceof Error ? err.message : String(err));
      const queued = await bookingStore.requestRefund(booking.id, { amount, reason: reason || 'Refund booking' });
      if (!queued) throw new Error('Refund otomatis gagal dan booking tidak dapat dimasukkan ke antrean review.');
      return { mode: 'manual', amount, auto: false, degraded: true };
    }
    const updated = await bookingStore.autoRefund(booking.id, {
      amount,
      reason: reason || 'Refund booking',
      midtrans,
    });
    if (!updated) {
      throw new Error('Dana telah dikirim ke Midtrans, tetapi status booking gagal diperbarui. Perlu rekonsiliasi admin.');
    }
    return { mode, amount, auto: true };
  }

  const queued = await bookingStore.requestRefund(booking.id, { amount, reason: reason || 'Refund booking' });
  if (!queued) throw new Error('Booking tidak dapat dimasukkan ke antrean review refund.');
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
export async function executeBookingRefund(bookingId: string, processedBy: string, verifiedAmount: number) {
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
  const savedAmount = typeof refundRequest?.amount === 'number' && Number.isFinite(refundRequest.amount)
    ? refundRequest.amount
    : null;
  if (!Number.isFinite(verifiedAmount) || verifiedAmount < 0) {
    throw new RefundExecutionError(
      409,
      'Nominal refund belum dikonfirmasi. Verifikasi nominal pada respons/vendor terlebih dahulu sebelum memproses refund.'
    );
  }
  if (savedAmount !== null && Math.round(savedAmount) !== Math.round(verifiedAmount)) {
    throw new RefundExecutionError(
      409,
      'Nominal yang dimasukkan berbeda dari nominal vendor yang tersimpan. Perbarui/verifikasi data vendor terlebih dahulu.'
    );
  }
  const amount = Math.round(verifiedAmount);
  if (amount > booking.totalAmount) {
    throw new RefundExecutionError(400, 'Nominal refund tidak boleh melebihi total pembayaran booking.');
  }
  const reason = typeof refundRequest?.reason === 'string' && refundRequest.reason
    ? refundRequest.reason
    : 'Refund booking';

  const midtrans = amount === 0 ? null : await refundTransaction(booking.id, amount, reason);

  const completed = await bookingStore.completeRefund(booking.id, {
    amount,
    reason,
    midtrans,
    processedBy: `admin:${processedBy}`,
  });
  if (!completed) {
    throw new RefundExecutionError(409, 'Status booking berubah. Refund belum dapat dicatat, periksa kembali antrean.');
  }

  return { amount, midtrans, noRefund: amount === 0 };
}
