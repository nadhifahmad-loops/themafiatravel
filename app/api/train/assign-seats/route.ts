import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking, verifyGuestBookingProof } from '@/lib/booking-access';
import { buildTrainAssignPayload, TrainSeatChange } from '@/lib/train-seat-data';

export const maxDuration = 90;

// POST /api/train/assign-seats — Flow 5 "Change Seat" pada panduan KAI Rodextrip.
// Client hanya mengirim orderId + daftar kursi yang diubah; payload provider_bookings
// (sequence provider & journey) disusun di server dari bookingData agar struktur
// selalu sesuai data Orbis yang tersimpan, bukan dari isian client.
// Akses: session pemilik/admin, email pemesan, atau bukti guest (orderNumber + email/HP).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, booker_email, orderNumber, phone, changes } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId wajib diisi' }, { status: 400 });
    }
    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada kursi yang diubah.' }, { status: 400 });
    }

    const booking = await bookingStore.findById(orderId);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking tidak ditemukan' }, { status: 404 });
    }
    if (booking.bookingType !== 'train') {
      return NextResponse.json({ success: false, error: 'Bukan booking kereta.' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; email?: string; role?: string } | undefined;
    const allowed = canManageBooking(booking, {
      sessionUserId: user?.id ?? null,
      sessionEmail: user?.email ?? null,
      isAdmin: user?.role === 'admin',
      bookerEmail: typeof booker_email === 'string' ? booker_email : undefined,
    }) || verifyGuestBookingProof(booking, orderNumber, phone);

    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Tidak memiliki akses ke booking ini' }, { status: 403 });
    }

    // Kursi hanya bisa dipilih/diubah setelah pembayaran berhasil (post-booking).
    if (!['paid', 'issued'].includes(booking.status)) {
      return NextResponse.json({
        success: false,
        error: 'Kursi hanya dapat dipilih atau diubah setelah pembayaran selesai.',
      }, { status: 400 });
    }

    const orderNumberBooking = booking.orderNumber;
    if (!orderNumberBooking) {
      return NextResponse.json({ success: false, error: 'orderNumber tidak ditemukan pada booking ini.' }, { status: 422 });
    }

    const seatChanges = (changes as TrainSeatChange[]).map((c) => ({
      journeyIdx: Number(c.journeyIdx) || 0,
      passenger_sequence: Number(c.passenger_sequence) || 0,
      cabin_code: typeof c.cabin_code === 'string' ? c.cabin_code : '',
      seat_row: Number(c.seat_row) || 0,
      seat_column: typeof c.seat_column === 'string' ? c.seat_column : '',
    }));
    if (seatChanges.some((c) => !c.passenger_sequence || !c.cabin_code || !c.seat_column)) {
      return NextResponse.json({ success: false, error: 'Data kursi tidak lengkap.' }, { status: 422 });
    }

    const provider_bookings = buildTrainAssignPayload(booking.bookingData, seatChanges);
    if (!provider_bookings.length) {
      return NextResponse.json({ success: false, error: 'Gagal memetakan kursi ke provider booking.' }, { status: 422 });
    }

    let assigned: unknown;
    try {
      assigned = await trainAPI.assignSeats({
        order_number: orderNumberBooking,
        provider_bookings,
      });
    } catch (e: unknown) {
      const err = e as { message?: string; orbisCode?: number };
      console.error('[KAI assign_seats ERROR]', err.message, 'code:', err?.orbisCode);
      return NextResponse.json({
        success: false,
        error: `Gagal mengubah kursi: ${err?.message || 'Terjadi kesalahan'}`,
        ...(err?.orbisCode ? { orbisCode: err.orbisCode } : {}),
      }, { status: 422 });
    }

    // Refresh get_booking agar kursi terbaru ikut tersimpan di bookingData dan
    // dapat ditampilkan ulang di halaman detail transaksi.
    try {
      const fresh = await trainAPI.getBooking(orderNumberBooking) as Record<string, unknown> | null;
      const next: Record<string, unknown> = {};
      if (fresh && typeof fresh === 'object') {
        if (fresh.provider_bookings) next.provider_bookings = fresh.provider_bookings;
        if (typeof fresh.state === 'string') next.state = fresh.state;
        if (typeof fresh.hold_date === 'string') next.hold_date = fresh.hold_date;
        if (typeof fresh.pnr === 'string') next.pnr = fresh.pnr;
      }
      await bookingStore.mergeBookingData(booking.id, { bookingData: next });
    } catch (refreshErr: unknown) {
      console.warn('[assign_seats] get_booking refresh warn:', (refreshErr as Error)?.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Kursi berhasil diubah.',
      data: assigned,
    });
  } catch (e: unknown) {
    console.error('[Train Assign Seats ERROR]', (e as Error)?.message);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem.' }, { status: 500 });
  }
}