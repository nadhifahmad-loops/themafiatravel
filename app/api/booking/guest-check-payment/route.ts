import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { buildBookingTicketAttachment } from '@/lib/email-ticket-pdf';
import { getBookingContact } from '@/lib/notify';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const BASE_URL = IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  return '62' + digits.replace(/^0/, '');
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req as unknown as Request);
    const rateLimit = await checkRateLimit(`guest-check:${ip}`, 'booking');
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Terlalu banyak permintaan.' }, { status: 429 });
    }

    const orderNumber = req.nextUrl.searchParams.get('orderNumber');
    const phone = req.nextUrl.searchParams.get('phone');

    if (!orderNumber || !phone) {
      return NextResponse.json({ success: false, error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: { orderNumber: { equals: orderNumber, mode: 'insensitive' } }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const inputStr = phone.trim();
    const isEmail = inputStr.includes('@');
    const allDataStr = JSON.stringify(booking.bookingData || {}) + JSON.stringify(booking.passengerData || {});

    let isMatch = false;
    if (isEmail) {
      isMatch = allDataStr.toLowerCase().includes(inputStr.toLowerCase());
    } else {
      const cleanInput = normalizePhone(inputStr);
      if (cleanInput.length >= 10) {
        const localFormat = cleanInput.replace(/^62/, '0');
        isMatch = allDataStr.includes(localFormat)
               || allDataStr.includes(cleanInput)
               || allDataStr.includes('+' + cleanInput);
      }
    }

    if (!isMatch) {
      return NextResponse.json({ success: false, error: 'Verifikasi gagal.' }, { status: 403 });
    }

    if (booking.status !== 'pending_payment') {
      return NextResponse.json({ success: true, status: booking.status, updated: false, snapToken: null, snapRedirectUrl: null });
    }

    if (!MIDTRANS_SERVER_KEY) {
      return NextResponse.json({ success: true, status: booking.status, updated: false, snapToken: booking.snapToken, snapRedirectUrl: booking.snapRedirectUrl });
    }

    const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
    const res = await fetch(`${BASE_URL}/${booking.id}/status`, {
      headers: { Authorization: `Basic ${authString}` },
    });

    if (!res.ok) {
      return NextResponse.json({ success: true, status: booking.status, updated: false, snapToken: booking.snapToken, snapRedirectUrl: booking.snapRedirectUrl });
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
      // Transisi atomik (updateMany + guard status lama) — hanya pemenang race
      // (polling ini ATAU webhook Midtrans) yang menjalankan side-effect kirim
      // email, sehingga tidak pernah terjadi email ganda.
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

      // Email konfirmasi untuk guest booking — sebelumnya hanya webhook yang
      // mengirim; jika webhook terlambat/gagal, guest tidak pernah menerima
      // kode pesanan via email. Fallback ini menutup celah tersebut.
      if (updated && newStatus === 'paid') {
        try {
          const bookingUser = booking.userId
            ? await prisma.user.findUnique({ where: { id: booking.userId }, select: { name: true, email: true, phone: true } })
            : null;
          const contact = getBookingContact({ ...booking, user: bookingUser });
          if (contact.email) {
            const ticketAttachments = await buildBookingTicketAttachment(booking);
            await sendBookingConfirmationEmail({
              to: contact.email,
              userName: contact.name || 'pelanggan',
              booking: {
                id: booking.id,
                orderNumber: booking.orderNumber,
                bookingType: booking.bookingType,
                routeLabel: booking.routeLabel,
                hotelName: booking.hotelName,
                totalAmount: booking.totalAmount,
                pnr: booking.pnr,
                provider: booking.provider,
              },
              ...(ticketAttachments ? { attachments: ticketAttachments } : {}),
            });
            console.log('[Guest Check Payment] Email sent to:', contact.email);
          }
        } catch (emailErr: any) {
          console.error('[Guest Check Payment] Email failed (non-fatal):', emailErr.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus || booking.status,
      updated,
      snapToken: booking.snapToken,
      snapRedirectUrl: booking.snapRedirectUrl,
      createdAt: booking.createdAt.toISOString(),
    });

  } catch (error) {
    console.error('[GUEST CHECK PAYMENT ERROR]:', error);
    return NextResponse.json({ success: false, error: 'Gagal memeriksa status.' }, { status: 500 });
  }
}
