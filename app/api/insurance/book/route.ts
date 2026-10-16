import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insuranceAPI } from '@/lib/orbis';
import { revalidateInsurancePrice } from '@/lib/insurance-quote';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';
import { insuranceBookSchema, validateBody, apiError } from '@/lib/validate';
import { getMarkup, applyPercentMarkup } from '@/lib/markup';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { generateBookingId } from '@/lib/security';
import { checkSubmittedPrice } from '@/lib/price-check';
import { withIdempotency, hashPayload, readBodyIdempotencyKey, recordIdempotencyOrderId } from '@/lib/idempotency';
import type { Prisma } from '@prisma/client';

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ip = getClientIp(req as unknown as Request);
  const rateLimit = await checkRateLimit(`booking:insurance:${ip}`, 'booking');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan booking. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
    );
  }

  // Body dibaca DI SINI — stream NextRequest hanya bisa dibaca sekali, jadi
  // hasilnya dipakai dua kali: sebagai fingerprint idempotency dan input handler.
  let body: any;
  try {
    body = await req.json();
  } catch {
    return apiError('Request body tidak valid.', 400);
  }

  try {
    // Gerbang idempotency: ditempatkan SEBELUM sell_insurance / commit_booking
    // sehingga dari dua request identik (klik ganda / retry duplikat) hanya satu
    // yang dieksekusi. Request kedua menerima response tersimpan (duplicate)
    // atau 409 IN_PROGRESS bila yang pertama masih berjalan.
    return await withIdempotency({
      rawKey: req.headers.get('idempotency-key') ?? readBodyIdempotencyKey(body),
      bookingType: 'insurance',
      userId: session?.user?.id ?? null,
      payloadHash: hashPayload(body),
      run: (idempotencyKey) => handleBook({ body, session, idempotencyKey }),
    });
  } catch (e: any) {
    console.error('[INSURANCE BOOK] Fatal:', e.message);
    return apiError(e.message || 'Gagal membuat pemesanan asuransi', 500);
  }
}

async function handleBook(args: {
  body: any;
  session: any;
  idempotencyKey: string | null;
}): Promise<NextResponse> {
  const { body, session, idempotencyKey } = args;
  try {
    const validation = validateBody(insuranceBookSchema, body);
    if (!validation.success) return validation.response;

    const {
      contacts,
      passengers,
      booker,
      provider,
      carrier_code,
      total_amount,
      product_name,
      product_code,
      package: packageId,
      date_start,
      date_end,
    } = validation.data;

    // ── STEP 0: Price Revalidation (fail-closed) ──────────────────────────
    // total_amount dikirim dari client — sebelumnya dipercaya mentah-mentah,
    // artinya siapa pun bisa mengubahnya di request jadi lebih rendah dari
    // premi asli sementara polis tetap diterbitkan dengan harga asli.
    // Re-quote produk yang sama (sellInsurance) & bandingkan dengan premi riil.
    // Perbandingan SATU ARAH (hanya cek batas bawah) — total_amount yang sah
    // memang sudah termasuk biaya admin platform di atas premi dasar, jadi
    // lebih tinggi itu wajar, lebih rendah itu indikasi manipulasi harga.
    // Jika premi riil tidak bisa diverifikasi, booking DITOLAK (fail-closed).
    if (!product_code) {
      console.warn('[Insurance Book] Price revalidation gagal: product_code tidak dikirim.');
      return apiError('Data produk asuransi tidak lengkap untuk verifikasi harga. Silakan pilih ulang produk.', 422, { error: 'REVALIDATION_REQUIRED' });
    }
    try {
      const paxCount = Array.isArray(passengers) && passengers.length > 0 ? passengers.length : 1;
      const quote = await revalidateInsurancePrice({
        productCode: product_code,
        provider,
        carrierCode: carrier_code,
        dateStart: date_start || '',
        dateEnd: date_end || '',
        pax: paxCount,
        destination: body.destination,
        destinationArea: body.destination_area,
        isSenior: body.is_senior,
        international: body.international,
        type: body.type,
        productType: body.product_type,
      });
      const realPrice = quote.price;

      const priceCheck = checkSubmittedPrice({ submitted: total_amount, refreshed: realPrice, lowerBoundOnly: true });

      if (priceCheck.kind === 'changed') {
        console.warn(`[Insurance Book] PRICE_CHANGED — submitted=${total_amount} realPrice=${realPrice}`);
        return apiError(priceCheck.message || 'Harga premi telah berubah. Silakan pilih ulang produk asuransi.', 409, {
          error: 'PRICE_CHANGED',
          originalPrice: priceCheck.originalPrice,
          newPrice: priceCheck.newPrice,
        });
      }
      if (priceCheck.kind === 'unverifiable') {
        console.warn(`[Insurance Book] PRICE_UNVERIFIABLE — submitted=${total_amount} realPrice=${realPrice}`);
        return apiError('Harga premi tidak dapat diverifikasi saat ini. Silakan coba lagi beberapa saat.', 503, { error: 'PRICE_UNVERIFIABLE' });
      }
    } catch (priceErr: any) {
      console.error('[Insurance Book] Price revalidation error:', priceErr.message);
      return apiError('Harga premi tidak dapat diverifikasi saat ini. Silakan coba lagi beberapa saat.', 503, { error: 'PRICE_UNVERIFIABLE' });
    }

    // 1. Bentuk sesi sell insurance sebelum commit_booking.
    // Availability hanya membaca katalog; Orbis membutuhkan sell_insurance
    // pada sesi yang sama sebelum data peserta dapat di-commit.
    try {
      const today = new Date();
      const ageArray = passengers.map((passenger: any) => {
        const birthDate = new Date(passenger.birth_date || '1996-01-01');
        let age = today.getFullYear() - birthDate.getFullYear();
        const birthdayNotReached = today.getMonth() < birthDate.getMonth()
          || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
        if (birthdayNotReached) age -= 1;
        return Math.max(0, age);
      });

      const sellPayload = {
        data: {
          product_code,
          provider,
          carrier_code: carrier_code || provider,
        },
        pax: passengers.length,
        package: Number(packageId) || 1,
        age: ageArray,
        age_type: 'age',
        adult: passengers.length,
      } as const;
      console.log('[INSURANCE] Sell insurance payload:', JSON.stringify(sellPayload));
      await insuranceAPI.sellInsurance(sellPayload);
    } catch (e: any) {
      console.error('[INSURANCE] Sell insurance error:', e.message);
      return apiError(`Gagal menyiapkan paket asuransi: ${e.message}`, 422);
    }

    // 2. Commit Booking ke API Asuransi Orbis
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
      return apiError(`Gagal membuat polis asuransi: ${e.message}`, 422);
    }

    // Apply markup (percentage)
    const markup = await getMarkup();
    const markedUpAmount = applyPercentMarkup(total_amount, markup.insurance);
    console.log(`[Insurance Book] Markup applied: ${markup.insurance}% = ${total_amount} → ${markedUpAmount}`);

    // Coupon validation
    let finalAmount = markedUpAmount;
    let validCouponCode: string | null = null;
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
          const validCategory = coupon.category === 'all' || coupon.category === 'insurance';
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
              validDiscountAmount = disc;
              finalAmount = Math.max(0, finalAmount - disc);
            }
          }
        }
        await prisma.$disconnect();
      } catch (e: any) {
        console.error('[Insurance Book] Coupon validation error:', e.message);
      }
    }

    // 2. Buat Transaksi Midtrans
    // FIX (Bug #2): ID acak (tidak lagi predictable dari Date.now() saja).
    const orderId = generateBookingId('INS');
    // Dicatat SEBELUM bookingStore.create: bila proses crash di antara dua
    // langkah ini, klaim idempotency berikutnya menemukan Booking yang sudah
    // tersimpan dan mengembalikannya sebagai duplicate, bukan order kedua.
    await recordIdempotencyOrderId(idempotencyKey, orderId);
    let snap = { token: '', redirect_url: '' };
    try {
      snap = await createSnapTransaction({
        orderId,
        amount: finalAmount,
        customerName: `${booker.first_name} ${booker.last_name}`,
        customerEmail: booker.email,
        customerPhone: booker.calling_code + booker.mobile,
        itemDetails: [{
          id: product_code || orderId,
          price: Math.round(finalAmount),
          quantity: 1,
          name: `Asuransi: ${product_name || 'Travel Insurance'}`,
        }],
      });
    } catch (e: any) {
      console.error('[Midtrans] error:', e.message);
      return apiError(`Gagal membuat pembayaran: ${e.message}`, 500);
    }

    // 3. Simpan ke database (baik login maupun guest)
    const orderNumber = bookingData?.order_number || orderId;
    let existingBooking: any = null;
    try {
      await bookingStore.create({
        id: orderId,
        userId: session?.user.id ?? undefined,
        orderNumber,
        bookingType: 'insurance',
        status: 'pending_payment',
        totalAmount: finalAmount,
        currency: 'IDR',
        hotelName: product_name || 'Asuransi Perjalanan',
        checkinDate: date_start ? new Date(date_start).toISOString() : new Date().toISOString(),
        checkoutDate: date_end ? new Date(date_end).toISOString() : new Date().toISOString(),
        passengerData: passengers as unknown as Prisma.InputJsonValue,
        bookingData: {
          ...(bookingData || {}),
          booker,
          contacts,
        } as Prisma.InputJsonValue,
        snapToken: snap.token,
        snapRedirectUrl: snap.redirect_url,
        ...(validCouponCode && { couponCode: validCouponCode, discountAmount: validDiscountAmount }),
      });
    } catch (dbErr: any) {
      // orderNumber sudah tercatat oleh percobaan sebelumnya (unique violation)
      // → kembalikan booking yang SUDAH ADA, jangan membuat pesanan kedua.
      if (dbErr?.code === 'P2002') {
        const found = await bookingStore.findByOrderNumber(orderNumber).catch(() => null);
        const sameOwner = (found?.userId ?? null) === (session?.user?.id ?? null);
        if (found && sameOwner) {
          console.warn('[Insurance Book] orderNumber duplikat → kembalikan booking lama:', found.id);
          existingBooking = found;
        } else {
          console.error('[Insurance Book] P2002 dengan owner berbeda / tidak ditemukan:', dbErr.message);
          return apiError('Nomor pesanan bentrok. Silakan coba lagi.', 409);
        }
      } else {
        // KEGAGALAN DB TIDAK BOLEH DISELENGOK — polis sudah terbit di Orbis
        // tetapi tanpa baris Booking, pembayaran user tidak akan pernah
        // tercatat. Kembalikan error supaya klaim idempotency dilepas dan user
        // boleh mengulang dengan aman.
        console.error('[DB] Save booking error:', dbErr.message);
        return apiError('Gagal menyimpan pesanan. Silakan coba lagi.', 500);
      }
    }

    if (existingBooking) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        orderId: existingBooking.id,
        snapToken: existingBooking.snapToken || snap.token,
        redirectUrl: existingBooking.snapRedirectUrl || snap.redirect_url,
        orderNumber: existingBooking.orderNumber,
        bookingData,
      });
    }

    return NextResponse.json({
      success: true,
      orderId,
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
      orderNumber,
      bookingData,
    });

  } catch (e: any) {
    console.error('[INSURANCE BOOK] Fatal:', e.message);
    return apiError(e.message || 'Gagal membuat pemesanan asuransi', 500);
  }
}