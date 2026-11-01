import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insuranceAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { settleRefundAfterCancel } from '@/lib/refund';
import { extractVendorRefundAmount } from '@/lib/refund-amount';
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

    const vendorRefundAmount = extractVendorRefundAmount(cancelResult);
    const settle = await settleRefundAfterCancel(
      booking,
      reason || 'Refund booking insurance',
      vendorRefundAmount
    );

    return NextResponse.json({
      success: true,
      message: settle.mode === 'auto'
        ? 'Pembatalan asuransi berhasil diproses dan refund dikembalikan otomatis.'
        : vendorRefundAmount === null
          ? 'Pembatalan asuransi berhasil. Nominal refund belum tersedia dari API dan harus diverifikasi admin sebelum dana dikembalikan.'
          : 'Pembatalan asuransi berhasil. Refund menunggu review admin.',
      cancel_type: 'refund',
      refund_mode: settle.mode,
      refund_amount: settle.amount,
      orderNumber: booking.orderNumber,
      data: cancelResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membatalkan booking asuransi.';
    console.error('[INSURANCE CANCEL ERROR]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
