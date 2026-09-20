import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { safeTrainProviderBookings } from '@/lib/train-seat-data';

const VALID_STATUSES = ['pending_payment', 'paid', 'issued', 'payment_failed', 'cancelled', 'refund_requested', 'refund'];

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX (Bug #11): endpoint ini bisa diakses tanpa login untuk guest booking,
    // jadi wajib dibatasi rate-nya sama seperti endpoint pencarian booking lain —
    // agar enumerasi ID tidak bisa dilakukan cepat/murah.
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`booking-detail:${ip}`, 'booking');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const session = await getServerSession(authOptions);
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const requester = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null;

    // Cari booking berdasarkan id atau orderNumber
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { id: id },
          { orderNumber: id },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Pesanan tidak ditemukan' },
        { status: 404 }
      );
    }

    // Jika booking punya userId (booking user login)
    if (booking.userId) {
      // Wajib login
      if (!session?.user?.email || !requester) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      // Pastikan booking milik user yang sedang login (kecuali admin bisa lihat semua)
      const isAdmin = requester.role === 'admin';
      if (!isAdmin && booking.userId !== requester.id) {
        return NextResponse.json(
          { success: false, message: 'Akses ditolak: bukan pesanan Anda' },
          { status: 403 }
        );
      }
    }
    // Jika booking tidak punya userId (guest booking) — izinkan akses tanpa login

    // FIX (Bug #3 — sensitive data exposure): sebelumnya seluruh field mentah
    // (`...booking`) dikirim ke client, termasuk `bookingData` — yaitu respons
    // mentah dari Orbis (`commit_booking`) yang berpotensi memuat harga net/cost
    // vendor SEBELUM markup diterapkan (lihat lib/markup.ts), plus identifier
    // internal vendor. Field itu tidak pernah dibutuhkan oleh tampilan pelanggan.
    // Hanya admin yang boleh melihat data mentah ini (mis. untuk troubleshooting).
    const isAdmin = requester?.role === 'admin';
    const { bookingData, ...safeBooking } = booking;

    // Expose hanya field display-safe dari bookingData untuk non-admin
    const bd = (bookingData as Record<string, unknown>) || {};
    const safeTrainPbs = safeTrainProviderBookings(bd.provider_bookings);
    const safeBookingData = {
      arrival_date_from_search: bd.arrival_date_from_search ?? null,
      cabin_class: bd.cabin_class ?? null,
      subclass: bd.subclass ?? null,
      refundable: bd.refundable ?? null,
      is_refundable: bd.is_refundable ?? null,
      selectedBaggage: bd.selectedBaggage ?? null,
      coverage: bd.coverage ?? null,
      roomType: bd.roomType ?? null,
      // Segments hanya untuk display nama kota & arrival time (flight),
      // journeys hanya untuk kursi train (ubah kursi KAI / tampilkan kursi).
      provider_bookings: Array.isArray(bd.provider_bookings)
        ? (bd.provider_bookings as any[]).map((pb: any, idx: number) => ({
            segments: Array.isArray(pb?.segments)
              ? pb.segments.map((s: any) => ({
                  origin: s.origin,
                  destination: s.destination,
                  origin_name: s.origin_name,
                  destination_name: s.destination_name,
                  departure_date: s.departure_date,
                  arrival_date: s.arrival_date,
                  carrier_code: s.carrier_code,
                  carrier_name: s.carrier_name,
                  cabin_baggage: s.cabin_baggage,
                  baggage_allowance: s.baggage_allowance,
                }))
              : [],
            journeys: safeTrainPbs[idx]?.journeys ?? [],
          }))
        : [],
    };

    const responseData = {
      ...safeBooking,
      bookingData: isAdmin ? bookingData : safeBookingData,
      serviceType: booking.bookingType,
    };

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error('Error Fetch My Booking Detail:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

// ─── PATCH (Admin: update status) ─────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Akses ditolak: bukan admin' }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, message: `Status tidak valid. Gunakan: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const existing = await prisma.booking.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const updated = await prisma.booking.update({
      where: { id: existing.id },
      data: { status },
      include: { user: { select: { name: true, email: true } } },
    });

    await recordAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'booking.status.update',
      entityType: 'booking',
      entityId: existing.id,
      before: { status: existing.status },
      after: { status: updated.status },
      metadata: { orderNumber: existing.orderNumber, bookingType: existing.bookingType },
      ip: auditIpFromRequest(request),
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error) {
    console.error('Error Updating Booking:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}