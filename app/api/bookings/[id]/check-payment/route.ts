import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bookingStore } from '@/lib/store';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { buildBookingTicketAttachment } from '@/lib/email-ticket-pdf';
import { getBookingContact } from '@/lib/notify';
import { getSession } from '@/lib/auth';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const BASE_URL = IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2';

/**
 * GET /api/bookings/[id]/check-payment
 *
 * Public endpoint for logged-in users to check payment status.
 * Queries Midtrans API directly, updates DB if status changed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(_req);
    const userId = (session as { id?: string } | undefined)?.id;

    if (!session || !userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    const booking = await prisma.booking.findFirst({
      where: {
        AND: [
          { userId },
          { OR: [{ id }, { orderNumber: id }] },
        ],
      },
    });

    if (!booking) {
      return NextResponse.json({ success: false, message: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // Only check if still pending
    if (booking.status !== 'pending_payment') {
      return NextResponse.json({ success: true, data: { status: booking.status, updated: false } });
    }

    if (!MIDTRANS_SERVER_KEY) {
      return NextResponse.json({ success: false, message: 'Midtrans not configured' }, { status: 500 });
    }

    // Query Midtrans directly
    const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
    const res = await fetch(`${BASE_URL}/${booking.id}/status`, {
      headers: { Authorization: `Basic ${authString}` },
    });

    if (!res.ok) {
      return NextResponse.json({ success: true, data: { status: booking.status, updated: false } });
    }

    const data = await res.json();
    const txn = data.transaction_status as string;
    const fraud = data.fraud_status as string;

    let newStatus: string | null = null;
    if ((txn === 'capture' && fraud === 'accept') || txn === 'settlement') {
      newStatus = 'paid';
    } else if (['cancel', 'deny', 'expire'].includes(txn)) {
      newStatus = 'payment_failed';
    }

    let updated = false;
    if (newStatus && newStatus !== booking.status) {
      // FIX (race webhook vs polling): transisi status atomik dengan guard
      // status lama — hanya pemenang race yang menjalankan side-effect di bawah
      // (update Payment + kirim email), sehingga email konfirmasi tidak pernah
      // terkirim dua kali saat webhook Midtrans dan polling ini balapan.
      const claim = await prisma.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: {
          status: newStatus,
          ...(data.transaction_id && { paymentId: data.transaction_id }),
          paymentStatus: txn,
          ...(data.payment_type && { paymentType: data.payment_type }),
          ...(newStatus === 'paid' && { paidAt: new Date() }),
        },
      });
      updated = claim.count === 1;

      if (updated) {
        try {
          await bookingStore.updatePayment(booking.id, {
            status: txn,
            paymentType: data.payment_type,
            midtransResponse: data,
            ...(newStatus === 'paid' && { paidAt: new Date() }),
          });
        } catch { /* non-fatal */ }

        // Send email confirmation if payment successful
        if (newStatus === 'paid') {
          try {
            const contact = getBookingContact(booking);
            if (contact.email) {
              const ticketAttachments = await buildBookingTicketAttachment(booking);
              await sendBookingConfirmationEmail({
                to: contact.email,
                userName: contact.name,
                booking: {
                  id: booking.id,
                  orderNumber: booking.orderNumber,
                  bookingType: booking.bookingType,
                  routeLabel: booking.routeLabel,
                  totalAmount: booking.totalAmount,
                  pnr: booking.pnr,
                  provider: booking.provider,
                },
                ...(ticketAttachments ? { attachments: ticketAttachments } : {}),
              });
              console.log('[Check Payment] Email sent to:', contact.email);
            }
          } catch (emailErr: any) {
            console.error('[Check Payment] Email failed:', emailErr.message);
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: { status: newStatus || booking.status, updated } });

  } catch (e: any) {
    console.error('[Check Payment] Error:', e.message);
    return NextResponse.json({ success: false, message: 'Gagal memeriksa status pembayaran' }, { status: 500 });
  }
}
