import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insuranceAPI } from '@/lib/orbis';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    const body = await req.json();
    const {
      contacts,
      passengers,
      booker,
      provider,
      carrier_code,
      total_amount,
      product_name,
      product_code,
      date_start,
      date_end,
      destination,
    } = body;

    if (!contacts?.length || !passengers?.length || !booker || !provider) {
      return NextResponse.json({ error: 'Data kontak, penumpang, dan provider wajib diisi' }, { status: 400 });
    }

    // 1. Commit Booking ke API Asuransi Orbis
    let bookingData: any = null;
    try {
      const commitPayload = {
        contacts,
        passengers,
        booker,
        provider,
        carrier_code: carrier_code || provider,
        voucher: {},
      };
      console.log('[INSURANCE] Commit booking payload:', JSON.stringify(commitPayload, null, 2));
      bookingData = await insuranceAPI.commitBooking(commitPayload);
      console.log('[INSURANCE] Booking result:', bookingData?.order_number);
    } catch (e: any) {
      console.error('[INSURANCE] Booking error:', e.message);
      return NextResponse.json({ error: `Gagal membuat polis asuransi: ${e.message}` }, { status: 422 });
    }

    // 2. Buat Transaksi Midtrans
    const orderId = `TMT-INS-${Date.now()}`;
    let snap = { token: '', redirect_url: '' };
    try {
      snap = await createSnapTransaction({
        orderId,
        amount: total_amount,
        customerName: `${booker.first_name} ${booker.last_name}`,
        customerEmail: booker.email,
        customerPhone: booker.calling_code + booker.mobile,
        itemDetails: [{
          id: product_code || orderId,
          price: Math.round(total_amount),
          quantity: 1,
          name: `Asuransi: ${product_name || 'Travel Insurance'}`,
        }],
      });
    } catch (e: any) {
      console.error('[Midtrans] error:', e.message);
      return NextResponse.json({ error: `Gagal membuat pembayaran: ${e.message}` }, { status: 500 });
    }

    // 3. Simpan ke Database (hanya jika user login)
    if (session) {
      try {
        await bookingStore.create({
          id: orderId,
          userId: (session.user as any).id,
          orderNumber: bookingData?.order_number || orderId,
          bookingType: 'insurance',
          status: 'pending_payment',
          totalAmount: total_amount,
          currency: 'IDR',
          hotelName: product_name || 'Asuransi Perjalanan',
          checkinDate: date_start ? new Date(date_start).toISOString() : new Date().toISOString(),
          checkoutDate: date_end ? new Date(date_end).toISOString() : new Date().toISOString(),
          passengerData: passengers,
          bookingData: bookingData || {},
          snapToken: snap.token,
          snapRedirectUrl: snap.redirect_url,
        });
      } catch (dbErr: any) {
        console.error('[DB] Save booking error:', dbErr.message);
        // Non-fatal: lanjut meski DB gagal
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
      orderNumber: bookingData?.order_number || orderId,
      bookingData,
    });

  } catch (e: any) {
    console.error('[INSURANCE BOOK] Fatal:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}