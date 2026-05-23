import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { hotel_code, price_code, passenger, contact, booker, special_request, search_data, total_amount, hotel_name } = body;

    // Create booking at Orbis
    let bookingData: any = null;
    try {
      bookingData = await hotelAPI.createBooking({ hotel_code, price_code, passenger, contact, booker, special_request, search_data });
    } catch (e: any) {
      console.error('Orbis booking error:', e.message);
    }

    const orderId = `TMT-HTL-${Date.now()}`;

    // Create Midtrans Snap token
    let snap = { token: '', redirect_url: '' };
    try {
      snap = await createSnapTransaction({
        orderId,
        amount: total_amount,
        customerName: `${booker?.first_name || ''} ${booker?.last_name || ''}`.trim(),
        customerEmail: booker?.email || 'noemail@example.com',
        customerPhone: (booker?.calling_code || '62') + (booker?.mobile || ''),
        itemDetails: [{ id: hotel_code, price: Math.round(total_amount), quantity: 1, name: hotel_name || 'Hotel Booking' }],
      });
    } catch (e: any) {
      console.error('Midtrans error:', e.message);
    }

    const booking = {
      id: orderId,
      userId: (session.user as any).id,
      orderNumber: bookingData?.order_number || orderId,
      bookingType: 'hotel',
      status: 'pending_payment',
      totalAmount: total_amount,
      currency: 'IDR',
      hotelName: hotel_name,
      passengerData: passenger,
      bookingData,
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
      checkinDate: search_data?.checkin_date,
      checkoutDate: search_data?.checkout_date,
      createdAt: new Date().toISOString(),
    };
    await bookingStore.create(booking);

    return NextResponse.json({ success: true, orderId, snapToken: snap.token, redirectUrl: snap.redirect_url, orderNumber: bookingData?.order_number || orderId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
