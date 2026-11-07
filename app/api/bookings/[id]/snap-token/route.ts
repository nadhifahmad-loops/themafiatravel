import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';
import { PAYMENT_TIMEOUT_MS } from '@/lib/payment-window';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { authorizeBookingAccess } from '@/lib/booking-access';

// Refresh token Snap Midtrans untuk booking yang masih pending_payment.
// Token Snap hanya berlaku ±5 menit, sedangkan window pembayaran 1 jam —
// jadi token perlu dibuat ulang saat embed gagal / token kedaluwarsa.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const requestLimit = await checkRateLimit(`booking-snap:${ip}`, 'booking');
    if (!requestLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(requestLimit.retryAfter ?? 60) } }
      );
    }

    const session = await getServerSession(authOptions);
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Pesanan tidak ditemukan' },
        { status: 404 }
      );
    }

    const requester = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null;
    const isAdmin = requester?.role === 'admin';

    if (!booking.userId && !isAdmin) {
      const proofLimit = await checkRateLimit(`guest-booking-proof:${ip}:${booking.id}`, 'auth');
      if (!proofLimit.allowed) {
        return NextResponse.json(
          { success: false, message: 'Terlalu banyak percobaan verifikasi. Silakan coba lagi nanti.' },
          { status: 429, headers: { 'Retry-After': String(proofLimit.retryAfter ?? 60) } }
        );
      }
    }

    const access = authorizeBookingAccess({
      bookingUserId: booking.userId,
      requesterId: requester?.id ?? null,
      isAdmin,
      guestContact: request.headers.get('x-booking-contact'),
      bookingData: booking.bookingData,
      passengerData: booking.passengerData,
    });
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // ── Hanya pending_payment & belum lewat batas waktu ─────────────────────
    if (booking.status !== 'pending_payment') {
      return NextResponse.json(
        { success: false, message: 'Pesanan tidak dalam status menunggu pembayaran' },
        { status: 409 }
      );
    }

    if (Date.now() - booking.createdAt.getTime() > PAYMENT_TIMEOUT_MS) {
      return NextResponse.json(
        { success: false, message: 'Waktu pembayaran telah berakhir' },
        { status: 410 }
      );
    }

    // ── Derive data customer + label dari data booking ──────────────────────
    const bd: any = booking.bookingData ?? {};
    const contacts: any[] = Array.isArray(bd.contacts) ? bd.contacts : [];
    const contact = contacts[0] ?? null;
    const pax: any = Array.isArray(booking.passengerData) ? booking.passengerData[0] : null;

    const customerName =
      (contact?.first_name ? `${contact.first_name} ${contact.last_name || ''}`.trim() : '') ||
      (pax?.first_name ? `${pax.first_name} ${pax.last_name || ''}`.trim() : '') ||
      booking.user?.name ||
      '';

    const customerEmail = contact?.email || pax?.email || booking.user?.email || '';

    const rawPhone = contact?.mobile || contact?.phone || pax?.mobile || '';
    const customerPhone = rawPhone
      ? `${contact?.calling_code || pax?.calling_code || '62'}${rawPhone}`
      : '';

    let itemName = `The Mafia Travel - ${booking.bookingType}`;
    if (booking.bookingType === 'flight') itemName = `Tiket Pesawat: ${booking.routeLabel || booking.airlineName || 'Flight'}`;
    else if (booking.bookingType === 'train') itemName = `Tiket Kereta: ${booking.routeLabel || booking.airlineName || 'Train'}`;
    else if (booking.bookingType === 'hotel') itemName = `Hotel: ${booking.hotelName || 'Hotel'}`;
    else if (booking.bookingType === 'insurance') itemName = `Asuransi Perjalanan`;

    const snap = await createSnapTransaction({
      orderId: booking.id,
      amount: Math.round(booking.totalAmount),
      customerName,
      customerEmail,
      customerPhone: customerPhone || undefined,
      // Expiry Snap dihitung dari pembuatan booking, bukan saat token dibuat —
      // agar batas bayar Midtrans selalu sama dengan window internal 1 jam.
      createdAt: booking.createdAt,
      itemDetails: [{
        id: booking.id,
        price: Math.round(booking.totalAmount),
        quantity: 1,
        name: itemName,
      }],
    });

    // ── Update booking + Payment record (orderId sama agar webhook cocok) ───
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { snapToken: snap.token, snapRedirectUrl: snap.redirect_url },
    });

    const existingPayment = await prisma.payment.findFirst({
      where: { bookingId: booking.id, orderId: booking.id },
    });
    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { snapToken: snap.token, snapRedirectUrl: snap.redirect_url, status: 'pending' },
      });
    } else {
      await bookingStore.logPayment({
        bookingId: booking.id,
        orderId: booking.id,
        amount: Math.round(booking.totalAmount),
        snapToken: snap.token,
        snapRedirectUrl: snap.redirect_url,
        status: 'pending',
      });
    }

    return NextResponse.json(
      {
        success: true,
        snapToken: snap.token,
        redirectUrl: snap.redirect_url,
        data: {
          id: updated.id,
          snapToken: updated.snapToken,
          snapRedirectUrl: updated.snapRedirectUrl,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );

  } catch (error: any) {
    console.error('Error Refresh Snap Token:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Gagal membuat ulang token pembayaran. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}
