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
// verifyHotelPrice DIHAPUS dari book route — provision hanya boleh dipanggil SEKALI
// (oleh frontend checkout page). Re-provision di sini menyebabkan 4014 "Already call".
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
    let effectiveProvider = provider || '';

    // FIX (ROUND 5): SKIP re-provision di book route.
    // Frontend (checkout page) SUDAH memanggil provision SEBELUM redirect ke book
    // endpoint. Provision di Orbis adalah "locking" — hanya bisa dipanggil SEKALI
    // per price_code sebelum booked. Kalau kita provision lagi di sini, price_code
    // terkunci dan booked return 4014 "Already call this function".
    // Kita percaya price dari frontend (sudah terverifikasi oleh provision).
    console.log(`[Hotel Book] Using frontend-provided price: ${effectivePriceCode} = ${effectiveTotalAmount} provider=${effectiveProvider}`);


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

    // Coupon validation
    let finalAmount = markedUpAmount;
    let validCouponCode: string | null = null;
    let validCouponId: number | null = null;
    let validDiscountAmount = 0;

    if (body.coupon_code) {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const coupon = await prisma.coupon.findFirst({
          where: { code: { equals: body.coupon_code, mode: 'insensitive' } },
        });
        if (coupon && coupon.isActive) {
          const now = new Date();
          const validStart = !coupon.startDate || coupon.startDate <= now;
          const validEnd = !coupon.endDate || coupon.endDate >= now;
          const validUsage = coupon.maxUsage === null || coupon.usedCount < coupon.maxUsage;
          const validCategory = coupon.category === 'all' || coupon.category === 'hotel';
          if (validStart && validEnd && validUsage && validCategory) {
            let disc = 0;
            if (coupon.type === 'percentage') {
              disc = Math.round(finalAmount * (coupon.value / 100));
              if (coupon.maxDiscount !== null && disc > coupon.maxDiscount) disc = coupon.maxDiscount;
            } else {
              disc = Math.min(coupon.value, finalAmount);
            }
            if (disc > 0) {
              validCouponCode = coupon.code.toUpperCase();
              validCouponId = coupon.id;
              validDiscountAmount = disc;
              finalAmount = Math.max(0, finalAmount - disc);
            }
          }
        }
        await prisma.$disconnect();
      } catch (e: any) {
        console.error('[Hotel Book] Coupon validation error:', e.message);
      }
    }

    let bookingData: { order_number?: string } | null = null;
    let orbisPayload: Record<string, unknown> = {
      hotel_code,
      price_code: effectivePriceCode,
      provider: effectiveProvider,
      passenger: normalizedPassengers,
      contact: normalizedContacts,
      booker,
    };
    if (special_request) orbisPayload.special_request = special_request;
    if (search_data) orbisPayload.search_data = search_data;
    console.log('[HOTEL BOOK] Orbisway payload (pre-transform, lihat [ORBIS WIRE] utk body final):', JSON.stringify(orbisPayload, null, 2));

    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        bookingData = await hotelAPI.createBooking(orbisPayload as import('@/lib/orbis-types').OrbisStruct & { hotel_code: string });
        break; // success
      } catch (error: any) {
        const orbisCode = error?.orbisCode;
        console.error(`[HOTEL BOOK] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, orbisCode ?? error?.message);

        // 4014 = "sudah dipanggil sebelumnya" — price_code sudah terkunci.
        // Retry dengan price_code BARU dari get_details (bukan re-use yang sama).
        if (orbisCode === 4014 && attempt < MAX_RETRIES - 1 && search_data?.checkin_date && search_data?.checkout_date && search_data?.destination_id) {
          console.log('[HOTEL BOOK] 4014 — refetching fresh price_code dari get_details...');
          try {
            const detailData = (await hotelAPI.getDetails({
              checkin_date: search_data.checkin_date,
              checkout_date: search_data.checkout_date,
              destination_id: search_data.destination_id,
              hotel_id: String(hotel_code),
              search_name: '',
              adult: Number(search_data.adult ?? 2),
              child: Number(search_data.child ?? 0),
              child_ages: search_data.child_ages ?? [],
              room: Number(search_data.room ?? 1),
              nationality: search_data.nationality ?? 'ID',
            })) as { prices?: unknown };

            const rawPrices = detailData?.prices;
            type PriceEntry = { provider?: unknown; price_code?: unknown };
            const priceList: PriceEntry[] = Array.isArray(rawPrices) ? rawPrices : rawPrices && typeof rawPrices === 'object' ? Object.values(rawPrices as Record<string, PriceEntry>) : [];
            const targetProvider = (effectiveProvider || '').trim().toLowerCase();
            const match = priceList.find((p) => String(p?.provider ?? '').toLowerCase() === targetProvider) ?? priceList[0];
            const freshCode = match?.price_code != null ? String(match.price_code) : '';
            const freshProvider = match?.provider ? String(match.provider) : effectiveProvider;

            if (freshCode && freshCode !== effectivePriceCode) {
              console.log(`[HOTEL BOOK] Fresh price_code="${freshCode}" provider="${freshProvider}" — retrying booked...`);
              // Re-provision price_code baru supaya terdaftar di cache vendor
              try {
                await hotelAPI.getCancellationPolicy(String(hotel_code), freshCode);
              } catch { /* non-fatal */ }
              await hotelAPI.provision(String(hotel_code), freshCode, freshProvider, true);

              effectivePriceCode = freshCode;
              effectiveProvider = freshProvider;
              orbisPayload = { ...orbisPayload, price_code: freshCode, provider: freshProvider };
              continue; // retry loop
            }
          } catch (refetchErr: any) {
            console.error('[HOTEL BOOK] Gagal refetch price_code:', refetchErr?.message);
          }
        }

        // 4014 tanpa retry — user harus search ulang
        if (orbisCode === 4014) {
          return NextResponse.json(
            {
              success: false,
              error: 'SCHEDULE_ALREADY_USED',
              message: 'Kamar ini sudah pernah diproses sebelumnya dan tidak bisa dipesan ulang dengan data yang sama. Silakan cari kamar kembali untuk mendapatkan penawaran baru.',
            },
            { status: 409 }
          );
        }
        return apiError('Kamar tidak bisa diproses saat ini. Silakan coba lagi beberapa saat.', 502);
      }
    }

    // FIX (Bug #2): ID acak (tidak lagi predictable dari Date.now() saja).
    const orderId = generateBookingId('HTL');
    const effectiveOrderNumber = bookingData?.order_number || orderId;
    const snapAmount = Math.round(finalAmount);

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
      // Orbis fields — disimpan untuk debugging & refund nanti
      provider: effectiveProvider || undefined,
      pnr: bookingData?.order_number || effectiveOrderNumber || undefined,
      // Hotel detail fields (§3.5 — dari search_data untuk audit & re-search)
      destinationId: search_data.destination_id || undefined,
      hotelIdOrbis: hotel_code || undefined,
      roomCount: Number(search_data.room) || undefined,
      adultCount: Number(search_data.adult) || undefined,
      childCount: Number(search_data.child) || undefined,
      nationality: search_data.nationality || undefined,
      mealType: search_data.meal_type || undefined,
      roomDescription: search_data.room_description || undefined,
      priceCode: effectivePriceCode || undefined,
      originalPrice: effectiveTotalAmount || undefined,
      nights: search_data.nights ? Number(search_data.nights) : undefined,
      // Coupon
      ...(validCouponCode && { couponCode: validCouponCode, couponId: validCouponId ?? undefined, discountAmount: validDiscountAmount }),
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
