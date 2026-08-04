import { NextRequest, NextResponse } from 'next/server';
import { verifyMidtransNotification } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';
import { prisma } from '@/lib/prisma';
import { releaseVendorHold } from '@/lib/payment-cleanup';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { sendWhatsApp, formatBookingConfirmationMessage } from '@/lib/whatsapp';
import { getBookingContact } from '@/lib/notify';

/**
 * Midtrans Webhook — POST /api/payment/notification
 *
 * Midtrans mengirim notifikasi ke sini saat status transaksi berubah.
 * Endpoint ini harus:
 * 1. Verifikasi signature key
 * 2. Check idempotency (prevent duplicate processing)
 * 3. Map transaction_status → status internal kita
 * 4. Update tabel Booking
 * 5. Update tabel Payment (audit trail)
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
      transaction_id,
    } = notification;

    console.log('[Payment Webhook] Notif masuk | order_id:', order_id, '| status:', transaction_status, '| txn_id:', transaction_id);

    // ── 2. Idempotency Check ─────────────────────────────────────────────────
    // Cek apakah notifikasi dengan transaction_id yang sama sudah pernah diproses
    if (transaction_id) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          orderId: order_id,
          status: { in: ['settlement', 'capture'] },
        },
      });

      if (existingPayment && existingPayment.midtransResponse) {
        const prevResponse = existingPayment.midtransResponse as any;
        if (prevResponse.transaction_id === transaction_id) {
          console.log('[Payment Webhook] Duplicate notification for transaction_id:', transaction_id, '- skipping.');
          return NextResponse.json({ success: true, note: 'already processed' });
        }
      }
    }

    // ── 3. Map status Midtrans → status internal ──────────────────────────────
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
      console.warn('[Payment Webhook] Unrecognized transaction_status:', transaction_status);
      return NextResponse.json({ success: true, note: 'status not handled' });
    }

    // ── 4. Update tabel Booking ───────────────────────────────────────────────
    const booking = await bookingStore.findById(order_id);
    if (!booking) {
      console.error('[Payment Webhook] Booking tidak ditemukan untuk order_id:', order_id);
      return NextResponse.json({ error: 'booking not found' }, { status: 404 });
    }

    // FIX (Bug #6 — race condition): sebelumnya alurnya "baca status lalu tulis"
    // tanpa lock — dua notifikasi webhook yang datang nyaris bersamaan (Midtrans
    // memang retry jika response lambat/timeout) bisa lolos idempotency check
    // bersamaan sebelum salah satu selesai menulis, sehingga side-effect di
    // langkah 5 & 7 (release vendor hold, kirim email/WA) terpicu dua kali.
    //
    // Perbaikan: gunakan `updateMany` dengan WHERE yang menyertakan status LAMA
    // yang baru saja dibaca. Operasi ini atomik di level database — hanya request
    // yang "menang race" akan mengubah baris (count === 1), request lain akan
    // mendapat count === 0 dan tahu bahwa transisi ini sudah/sedang ditangani
    // oleh request lain, sehingga tidak menjalankan side-effect lagi.
    const previousStatus = booking.status;
    const statusChanged = newStatus !== previousStatus;

    let wonTransition = false;

    if (statusChanged) {
      const claim = await prisma.booking.updateMany({
        where: { id: order_id, status: previousStatus },
        data: {
          status: newStatus,
          ...(transaction_id && { paymentId: transaction_id }),
          paymentStatus: transaction_status,
          ...(payment_type && { paymentType: payment_type }),
          ...(newStatus === 'paid' && { paidAt: new Date() }),
        },
      });
      wonTransition = claim.count === 1;

      if (wonTransition) {
        console.log('[Payment Webhook] Booking status updated:', previousStatus, '->', newStatus);
      } else {
        console.log('[Payment Webhook] Status sudah diubah oleh request lain (race) — skip side-effect duplikat.');
      }
    } else {
      console.log('[Payment Webhook] Status tidak berubah, skip update.');
    }

    // ── 5. Release vendor hold on failed/expired payments ────────────────────
    if (wonTransition && newStatus === 'payment_failed') {
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
      } catch (releaseErr: any) {
        console.warn('[Payment Webhook] Vendor release failed (non-fatal):', releaseErr.message);
      }
    }

    // ── 6. Update tabel Payment (audit trail) ─────────────────────────────────
    try {
      await bookingStore.updatePayment(order_id, {
        status: transaction_status,
        paymentType: payment_type,
        midtransResponse: notification,
        ...(newStatus === 'paid' && { paidAt: new Date() }),
      });
    } catch (e: any) {
      console.warn('[Payment Webhook] Payment update error (non-fatal):', e.message);
    }

    // ── 7. Send confirmation notifications for successful payments ─────────
    // Guest booking (tanpa akun) juga mendapat notifikasi: kontak diambil dari
    // bookingData.contacts/contact/booker, fallback ke akun terdaftar.
    if (newStatus === 'paid' && wonTransition) {
      try {
        const bookingUser = booking.userId
          ? await prisma.user.findUnique({ where: { id: booking.userId }, select: { email: true, name: true, phone: true } })
          : null;

        const contact = getBookingContact({ ...booking, user: bookingUser });
        const messageArgs = {
          orderNumber: booking.orderNumber,
          bookingType: booking.bookingType,
          routeLabel: booking.routeLabel,
          hotelName: booking.hotelName,
          totalAmount: booking.totalAmount,
          pnr: booking.pnr,
        };

        if (contact.email) {
          await sendBookingConfirmationEmail({
            to: contact.email,
            userName: contact.name || 'pelanggan',
            booking: {
              id: booking.id,
              ...messageArgs,
              provider: booking.provider,
            },
          });
        }

        if (contact.phone) {
          await sendWhatsApp(contact.phone, formatBookingConfirmationMessage(messageArgs));
        }
      } catch (notifyErr: any) {
        console.warn('[Payment Webhook] Notification send failed (non-fatal):', notifyErr.message);
      }
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error('[Payment Webhook] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}