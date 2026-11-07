import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bookingStore } from '@/lib/store';
import { handleLateSettlement } from '@/lib/late-settlement';
import { releaseVendorHold } from '@/lib/payment-cleanup';
import { trainAPI } from '@/lib/orbis';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { buildBookingTicketAttachment } from '@/lib/email-ticket-pdf';
import { getBookingContact } from '@/lib/notify';
import { formatBookingConfirmationMessage, sendWhatsApp } from '@/lib/whatsapp';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2';

type MidtransStatus = {
  transaction_status?: unknown;
  fraud_status?: unknown;
  transaction_id?: string;
  payment_type?: string;
  [key: string]: unknown;
};

function mapBookingStatus(transactionStatus: string, fraudStatus: string): string | null {
  if ((transactionStatus === 'capture' && fraudStatus === 'accept') || transactionStatus === 'settlement') {
    return 'paid';
  }
  if (['cancel', 'deny', 'expire'].includes(transactionStatus)) return 'payment_failed';
  if (transactionStatus === 'pending') return 'pending_payment';
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (!MIDTRANS_SERVER_KEY) {
    return NextResponse.json({ error: 'Konfigurasi Midtrans belum tersedia.' }, { status: 503 });
  }

  let orderId: string;
  try {
    const body = await req.json();
    orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
  }

  if (!orderId) {
    return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      return NextResponse.json({ error: 'Pembayaran tidak ditemukan.' }, { status: 404 });
    }

    const response = await fetch(`${BASE_URL}/${encodeURIComponent(orderId)}/status`, {
      headers: { Authorization: `Basic ${Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64')}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[Admin Payment Sync] Midtrans returned ${response.status} for order ${orderId}:`, detail);
      return NextResponse.json(
        { error: `Midtrans gagal memeriksa pembayaran (HTTP ${response.status}).` },
        { status: 502 }
      );
    }

    const midtrans = await response.json() as MidtransStatus;
    const transactionStatus = typeof midtrans.transaction_status === 'string' ? midtrans.transaction_status : '';
    const fraudStatus = typeof midtrans.fraud_status === 'string' ? midtrans.fraud_status : '';
    if (!transactionStatus) {
      console.error(`[Admin Payment Sync] Midtrans response has no transaction_status for order ${orderId}.`);
      return NextResponse.json({ error: 'Respons Midtrans tidak memuat status transaksi.' }, { status: 502 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Pesanan terkait pembayaran tidak ditemukan.' }, { status: 404 });
    }

    const nextStatus = mapBookingStatus(transactionStatus, fraudStatus);
    const isPaid = nextStatus === 'paid';
    const warnings: string[] = [];
    let lateSettlement = false;
    let wonTransition = false;

    if (!nextStatus) {
      warnings.push(`Status transaksi "${transactionStatus}" hanya dicatat dan tidak mengubah status pesanan.`);
    }

    if (isPaid) {
      lateSettlement = await handleLateSettlement({
        booking,
        transactionStatus,
        transactionId: midtrans.transaction_id,
        paymentType: midtrans.payment_type,
        midtransResponse: midtrans,
      });
    }

    if (nextStatus && !lateSettlement) {
      const canTransition = isPaid
        ? ['pending_payment', 'payment_failed'].includes(booking.status)
        : nextStatus === 'payment_failed'
          ? booking.status === 'pending_payment'
          : booking.status === 'pending_payment';

      if (canTransition) {
        const claim = await prisma.booking.updateMany({
          where: { id: booking.id, status: booking.status },
          data: {
            status: nextStatus,
            ...(midtrans.transaction_id && { paymentId: midtrans.transaction_id }),
            paymentStatus: transactionStatus,
            ...(midtrans.payment_type && { paymentType: midtrans.payment_type }),
            ...(isPaid && { paidAt: new Date() }),
          },
        });
        wonTransition = claim.count === 1;
      } else if (booking.status !== nextStatus && !(booking.status === 'issued' && isPaid)) {
        warnings.push(`Status pesanan "${booking.status}" tidak diubah otomatis dari transaksi ini. Periksa riwayat pesanan.`);
      }
    }

    if (wonTransition && nextStatus === 'payment_failed') {
      const released = await releaseVendorHold(booking, { maxAttempts: 3, baseDelayMs: 2000 });
      if (!released.success) {
        warnings.push('Pembayaran gagal, tetapi pelepasan reservasi vendor belum berhasil. Perlu ditindaklanjuti.');
      }
    }

    if (
      isPaid
      && !lateSettlement
      && booking.bookingType === 'train'
      && (wonTransition || booking.status === 'paid')
    ) {
      const bookingData = (booking.bookingData as Record<string, unknown> | null) || {};
      const issuedData = bookingData.issued as Record<string, unknown> | undefined;
      if (issuedData?.state !== 'issued') {
        try {
          const issued = await trainAPI.issued(booking.orderNumber);
          await bookingStore.mergeBookingData(booking.id, {
            status: 'issued',
            bookingData: {
              issued: {
                ...(issued && typeof issued === 'object' ? issued : {}),
                state: 'issued',
                issuedAt: new Date().toISOString(),
              },
            },
          });
        } catch (error) {
          console.error('[Admin Payment Sync] Train ticket issuance failed:', error);
          warnings.push('Pembayaran terkonfirmasi, tetapi penerbitan tiket kereta gagal. Periksa pesanan ini.');
        }
      }
    }

    try {
      await prisma.payment.update({
        where: { orderId },
        data: {
          status: transactionStatus,
          ...(midtrans.payment_type && { paymentType: midtrans.payment_type }),
          midtransResponse: midtrans as Prisma.InputJsonValue,
          ...(isPaid && { paidAt: new Date() }),
        },
      });
    } catch (error) {
      console.error('[Admin Payment Sync] Payment audit update failed:', error);
      warnings.push('Status Midtrans terbaca, tetapi catatan pembayaran gagal diperbarui.');
    }

    if (isPaid && wonTransition) {
      try {
        const contact = getBookingContact({ ...booking, user: booking.user });
        const messageArgs = {
          orderNumber: booking.orderNumber,
          bookingType: booking.bookingType,
          routeLabel: booking.routeLabel,
          hotelName: booking.hotelName,
          totalAmount: booking.totalAmount,
          pnr: booking.pnr,
        };

        if (contact.email) {
          const attachments = await buildBookingTicketAttachment(booking);
          await sendBookingConfirmationEmail({
            to: contact.email,
            userName: contact.name || 'pelanggan',
            booking: { id: booking.id, ...messageArgs, provider: booking.provider },
            ...(attachments ? { attachments } : {}),
          });
        }
        if (contact.phone) {
          await sendWhatsApp(contact.phone, formatBookingConfirmationMessage(messageArgs));
        }
      } catch (error) {
        console.error('[Admin Payment Sync] Confirmation notification failed:', error);
        warnings.push('Pembayaran tercatat, tetapi notifikasi konfirmasi gagal dikirim.');
      }
    }

    const updated = await prisma.payment.findUnique({
      where: { orderId },
      include: { booking: { select: { id: true, status: true, user: { select: { name: true } } } } },
    });

    return NextResponse.json({
      success: true,
      payment: updated,
      midtrans,
      lateSettlement,
      warnings,
    });
  } catch (error) {
    console.error('[Admin Payment Sync] Failed to synchronize payment:', error);
    return NextResponse.json({ error: 'Gagal menyinkronkan pembayaran. Silakan coba lagi.' }, { status: 500 });
  }
}
