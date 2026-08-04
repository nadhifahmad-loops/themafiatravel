import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insuranceAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { settleRefundAfterCancel } from '@/lib/refund';
import { canManageBooking } from '@/lib/booking-access';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { orderId, orderNumber, reason } = body;

    if (!orderId && !orderNumber) {
      return NextResponse.json({ success: false, error: 'orderId atau orderNumber wajib diisi' }, { status: 400 });
    }

    const booking = orderId
      ? await bookingStore.findById(orderId)
      : await bookingStore.findByOrderNumber(orderNumber);

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking tidak ditemukan' }, { status: 404 });
    }

    const user = session.user as { id?: string; email?: string; role?: string };
    if (!canManageBooking(booking, {
      sessionUserId: user.id ?? null,
      sessionEmail: user.email ?? null,
      isAdmin: user.role === 'admin',
      bookerEmail: body.booker_email,
    })) {
      return NextResponse.json({ success: false, error: 'Tidak memiliki akses ke booking ini' }, { status: 403 });
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Booking sudah dibatalkan sebelumnya.' }, { status: 400 });
    }

    const derivedCancelType = booking.status === 'pending_payment'
      ? 'void'
      : ['paid', 'issued'].includes(booking.status)
        ? 'refund'
        : null;

    if (!derivedCancelType) {
      return NextResponse.json({ success: false, error: 'Status booking tidak mendukung pembatalan saat ini.' }, { status: 400 });
    }

    const cancelResult = await insuranceAPI.cancelBooking(booking.orderNumber);

    if (derivedCancelType === 'void') {
      await bookingStore.cancelBooking(booking.id, {
        reason: reason || 'Dibatalkan oleh pengguna',
        cancelType: 'void',
      });

      return NextResponse.json({
        success: true,
        message: 'Pembatalan asuransi berhasil diproses (void).',
        cancel_type: 'void',
        orderNumber: booking.orderNumber,
        data: cancelResult,
      });
    }

    const settle = await settleRefundAfterCancel(booking, reason || 'Refund booking insurance');

    return NextResponse.json({
      success: true,
      message: settle.mode === 'auto'
        ? 'Pembatalan asuransi berhasil diproses dan refund dikembalikan otomatis.'
        : 'Pembatalan asuransi berhasil diproses. Refund menunggu review admin.',
      cancel_type: 'refund',
      refund_mode: settle.mode,
      orderNumber: booking.orderNumber,
      data: cancelResult,
    });
  } catch (e: any) {
    console.error('[INSURANCE CANCEL ERROR]', e.message);
    return NextResponse.json({ success: false, error: e.message || 'Gagal membatalkan booking asuransi.' }, { status: 500 });
  }
}
