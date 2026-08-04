import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';
import { hotelBookSchema, validateBody, apiError } from '@/lib/validate';
import { getMarkup, applyPercentMarkup } from '@/lib/markup';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { generateBookingId } from '@/lib/security';
import { verifyHotelPrice } from '@/lib/hotel-price';
import type { Prisma } from '@prisma/client';

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ip = getClientIp(req as unknown as Request);
  const rateLimit = await checkRateLimit(`booking:hotel:${ip}`, 'booking');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan booking. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const body = await req.json();
    const validation = validateBody(hotelBookSchema, body);
    if (!validation.success) return validation.response;

    const {
      hotel_code,
      price_code,
      provider,
      passenger,
      contact,
      booker,
      special_request,
      search_data,
      total_amount,
      hotel_name,
    } = validation.data;

    const normalizedPassengers = Array.isArray(passenger) ? passenger : passenger ? [passenger] : [];
    const normalizedContacts = Array.isArray(contact) ? contact : contact ? [contact] : [];

    let effectivePriceCode = String(price_code);
    let effectiveTotalAmount = Number(total_amount);

    // ── Provision re-check (price revalidation) — berlaku untuk SEMUA price_code ──
    // Sebelumnya hanya dijalankan ketika price_code berupa integer sequence;
    // price_code string (format `{int}~{float}` dari get_details/provision) dilewati
    // sehingga total_amount client dipercaya begitu saja. Sekarang harga selalu
    // diverifikasi ulang dari server; kegagalan verifikasi = booking DITOLAK.
    try {
      const verified = await verifyHotelPrice({
        hotel_code: String(hotel_code),
        price_code: effectivePriceCode,
        provider: provider || '',
        search_data,
      });
      effectivePriceCode = verified.priceCode;
      effectiveTotalAmount = verified.priceTotal;
      console.log(`[Hotel Book] Harga terverifikasi: ${effectivePriceCode} = ${effectiveTotalAmount}${verified.priceChanged ? ' (berubah)' : ''}`);
    } catch (verifErr: any) {
      if (verifErr?.priceError === 'SESSION_EXPIRED') {
        return apiError('Sesi pencarian hotel telah kedaluwarsa. Silakan cari kamar kembali.', 410);
      }
      console.error('Hotel price verification error:', verifErr?.message);
      return apiError('Harga kamar tidak dapat diverifikasi saat ini. Silakan pilih kamar lagi atau coba beberapa saat lagi.', 409);
    }

    // Re-check price difference
    const priceDiff = Math.abs(effectiveTotalAmount - total_amount);
    const maxAllowedDiff = total_amount * 0.05;
    if (priceDiff > maxAllowedDiff) {
      return NextResponse.json(
        {
          success: false,
          error: 'PRICE_CHANGED',
          message: `Harga telah berubah dari Rp${total_amount.toLocaleString('id-ID')} menjadi Rp${effectiveTotalAmount.toLocaleString('id-ID')}.`,
          originalPrice: total_amount,
          newPrice: effectiveTotalAmount,
        },
        { status: 409 }
      );
    }

    // Apply markup (percentage)
    const markup = await getMarkup();
    const markedUpAmount = applyPercentMarkup(effectiveTotalAmount, markup.hotel);
    console.log(`[Hotel Book] Markup applied: ${markup.hotel}% = ${effectiveTotalAmount} → ${markedUpAmount}`);

    let bookingData: { order_number?: string } | null = null;
    const orbisPayload: Record<string, unknown> = {
      hotel_code,
      price_code: effectivePriceCode,
      provider: provider || '',
      passenger: normalizedPassengers,
      contact: normalizedContacts,
      booker,
    };
    if (special_request) orbisPayload.special_request = special_request;
    if (search_data) orbisPayload.search_data = search_data;
    console.log('[HOTEL BOOK] Orbisway payload:', JSON.stringify(orbisPayload, null, 2));
    try {
      bookingData = await hotelAPI.createBooking(orbisPayload as import('@/lib/orbis-types').OrbisStruct & { hotel_code: string });
    } catch (error) {
      console.error('Orbis booking error:', error);
      return apiError('Kamar tidak bisa diproses saat ini. Silakan coba lagi beberapa saat.', 502);
    }

    // FIX (Bug #2): ID acak (tidak lagi predictable dari Date.now() saja).
    const orderId = generateBookingId('HTL');
    const effectiveOrderNumber = bookingData?.order_number || orderId;
    const snapAmount = Math.round(markedUpAmount);

    let snap = { token: '', redirect_url: '' };
    try {
      snap = await createSnapTransaction({
        orderId,
        amount: snapAmount,
        customerName: `${booker.first_name || ''} ${booker.last_name || ''}`.trim(),
        customerEmail: booker.email || 'noemail@example.com',
        customerPhone: (booker.calling_code || '62') + (booker.mobile || ''),
        itemDetails: [{ id: hotel_code, price: snapAmount, quantity: 1, name: hotel_name || 'Hotel Booking' }],
      });
    } catch (error) {
      console.error('Midtrans error:', error);
      return apiError('Sistem pembayaran sedang tidak tersedia. Silakan coba lagi.', 502);
    }

    const booking = {
      id: orderId,
      userId: ((session?.user as { id?: string } | null)?.id) ?? undefined,
      orderNumber: effectiveOrderNumber,
      bookingType: 'hotel',
      status: 'pending_payment',
      totalAmount: snapAmount,
      currency: 'IDR',
      hotelName: hotel_name,
      passengerData: normalizedPassengers as unknown as Prisma.InputJsonValue,
      bookingData: {
        ...(bookingData ?? {}),
        booker,
        contact: normalizedContacts,
      } as Prisma.InputJsonValue,
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
      checkinDate: search_data.checkin_date,
      checkoutDate: search_data.checkout_date,
      createdAt: new Date().toISOString(),
    };

    await bookingStore.create(booking);

    return NextResponse.json({
      success: true,
      orderId,
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
      orderNumber: effectiveOrderNumber,
    });
  } catch (error) {
    console.error('Hotel booking route error:', error);
    return apiError('Gagal membuat pemesanan hotel.', 500);
  }
}
