import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { settleRefundAfterCancel } from '@/lib/refund';
import { canManageBooking } from '@/lib/booking-access';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { order_number, issued_name, provider, check_only } = await req.json();

    if (check_only) {
      // 3.10 Check Refund Amount
      const refund = await hotelAPI.checkRefundAmount(order_number, issued_name, provider);
      return NextResponse.json({ success: true, data: refund });
    }

    // Cari booking + validasi kepemilikan sebelum cancel
    const booking = order_number ? await bookingStore.findByOrderNumber(order_number) : null;
    if (booking) {
      const user = session.user as { id?: string; email?: string; role?: string };
      if (!canManageBooking(booking, {
        sessionUserId: user.id ?? null,
        sessionEmail: user.email ?? null,
        isAdmin: user.role === 'admin',
      })) {
        return NextResponse.json({ error: 'Akses tidak diizinkan.' }, { status: 403 });
      }
    }

    // 3.11 Cancel Booking
    const data = await hotelAPI.cancelBooking(order_number, issued_name, provider);

    // Update status di database (kalau booking ditemukan)
    if (booking) {
      const derivedCancelType = booking.status === 'pending_payment'
        ? 'void'
        : ['paid', 'issued'].includes(booking.status)
          ? 'refund'
          : null;

      if (!derivedCancelType) {
        return NextResponse.json({ success: false, error: 'Status booking tidak mendukung pembatalan saat ini.' }, { status: 400 });
      }

      if (derivedCancelType === 'void') {
        await bookingStore.cancelBooking(booking.id, {
          reason: 'Dibatalkan oleh pengguna',
          cancelType: 'void',
        });
      } else {
        // Hotel selalu masuk antrian review (nominal refund ditentukan vendor).
        const settle = await settleRefundAfterCancel(booking, 'Refund booking hotel');
        console.log('[Hotel Cancel] Refund settle | mode:', settle.mode, '| amount:', settle.amount);
      }
    }

    return NextResponse.json({
      success: true,
      data,
      cancel_type: booking?.status === 'pending_payment' ? 'void' : 'refund',
      refund_mode: booking?.status === 'pending_payment' ? 'void' : 'manual',
    });
  } catch (e: any) {
    console.error('[HOTEL CANCEL ERROR]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
