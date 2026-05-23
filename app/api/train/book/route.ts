import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      contacts,
      passengers,
      schedules,
      booker,
      total_amount,
      origin,
      destination,
      departure_date,
      train_name,
      train_number,
      cabin_class,
    } = body;

    // --- Validasi dasar ---
    if (!contacts?.length || !passengers?.length || !schedules?.length || !booker) {
      return NextResponse.json({ success: false, error: 'Data tidak lengkap: contacts, passengers, schedules, booker wajib ada' }, { status: 400 });
    }
    if (!total_amount || total_amount <= 0) {
      return NextResponse.json({ success: false, error: 'total_amount tidak valid' }, { status: 400 });
    }

    // 1. Commit booking ke KAI via Orbis
    let bookingData: any = null;
    try {
      bookingData = await trainAPI.commitBooking({
        contacts,
        passengers,
        schedules,
        booker,
        force_issued: false,
      });
    } catch (e: any) {
      console.error('[KAI commitBooking ERROR]', e.message, 'code:', e.orbisCode);
      return NextResponse.json({
        success: false,
        error: `Gagal mengunci kursi KAI: ${e.message}`,
        orbisCode: e.orbisCode,
      }, { status: 422 });
    }

    const orderNumber = bookingData?.order_number;
    const pnr = bookingData?.pnr || '';
    const holdDate = bookingData?.hold_date || '';
    const state = bookingData?.state || 'booked';

    if (!orderNumber) {
      return NextResponse.json({ success: false, error: 'KAI tidak mengembalikan order_number' }, { status: 500 });
    }

    // 2. Buat transaksi Midtrans
    const orderId = `TMT-TRN-${Date.now()}`;
    const routeLabel = `${origin || ''} → ${destination || ''}`;
    const trainLabel = train_name ? `${train_name}${train_number ? ' (' + train_number + ')' : ''}` : 'Kereta KAI';

    let snap = { token: '', redirect_url: '' };
    try {
      snap = await createSnapTransaction({
        orderId,
        amount: Math.round(total_amount),
        customerName: `${booker.first_name} ${booker.last_name || ''}`.trim(),
        customerEmail: booker.email,
        customerPhone: (booker.calling_code || '62') + booker.mobile,
        itemDetails: [{
          id: orderId,
          price: Math.round(total_amount),
          quantity: 1,
          name: `Tiket Kereta: ${routeLabel} - ${trainLabel}`.substring(0, 50),
        }],
      });
    } catch (e: any) {
      console.error('[Midtrans ERROR]', e.message);
      return NextResponse.json({ success: false, error: `Gagal membuat pembayaran: ${e.message}` }, { status: 500 });
    }

    // 3. Simpan ke database
    await bookingStore.create({
      id: orderId,
      userId: (session.user as any).id,
      orderNumber,
      pnr,
      provider: 'kai',
      bookingType: 'train',
      status: 'pending_payment',
      totalAmount: total_amount,
      currency: 'IDR',
      // Pakai field yang tepat untuk kereta
      routeLabel,
      origin: origin || '',
      destination: destination || '',
      departureDate: departure_date || null,
      flightNumber: train_number || '',   // reuse untuk nomor kereta
      airlineName: train_name || '',       // reuse untuk nama kereta
      passengerData: passengers,
      bookingData: {
        ...bookingData,
        cabin_class,
        hold_date: holdDate,
        state,
      },
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
    });

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      pnr,
      holdDate,
      state,
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
    });

  } catch (e: any) {
    console.error('[Train Book] Internal error:', e.message);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan sistem internal.' }, { status: 500 });
  }
}
