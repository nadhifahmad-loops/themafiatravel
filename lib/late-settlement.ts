import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bookingStore } from '@/lib/store';
import { releaseVendorHold } from '@/lib/payment-cleanup';
import { isPaymentWindowPassed } from '@/lib/payment-window';

type LateSettlementInput = {
  booking: {
    id: string;
    status: string;
    bookingType: string;
    orderNumber: string;
    pnr: string | null;
    provider: string | null;
    totalAmount: number;
    createdAt: Date;
  };
  /** Status transaksi Midtrans asli ('settlement' | 'capture'). */
  transactionStatus: string;
  transactionId?: string | null;
  paymentType?: string | null;
  /** Payload notifikasi/query status Midtrans — disimpan sebagai audit. */
  midtransResponse: unknown;
};

/**
 * Penanganan pembayaran yang MASUK SETELAH batas window (lihat
 * lib/payment-window.ts). Booking sudah dianggap hangus, jadi:
 *
 *  • status TIDAK diubah menjadi `paid` (tiket tidak diterbitkan otomatis);
 *  • booking ditandai `payment_failed` + `paymentStatus = 'late_settlement'`
 *    supaya ketahuan dan bisa ditindaklanjuti manual (refund);
 *  • hold vendor tetap dirilis;
 *  • uangnya tetap tercatat di tabel Payment (audit trail).
 *
 * Dipanggil dari webhook Midtrans dan dari polling check-payment (member &
 * guest) — ketiganya dulu bisa sama-sama mengubah booking jadi `paid`.
 *
 * @returns true bila penanganan telat dilakukan → caller TIDAK melanjutkan
 *          alur normal ke status `paid`.
 */
export async function handleLateSettlement(input: LateSettlementInput): Promise<boolean> {
  const { booking } = input;

  if (!isPaymentWindowPassed(booking.createdAt)) return false;

  // Booking yang sudah paid/issued/refund tidak disentuh — transisi normal
  // (mis. notifikasi ulang) tetap berjalan seperti biasa.
  if (booking.status !== 'pending_payment' && booking.status !== 'payment_failed') {
    return false;
  }

  const claim = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      status: { in: ['pending_payment', 'payment_failed'] },
      // `paymentStatus` nullable: filter `{ not: ... }` Prisma diterjemahkan jadi
      // SQL `<>` yang mengecualikan baris NULL — baris kosong jadi tak tersentuh.
      // Karena itu NULL di-OR-kan secara eksplisit.
      OR: [{ paymentStatus: null }, { paymentStatus: { not: 'late_settlement' } }],
    },
    data: {
      status: 'payment_failed',
      paymentStatus: 'late_settlement',
      ...(input.transactionId && { paymentId: input.transactionId }),
      ...(input.paymentType && { paymentType: input.paymentType }),
    },
  });

  if (claim.count === 1) {
    console.warn(
      `[Late Settlement] Pembayaran telat — booking ${booking.orderNumber} (${booking.bookingType}) ` +
        'dicatat late_settlement, TIDAK diubah ke paid.'
    );

    // Window sudah lewat → hold vendor pasti sudah kedaluwarsa; rilis agar
    // tidak menggantung di sisi maskapai/hotel/kereta.
    try {
      await releaseVendorHold(
        {
          id: booking.id,
          bookingType: booking.bookingType,
          orderNumber: booking.orderNumber,
          pnr: booking.pnr,
          provider: booking.provider,
        },
        { maxAttempts: 3, baseDelayMs: 2000 }
      );
    } catch (releaseErr: unknown) {
      console.warn(
        '[Late Settlement] Vendor release failed (non-fatal):',
        releaseErr instanceof Error ? releaseErr.message : String(releaseErr)
      );
    }
  }

  // Audit trail: status Midtrans asli (uang diterima) dicatat di Payment,
  // sementara booking sendiri tetap tidak paid. Kalau baris Payment belum ada
  // (beberapa tipe booking baru dibuat saat halaman bayar dibuka), buat baru
  // supaya dana telat selalu ketahuan untuk ditindaklanjuti.
  try {
    await bookingStore.updatePayment(booking.id, {
      status: input.transactionStatus,
      ...(input.paymentType && { paymentType: input.paymentType }),
      midtransResponse: input.midtransResponse,
    });
  } catch {
    try {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          orderId: booking.id,
          amount: booking.totalAmount,
          status: input.transactionStatus,
          ...(input.paymentType && { paymentType: input.paymentType }),
          ...(input.midtransResponse
            ? { midtransResponse: input.midtransResponse as Prisma.InputJsonValue }
            : {}),
        },
      });
    } catch (paymentErr: unknown) {
      console.warn(
        '[Late Settlement] Payment audit failed (non-fatal):',
        paymentErr instanceof Error ? paymentErr.message : String(paymentErr)
      );
    }
  }

  return true;
}
