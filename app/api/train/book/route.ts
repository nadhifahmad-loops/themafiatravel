import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI, getOrbisSignature } from '@/lib/orbis';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';
import { trainBookSchema, validateBody, apiError } from '@/lib/validate';
import { getMarkup, applyFlatMarkup } from '@/lib/markup';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { generateBookingId } from '@/lib/security';
import { checkSubmittedPrice } from '@/lib/price-check';
import type { Prisma } from '@prisma/client';

export const maxDuration = 90;

// Sesi maskapai global dipakai semua user; order yang sama milik akun lain
// tidak boleh dibocorkan ke requester ini.
function isSameOwner(existingUserId: string | null | undefined, currentUserId: string | null | undefined): boolean {
  if (existingUserId && currentUserId) return existingUserId === currentUserId;
  return existingUserId === currentUserId;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId: string | null = session?.user.id ?? null;
  const ip = getClientIp(req as unknown as Request);
  const rateLimit = await checkRateLimit(`booking:train:${ip}`, 'booking');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan booking. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const body = await req.json();
    const validation = validateBody(trainBookSchema, body);
    if (!validation.success) return validation.response;

    const {
      contacts,
      passengers,
      schedules,
      booker,
      total_amount,
      origin,
      destination,
      departure_date,
      arrival_date,
      train_name,
      train_number,
      cabin_class,
    } = validation.data;

    // ── STEP 0: Price Revalidation (fail-closed) ──────────────────────────
    // total_amount dikirim dari client — sebelumnya dipercaya mentah-mentah,
    // artinya siapa pun bisa mengubahnya di request jadi lebih rendah dari
    // harga asli sementara kursi KAI tetap dibooking dengan harga asli.
    // Cari ulang jadwal yang sama & bandingkan dengan harga dasar riil.
    // Perbandingan dibuat SATU ARAH (hanya cek batas bawah) karena
    // total_amount yang sah memang sudah termasuk biaya admin platform di
    // atas harga dasar KAI — jadi lebih tinggi itu wajar, lebih rendah itu
    // indikasi manipulasi harga. Jika harga riil tidak bisa diverifikasi,
    // booking DITOLAK (fail-closed).
    try {
      const journeyCode = schedules?.[0]?.journeys?.[0]?.journey_code;
      const fareCode = schedules?.[0]?.journeys?.[0]?.fare_code;

      if (!journeyCode || !fareCode || !origin || !destination || !departure_date) {
        console.warn('[Train Book] Price revalidation gagal: data jadwal tidak lengkap.');
        return apiError('Data jadwal tidak lengkap untuk verifikasi harga. Silakan cari ulang.', 422, { error: 'REVALIDATION_REQUIRED' });
      }

      const adultCount = (passengers || []).filter((p: any) => (p.pax_type || 'ADT') !== 'INF').length || 1;
      const infantCount = (passengers || []).filter((p: any) => p.pax_type === 'INF').length;

      const searchResult = await trainAPI.search({
        journey_list: [{ origin, destination, departure_date }],
        direction: 'OW',
        adult: adultCount,
        infant: infantCount,
        provider: 'kai',
      });

      const allJourneys = (searchResult?.schedules || []).flatMap((s: any) => s.journeys || []);
      const matchedJourney = allJourneys.find((j: any) => j.journey_code === journeyCode);
      const matchedFare = matchedJourney?.fares?.find((f: any) => f.fare_code === fareCode);
      const summary = matchedFare?.service_charge_summary?.[0];
      const realBasePrice = summary?.base_price || summary?.base_fare;

      const realTotal = realBasePrice != null ? Number(realBasePrice) * adultCount : undefined;
      const priceCheck = checkSubmittedPrice({ submitted: total_amount, refreshed: realTotal, lowerBoundOnly: true });

      if (priceCheck.kind === 'changed') {
        console.warn(`[Train Book] PRICE_CHANGED — submitted=${total_amount} realBase=${realTotal}`);
        return apiError(priceCheck.message || 'Harga tiket telah berubah. Silakan cari ulang jadwal untuk melanjutkan.', 409, {
          error: 'PRICE_CHANGED',
          originalPrice: priceCheck.originalPrice,
          newPrice: priceCheck.newPrice,
        });
      }
      if (priceCheck.kind === 'unverifiable') {
        console.warn(`[Train Book] PRICE_UNVERIFIABLE — submitted=${total_amount} realBasePrice=${realBasePrice}`);
        return apiError('Harga tiket tidak dapat diverifikasi saat ini. Silakan coba lagi beberapa saat.', 503, { error: 'PRICE_UNVERIFIABLE' });
      }
    } catch (priceErr: any) {
      console.error('[Train Book] Price revalidation error:', priceErr.message);
      return apiError('Harga tiket tidak dapat diverifikasi saat ini. Silakan coba lagi beberapa saat.', 503, { error: 'PRICE_UNVERIFIABLE' });
    }

    // 1. Commit booking ke KAI via Orbis (dibungkus agar bisa diulang sekali
    //    dengan sesi baru ketika sesi global masih memegang order lama).
    const commitForOrder = async (): Promise<{
      bookingData: any;
      orderNumber: string;
      pnr: string;
      holdDate: string;
      state: string;
    }> => {
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
        console.error('[KAI commitBooking ERROR]', e.message, 'code:', e?.orbisCode);
        const err = Object.assign(new Error(`Gagal mengunci kursi KAI: ${e.message}`), { status: 422, orbisCode: e?.orbisCode });
        throw err;
      }

      const orderNumber = bookingData?.order_number;
      const pnr = bookingData?.pnr || '';
      const holdDate = bookingData?.hold_date || '';
      const state = bookingData?.state || 'booked';

      if (!orderNumber) {
        throw Object.assign(new Error('KAI tidak mengembalikan order_number'), { status: 500 });
      }

      return { bookingData, orderNumber, pnr, holdDate, state };
    };

    const isLegitRetry = (existing: any) =>
      !!existing && isSameOwner(existing.userId, userId) && existing.status === 'pending_payment';

    const commitOrRespond = async () => {
      try {
        return await commitForOrder();
      } catch (e: any) {
        return apiError(e.message, e.status || 422, { orbisCode: e?.orbisCode });
      }
    };

    const first = await commitOrRespond();
    if (first instanceof NextResponse) return first;

    let { bookingData, orderNumber, pnr, holdDate, state } = first;

    // 1.5. Idempotency + pemulihan sesi stale.
    // Orbis commit_booking mengembalikan order_number yang SAMA saat sesi global
    // masih memegang order lama. Retry sah (owner sama & pending_payment) →
    // kembalikan booking lama; selain itu refresh sesi & ulangi sekali.
    const respondExisting = (existing: any, fallbackToken?: string, fallbackUrl?: string) =>
      NextResponse.json({
        success: true,
        orderId: existing.id,
        orderNumber,
        pnr: existing.pnr || pnr,
        holdDate: (existing.bookingData as any)?.hold_date || holdDate,
        state: existing.status,
        snapToken: existing.snapToken || fallbackToken || '',
        redirectUrl: existing.snapRedirectUrl || fallbackUrl || '',
        duplicate: true,
      });

    const existingBooking = await bookingStore.findByOrderNumber(orderNumber);
    if (existingBooking) {
      if (isLegitRetry(existingBooking)) {
        console.log(`[Train Book] Duplicate orderNumber (${orderNumber}) → return existing ${existingBooking.id}`);
        return respondExisting(existingBooking);
      }

      console.warn(`[Train Book] orderNumber ${orderNumber} sudah ada (status=${existingBooking.status}, owner=${existingBooking.userId}) → refresh sesi & ulangi`);
      await getOrbisSignature(true).catch(() => {});
      const second = await commitOrRespond();
      if (second instanceof NextResponse) return second;

      ({ bookingData, orderNumber, pnr, holdDate, state } = second);

      const retriedExisting = await bookingStore.findByOrderNumber(orderNumber);
      if (retriedExisting) {
        if (isLegitRetry(retriedExisting)) {
          console.log(`[Train Book] Duplicate setelah refresh sesi → return existing ${retriedExisting.id}`);
          return respondExisting(retriedExisting);
        }
        return apiError('Sesi maskapai sedang dipakai transaksi lain. Silakan coba lagi beberapa saat.', 409, { duplicateOtherOwner: true });
      }
    }

    // Apply markup (flat per tiket)
    const markup = await getMarkup();
    const adultCount = (passengers || []).filter((p: any) => (p.pax_type || 'ADT') !== 'INF').length || 1;
    const infantCount = (passengers || []).filter((p: any) => p.pax_type === 'INF').length;
    const paxCount = adultCount + infantCount;
    const markedUpAmount = applyFlatMarkup(total_amount, markup.train, paxCount);
    console.log(`[Train Book] Markup applied: Rp${markup.train} x ${paxCount} pax = ${total_amount} → ${markedUpAmount}`);

    // 2. Buat transaksi Midtrans
    // FIX (Bug #2): ID acak (tidak lagi predictable dari Date.now() saja).
    const orderId = generateBookingId('TRN');
    const routeLabel = `${origin || ''} → ${destination || ''}`;
    const trainLabel = train_name ? `${train_name}${train_number ? ' (' + train_number + ')' : ''}` : 'Kereta KAI';

    let snap = { token: '', redirect_url: '' };
    try {
      snap = await createSnapTransaction({
        orderId,
        amount: Math.round(markedUpAmount),
        customerName: `${booker.first_name} ${booker.last_name || ''}`.trim(),
        customerEmail: booker.email,
        customerPhone: (booker.calling_code || '62') + booker.mobile,
        itemDetails: [{
          id: orderId,
          price: Math.round(markedUpAmount),
          quantity: 1,
          name: `Tiket Kereta: ${routeLabel} - ${trainLabel}`.substring(0, 50),
        }],
      });
    } catch (e: any) {
      console.error('[Midtrans ERROR]', e.message);
      return apiError(`Gagal membuat pembayaran: ${e.message}`, 500);
    }

    // 3. Simpan ke database
    try {
      await bookingStore.create({
        id: orderId,
        userId: session?.user.id ?? undefined,
        orderNumber,
        pnr,
        provider: 'kai',
        bookingType: 'train',
        status: 'pending_payment',
        totalAmount: markedUpAmount,
        currency: 'IDR',
        routeLabel,
        origin: origin || '',
        destination: destination || '',
        departureDate: departure_date || null,
        flightNumber: train_number || '',
        airlineName: train_name || '',
        passengerData: passengers as unknown as Prisma.InputJsonValue,
        bookingData: {
          ...bookingData,
          booker,
          contacts,
          cabin_class,
          hold_date: holdDate,
          state,
        } as Prisma.InputJsonValue,
        snapToken: snap.token,
        snapRedirectUrl: snap.redirect_url,
      });
    } catch (e: any) {
      // Race condition (dua request paralel): kembalikan booking yang sudah tersimpan.
      if (e?.code === 'P2002') {
        const existing = await bookingStore.findByOrderNumber(orderNumber);
        if (existing) {
          if (!isLegitRetry(existing)) {
            console.warn(`[Train Book] Race duplicate tidak valid (status=${existing.status}) → ditolak`);
            await getOrbisSignature(true).catch(() => {});
            return apiError('Sesi maskapai sedang dipakai transaksi lain. Silakan coba lagi beberapa saat.', 409, { duplicateOtherOwner: true });
          }
          console.log('[Train Book] Race duplicate → return existing', existing.id);
          return respondExisting(existing, snap.token, snap.redirect_url);
        }
      }
      console.error('[Train Book] DB error:', e.message);
      return apiError('Gagal menyimpan pesanan. Silakan coba lagi.', 500);
    }

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
    return apiError('Terjadi kesalahan sistem internal.', 500);
  }
}