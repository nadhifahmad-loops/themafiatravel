import { NextRequest, NextResponse } from 'next/server';
import { verifyMidtransNotification } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';

/**
 * Midtrans Webhook — POST /api/payment/notification
 *
 * Midtrans mengirim notifikasi ke sini saat status transaksi berubah.
 * Endpoint ini harus:
 * 1. Verifikasi signature key
 * 2. Map transaction_status → status internal kita
 * 3. Update tabel Booking
 * 4. Update tabel Payment (audit trail)
 *
 * Referensi: https://docs.midtrans.com/reference/handling-notifications
 */
export async function POST(req: NextRequest) {
  try {
    const notification = await req.json();

    // ── 1. Verifikasi signature ───────────────────────────────────────────────
    if (!verifyMidtransNotification(notification)) {
      console.warn('[Payment Webhook] Invalid signature key — request ditolak.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const {
      order_id,
      transaction_status,
      fraud_status,
      payment_type,
      gross_amount,
    } = notification;

    console.log('[Payment Webhook] Notif masuk | order_id:', order_id, '| status:', transaction_status);

    // ── 2. Map status Midtrans → status internal ──────────────────────────────
    let newStatus: string;

    if (
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement'
    ) {
      newStatus = 'paid';
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      newStatus = 'payment_failed';
    } else if (transaction_status === 'pending') {
      newStatus = 'pending_payment';
    } else {
      // Status tidak dikenali — log tapi jangan error
      console.warn('[Payment Webhook] Unrecognized transaction_status:', transaction_status);
      return NextResponse.json({ success: true, note: 'status not handled' });
    }

    // ── 3. Update tabel Booking ───────────────────────────────────────────────
    const booking = await bookingStore.findById(order_id);
    if (!booking) {
      console.error('[Payment Webhook] Booking tidak ditemukan untuk order_id:', order_id);
      // Return 200 agar Midtrans tidak retry terus-menerus
      return NextResponse.json({ success: true, note: 'booking not found' });
    }

    if (newStatus !== booking.status) {
      await bookingStore.updateStatus(order_id, newStatus, {
        paymentId: notification.transaction_id,
        paymentStatus: transaction_status,
        paymentType: payment_type,
        ...(newStatus === 'paid' && { paidAt: new Date() }),
      });
      console.log('[Payment Webhook] ✅ Booking status updated:', booking.status, '→', newStatus);
    } else {
      console.log('[Payment Webhook] Status tidak berubah, skip update.');
    }

    // ── 4. Update tabel Payment (audit trail) ─────────────────────────────────
    try {
      await bookingStore.updatePayment(order_id, {
        status: transaction_status,
        paymentType: payment_type,
        midtransResponse: notification,
        ...(newStatus === 'paid' && { paidAt: new Date() }),
      });
    } catch (e: any) {
      // Payment record mungkin belum ada (jika logPayment gagal saat booking) — non-fatal
      console.warn('[Payment Webhook] Payment update error (non-fatal):', e.message);
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error('[Payment Webhook] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}