import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { matchGuestContact } from '@/lib/booking-contact-match';
import { buildTicketPdfData, renderTicketPdf, ticketFilename } from '@/lib/ticket-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOWNLOADABLE = new Set(['paid', 'issued']);

/**
 * POST /api/bookings/[id]/pdf
 *
 * Body: { phone?: string }
 * - Booking milik user login: wajib sesi pemilik (atau admin).
 * - Booking tamu: wajib nomor telepon/email pemesan yang cocok.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ip = getClientIp(request);
    const rate = await checkRateLimit(`ticket-pdf:${ip}`, 'booking');
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 60) } },
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const phone = typeof body?.phone === 'string' ? body.phone : '';

    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
    });

    if (!booking) {
      return NextResponse.json({ success: false, message: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    if (booking.userId) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ success: false, message: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
      }
      const requester = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true },
      });
      if (!requester) {
        return NextResponse.json({ success: false, message: 'Sesi tidak valid.' }, { status: 401 });
      }
      if (requester.role !== 'admin' && booking.userId !== requester.id) {
        return NextResponse.json({ success: false, message: 'Akses ditolak.' }, { status: 403 });
      }
    } else {
      if (!phone) {
        return NextResponse.json(
          { success: false, message: 'Nomor telepon pemesan diperlukan untuk mengunduh dokumen.' },
          { status: 401 },
        );
      }
      const match = matchGuestContact(phone, booking.bookingData, booking.passengerData);
      if (!match.ok) {
        return NextResponse.json({ success: false, message: 'Verifikasi gagal.' }, { status: 403 });
      }
    }

    if (!DOWNLOADABLE.has(booking.status)) {
      return NextResponse.json(
        { success: false, message: 'Dokumen tersedia setelah pembayaran dikonfirmasi.' },
        { status: 409 },
      );
    }

    const data = buildTicketPdfData(booking);
    const buffer = await renderTicketPdf(data);
    const filename = ticketFilename(data.type, data.orderNumber);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[Ticket PDF Error]', error);
    return NextResponse.json(
      { success: false, message: 'Gagal membuat dokumen. Silakan coba lagi.' },
      { status: 500 },
    );
  }
}
