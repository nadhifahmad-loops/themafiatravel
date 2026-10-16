import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { flightAPI, getOrbisSignature, OrbisSchedule, OrbisPassenger } from '@/lib/orbis';
import { buildOrbisContacts, buildOrbisPassengers, hashOrbisContacts, hashOrbisPassengers } from '@/lib/orbis-flight-payload';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';
import { flightBookSchema, validateBody } from '@/lib/validate';
import { getMarkup, applyFlatMarkup } from '@/lib/markup';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { generateBookingId } from '@/lib/security';
import { checkSubmittedPrice } from '@/lib/price-check';
import { withIdempotency, hashPayload, readBodyIdempotencyKey, recordIdempotencyOrderId } from '@/lib/idempotency';
import { CARRIER_CODE_TO_AIRLINE, PROVIDER_ID_TO_LABEL } from '@/lib/providers';

export const maxDuration = 90;

function resolveAirlineName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  if (CARRIER_CODE_TO_AIRLINE[upper]) return CARRIER_CODE_TO_AIRLINE[upper];
  const lower = trimmed.toLowerCase();
  if (PROVIDER_ID_TO_LABEL[lower]) return PROVIDER_ID_TO_LABEL[lower];
  return trimmed;
}

function errorResponse(message: string, status = 422, extra?: object) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status });
}

// Sesi maskapai bersifat global (dipakai semua user). Jika order yang sama sudah
// dibuat oleh akun LAIN, jangan bocorkan booking orang lain ke requester ini.
function isSameOwner(existingUserId: string | null | undefined, currentUserId: string | null): boolean {
  if (existingUserId && currentUserId) return existingUserId === currentUserId;
  return existingUserId === currentUserId; // keduanya guest → ok; salah satu login → tidak
}

export async function POST(req: NextRequest) {
  try {
    // Body dibaca DI SINI — stream NextRequest hanya bisa dibaca sekali, jadi
    // hasilnya dipakai dua kali: sebagai fingerprint idempotency dan sebagai
    // input handler.
    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Request body tidak valid.', 400);
    }

    const session = await getSession(req);
    const userId: string | null = session?.user?.id ?? null;

    // Gerbang idempotency: ditempatkan SEBELUM seluruh alur booking sehingga
    // dari dua request identik (klik ganda / retry duplikat), hanya satu yang
    // benar-benar mengeksekusi commit_booking + transaksi Midtrans. Request
    // kedua menerima response tersimpan (duplicate) atau 409 IN_PROGRESS.
    return await withIdempotency({
      rawKey: req.headers.get('idempotency-key') ?? readBodyIdempotencyKey(body),
      bookingType: 'flight',
      userId,
      payloadHash: hashPayload(body),
      run: (idempotencyKey) => POSTHandler(req, body, { userId, idempotencyKey }),
    });
  } catch (err: any) {
    console.error('[Flight Book] UNHANDLED ERROR:', err?.message);
    return NextResponse.json({ success: false, error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function POSTHandler(
  req: NextRequest,
  body: any,
  ctx: { userId: string | null; idempotencyKey: string | null },
) {
  const { userId, idempotencyKey } = ctx;
  const ip = getClientIp(req as unknown as Request);
  const rateLimit = await checkRateLimit(`booking:flight:${ip}`, 'booking');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan booking. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
    );
  }

  const validation = validateBody(flightBookSchema, body);
  if (!validation.success) return validation.response;

  const {
    contacts,
    passengers,
    booker,
    schedules,
    is_combo_price,
    adult,
    child,
    infant,
    total_amount,
    route_label,
    origin,
    destination,
    departure_date,
    arrival_date,
    flight_number,
    airline_name,
    selectedSeats,
    is_locked_before,
    preparedContactsHash,
    preparedPassengersHash,
    cabin_class,
    coupon_code,
    discount_amount,
  } = validation.data;

  // ── STEP 0: Price Revalidation (fail-closed) ──────────────────────────────
  // Harga dari client tidak boleh dipercaya mentah-mentah; bila harga riil tidak
  // bisa diverifikasi (error/timeout Orbis), booking DITOLAK alih-alih lanjut.
  try {
    const priceData = await flightAPI.getPriceItinerary({
      adult: Number(adult) || 1,
      child: Number(child) || 0,
      infant: Number(infant) || 0,
      schedules: schedules as OrbisSchedule[],
      promo_codes: [],
    });

    console.log('[Flight Book] Price revalidation OK, refreshed:', priceData?.total_price);

    const priceCheck = checkSubmittedPrice({
      submitted: total_amount,
      refreshed: priceData?.total_price,
      lowerBoundOnly: true,
    });


    if (priceCheck.kind === 'changed') {
      return NextResponse.json(
        {
          success: false,
          error: 'PRICE_CHANGED',
          message: priceCheck.message,
          originalPrice: priceCheck.originalPrice,
          newPrice: priceCheck.newPrice,
        },
        { status: 409 }
      );
    }
    if (priceCheck.kind === 'unverifiable') {
      return errorResponse('Harga tiket tidak dapat diverifikasi saat ini. Silakan coba lagi beberapa saat.', 503, { error: 'PRICE_UNVERIFIABLE' });
    }
    if (priceCheck.kind === 'invalid') {
      return errorResponse('Data harga tidak valid.', 422);
    }
  } catch (priceErr: any) {
    console.error('[Flight Book] Price revalidation error:', priceErr.message);
    return errorResponse('Harga tiket tidak dapat diverifikasi saat ini. Silakan coba lagi beberapa saat.', 503, { error: 'PRICE_UNVERIFIABLE' });
  }

  // ── STEP 0.5: Apply Markup ────────────────────────────────────────────────
  const markup = await getMarkup();
  const paxCount = (Number(adult) || 1) + (Number(child) || 0) + (Number(infant) || 0);
  const markedUpAmount = applyFlatMarkup(total_amount, markup.flight, paxCount);
  console.log(`[Flight Book] Markup applied: Rp${markup.flight} x ${paxCount} pax = +Rp${markup.flight * paxCount} | ${total_amount} → ${markedUpAmount}`);

  // ── STEP 0.6: Validate & Apply Coupon ──────────────────────────────────────
  let finalAmount = markedUpAmount;
  let validCouponCode: string | null = null;
  let validDiscountAmount = 0;

  if (coupon_code) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const coupon = await prisma.coupon.findFirst({
        where: { code: { equals: coupon_code, mode: 'insensitive' } },
      });

      if (coupon && coupon.isActive) {
        const now = new Date();
        const validStart = !coupon.startDate || coupon.startDate <= now;
        const validEnd = !coupon.endDate || coupon.endDate >= now;
        const validUsage = coupon.maxUsage === null || coupon.usedCount < coupon.maxUsage;
        const validCategory = coupon.category === 'all' || coupon.category === 'flight';

        if (validStart && validEnd && validUsage && validCategory) {
          let disc = 0;
          if (coupon.type === 'percentage') {
            disc = Math.round(markedUpAmount * (coupon.value / 100));
            if (coupon.maxDiscount !== null && disc > coupon.maxDiscount) disc = coupon.maxDiscount;
          } else {
            disc = Math.min(coupon.value, markedUpAmount);
          }
          if (disc > 0) {
            validCouponCode = coupon.code.toUpperCase();
            validDiscountAmount = disc;
            finalAmount = Math.max(0, markedUpAmount - disc);
            console.log(`[Flight Book] Coupon ${validCouponCode}: -Rp${disc} → final Rp${finalAmount}`);
          }
        }
      }
      await prisma.$disconnect();
    } catch (e: any) {
      console.error('[Flight Book] Coupon validation error:', e.message);
    }
  }

  // ── Keputusan data: langkah mana yang perlu dikirim ke sesi ────────────────
  // /api/flight/lock (prepare peta kursi) sudah menjalankan sell_journeys +
  // update_contacts + update_passengers pada sesi yang sama — urutan wajib
  // §2.4.1 sebelum get_seat_availability (step 11) dan assign_seats (step 12).
  // Orbis membalas 4014 "You had already call this function" untuk pemanggilan
  // ulang pada sesi yang sama, sehingga bila data diubah SETELAH peta kursi
  // dibuka, perubahan itu bisa di-skip dan tiket tercetak dengan data lama.
  //
  // preparedContactsHash / preparedPassengersHash adalah sidik jari payload
  // yang BENAR-BENAR tersinkron saat prepare (null bila tidak). Dihitung
  // terpisah supaya tiap bagian dinilai sendiri-sendiri:
  //  • cocok   → sesi sudah berisi data identik, langkah dilewati sehingga sesi
  //               dipertahankan dan assign_seats tetap memakai kode kursi
  //               pilihan user;
  //  • beda / null → langkah dijalankan; bila ternyata kena 4014, sesi sudah
  //               berisi data flow LAMA → sesi dibuat baru dan flow diulang.
  const safeHash = (fn: () => string): string => {
    try { return fn(); } catch { return ''; }
  };
  const contactsHashNow = safeHash(() => hashOrbisContacts(booker, contacts));
  const passengersHashNow = safeHash(() => hashOrbisPassengers(passengers));
  const skipContactsUpdate = !!preparedContactsHash && preparedContactsHash === contactsHashNow;
  const skipPassengersUpdate = !!preparedPassengersHash && preparedPassengersHash === passengersHashNow;

  // Diisi true bila sesi diganti di tengah flow (refresh signature). Pada sesi
  // baru SEMUA langkah dijalankan ulang — termasuk yang tadinya boleh
  // dilewati — karena sesi baru belum menyimpan apa pun.
  let useFreshSession = false;

  // ── STEP 1–5: Alur booking di sesi maskapai ───────────────────────────────
  // Dibungkus fungsi agar bisa diulang SEKALI memakai sesi baru ketika sesi
  // global masih memegang order lama (booking jadwal yang sama = duplicate).
  // UPDATE: Juga retry otomatis jika signature expired (4003) di tengah flow
  // sehingga step berikutnya gagal 4011 (session state hilang).
  const runOrbisBookingFlow = async (opts: { forceLock: boolean }) => {
    const executeFlow = async (forceLock: boolean) => {
      // STEP 1: sell_journeys (selalu re-lock saat sesi baru)
      if (forceLock || !is_locked_before) {
        try {
          await flightAPI.sellJourneys({
            adult: Number(adult) || 1,
            child: Number(child) || 0,
            infant: Number(infant) || 0,
            schedules: schedules as OrbisSchedule[],
            promo_codes: [],
          });
          console.log('[Flight Book] sell_journeys OK');
        } catch (e: any) {
          const code = e?.orbisCode;
          const msg = e.message || '';
          if (code === 4014 || msg.includes('dikunci sebelumnya') || msg.includes('called this function before')) {
            console.log('[Flight Book] sell_journeys 4014 — already locked, continue.');
          } else if (code === 4011 || msg.includes('Missing Requirements') || msg.includes('kedaluwarsa')) {
            throw Object.assign(new Error('SESSION_EXPIRED'), { orbisError: 'SESSION_EXPIRED', orbisCode: code });
          } else if (msg.includes('Schedule is not available') || msg.includes('fare class')) {
            throw Object.assign(new Error('FARE_UNAVAILABLE'), { orbisError: 'FARE_UNAVAILABLE', orbisCode: code, status: 422 });
          } else {
            throw Object.assign(new Error(`Gagal mengunci tiket: ${msg}`), { status: 422 });
          }
        }
      }

      // STEP 2: update_contacts (§3.12) — payload dibentuk helper bersama yang
      // juga dipakai /api/flight/lock, sehingga data di sesi prepare dan data
      // final di sini selalu identik.
      if (skipContactsUpdate && !useFreshSession) {
        console.log('[Flight Book] update_contacts dilewati — data kontak identik dengan sesi peta kursi.');
      } else {
        try {
          const { booker: bookerContact, contacts: contactList } = buildOrbisContacts(booker, contacts);
          await flightAPI.updateContacts({ booker: bookerContact, contacts: contactList });
          console.log('[Flight Book] update_contacts OK');
        } catch (e: any) {
          const code = e?.orbisCode;
          const msg = e.message || '';
          if (code === 4014 || msg.includes('called this function before')) {
            // Sesi sudah berisi kontak yang bukan data kita (flow lain memakai
            // sesi global ini) → buat sesi baru lalu ulangi agar data final yang
            // dibukukan. Pada percobaan ulang flag ini sudah true dan 4014
            // ditoleransi seperti biasa.
            if (!useFreshSession) throw Object.assign(new Error('SESSION_STALE'), { orbisError: 'SESSION_STALE', orbisCode: code });
            console.log('[Flight Book] update_contacts 4014 — already updated, continue.');
          } else if (code === 4011 || msg.includes('kedaluwarsa')) {
            throw Object.assign(new Error('SESSION_EXPIRED'), { orbisError: 'SESSION_EXPIRED', orbisCode: code });
          } else {
            throw Object.assign(new Error(`Gagal menyimpan kontak: ${msg}`), { status: 422 });
          }
        }
      }

      // STEP 3: update_passengers (§3.13) — payload dibentuk helper bersama
      // dengan /api/flight/lock (lihat lib/orbis-flight-payload.ts).
      if (skipPassengersUpdate && !useFreshSession) {
        console.log('[Flight Book] update_passengers dilewati — data penumpang identik dengan sesi peta kursi.');
      } else {
        try {
          const formattedPassengers: OrbisPassenger[] = buildOrbisPassengers(passengers);

          await flightAPI.updatePassengers({ passengers: formattedPassengers });
          console.log('[Flight Book] update_passengers OK');
        } catch (e: any) {
          if (e.clientError) throw Object.assign(new Error(e.message), { status: 422 });
          const code = e?.orbisCode;
          const msg = e.message || '';
          if (code === 4014 || msg.includes('called this function before')) {
            if (!useFreshSession) throw Object.assign(new Error('SESSION_STALE'), { orbisError: 'SESSION_STALE', orbisCode: code });
            console.log('[Flight Book] update_passengers 4014 — already updated, continue.');
          } else if (code === 4011 || msg.includes('kedaluwarsa')) {
            throw Object.assign(new Error('SESSION_EXPIRED'), { orbisError: 'SESSION_EXPIRED', orbisCode: code });
          } else if (code === 4013 || msg.includes('passport required') || msg.includes('Identity passport')) {
            throw Object.assign(new Error('PASSPORT_REQUIRED'), { orbisError: 'PASSPORT_REQUIRED', orbisCode: code, status: 422 });
          } else {
            throw Object.assign(new Error(`Gagal menyimpan penumpang: ${msg}`), { status: 422 });
          }
        }
      }

      // STEP 4: sell SSR bagasi (Opsional, non-fatal) — §3.15 — must be BEFORE assign_seats per doc flow
      if (body.selectedBaggage && body.selectedBaggage.ssr_code && body.selectedBaggage.ssr_code !== 'NOBAG') {
        try {
          const journeyCode = body.selectedBaggage.journey_code || '';
          const ssrCode = body.selectedBaggage.ssr_code;
          const adultCount = Number(adult) || 1;
          const provider = (schedules as any[])?.[0]?.provider || 'citilink';

          await flightAPI.sellSsrs({
            sell_ssrs_request: [{
              provider,
              sell_ssrs: [{
                journey_code: journeyCode,
                availability_type: 'baggage',
                passengers: Array.from({ length: adultCount }, (_, i) => ({
                  passenger_number: i,
                  ssr_code: ssrCode,
                })),
              }],
            }],
          });
          console.log('[Flight Book] sell_ssrs bagasi OK:', ssrCode);
        } catch (e: any) {
          const code = e?.orbisCode;
          console.warn(`[Flight Book] sell_ssrs bagasi failed (non-fatal) [${code}]:`, e.message);
        }
      }

      // STEP 4b: sell SSR makanan (Opsional, non-fatal) — §3.15
      if (body.selectedMeal && body.selectedMeal.ssr_code) {
        try {
          const journeyCode = body.selectedMeal.journey_code || '';
          const ssrCode = body.selectedMeal.ssr_code;
          const paxCount = (Number(adult) || 1) + (Number(child) || 0);
          const provider = (schedules as any[])?.[0]?.provider || 'citilink';

          await flightAPI.sellSsrs({
            sell_ssrs_request: [{
              provider,
              sell_ssrs: [{
                journey_code: journeyCode,
                availability_type: 'meal',
                passengers: Array.from({ length: paxCount }, (_, i) => ({
                  passenger_number: i,
                  ssr_code: ssrCode,
                })),
              }],
            }],
          });
          console.log('[Flight Book] sell_ssrs makanan OK:', ssrCode);
        } catch (e: any) {
          const code = e?.orbisCode;
          console.warn(`[Flight Book] sell_ssrs makanan failed (non-fatal) [${code}]:`, e.message);
        }
      }

      // STEP 5a: get_seat_availability (§2.4.1 step 11) — prasyarat assign_seats
      // (step 12). Pada sesi yang sudah lewat prepare, langkah ini sudah
      // dijalankan /api/flight/seats sehingga tidak perlu diulang. Sesi BARU
      // (hasil refresh karena data berubah) belum punya state kursi → ambil
      // ulang dulu. Non-fatal: bila gagal, assign_seats tetap dicoba.
      if (useFreshSession && selectedSeats && selectedSeats.length > 0) {
        try {
          await flightAPI.getSeatAvailability();
          console.log('[Flight Book] get_seat_availability (sesi baru) OK');
        } catch (e: any) {
          console.warn('[Flight Book] get_seat_availability (sesi baru) dilewati:', e?.orbisCode, e.message);
        }
      }

      // STEP 5: assign_seats (Opsional, non-fatal) — §3.17 — must be AFTER sell_ssrs per doc flow
      if (selectedSeats && selectedSeats.length > 0) {
        try {
          const provider = schedules?.[0]?.provider || 'citilink';
          const formattedSeatRequest = selectedSeats.map((seatReq: any) => ({
            segment_code: String(seatReq.segment_code),
            provider,
            passengers: seatReq.passengers.map((paxSeat: any) => ({
              passenger_number: Number(paxSeat.passenger_number),
              seat_code: String(paxSeat.seat_code)
            }))
          }));

          await flightAPI.assignSeats({
            segment_seat_request: formattedSeatRequest
          });
          console.log('[Flight Book] assign_seats OK');
        } catch (e: any) {
          console.warn('[Flight Book] assign_seats failed (continuing without seats):', e.message);
        }
      }

      // STEP 5: commit_booking
      let bookingData: any = null;
      try {
        bookingData = await flightAPI.commitBooking({ force_issued: false });
        console.log('[Flight Book] commit_booking | order_number:', bookingData?.order_number);
      } catch (e: any) {
        throw Object.assign(new Error(`Konfirmasi pemesanan gagal: ${e.message}`), { status: 422 });
      }

      const orderNumber = bookingData?.order_number;
      const pnr = bookingData?.pnr;
      const bookingState = bookingData?.state;

      if (!orderNumber) throw Object.assign(new Error('Nomor pesanan tidak diterima dari maskapai.'), { status: 500 });

      return { bookingData, orderNumber, pnr, bookingState };
    };

    // ── Auto-retry: sesi expired (4011) di tengah flow, ATAU sesi sudah
    //    terlanjur berisi data flow lain (4014 pada update_contacts /
    //    update_passengers) → refresh signature dan ulangi seluruh flow sekali
    //    dengan data final.
    try {
      return await executeFlow(opts.forceLock);
    } catch (e: any) {
      const staleSession = e.orbisError === 'SESSION_STALE';
      if (staleSession || e.orbisError === 'SESSION_EXPIRED') {
        console.warn(staleSession
          ? '[Flight Book] Sesi sudah berisi data flow lain → refresh signature & ulangi flow dengan data final...'
          : '[Flight Book] Session expired during flow, refreshing signature and retrying once...');
        const refreshed = await getOrbisSignature(true).then(() => true).catch((err: any) => {
          console.warn('[Flight Book] Refresh signature gagal:', err?.message);
          return false;
        });
        if (staleSession && !refreshed) {
          throw Object.assign(
            new Error('Sesi pemesanan sedang dipakai pihak lain. Silakan muat ulang halaman lalu coba lagi.'),
            { status: 503 }
          );
        }
        useFreshSession = refreshed;
        return await executeFlow(true);
      }
      throw e;
    }
  };

  const isLegitRetry = (existing: any) =>
    !!existing && isSameOwner(existing.userId, userId) && existing.status === 'pending_payment';

  // ── Percobaan pertama (pakai sesi maskapai yang sudah ada) ─────────────────
  let flow: { bookingData: any; orderNumber: string; pnr?: string; bookingState?: string };
  const attempt = async (opts: { forceLock: boolean }) => {
    flow = await runOrbisBookingFlow(opts);
    return flow;
  };
  const attemptOrRespond = async (opts: { forceLock: boolean }) => {
    try {
      return await attempt(opts);
    } catch (e: any) {
      if (e.orbisError === 'SESSION_EXPIRED') {
        return NextResponse.json({ success: false, error: 'SESSION_EXPIRED', message: e.message }, { status: 410 });
      }
      return errorResponse(e.message, e.status || 422);
    }
  };

  const first = await attemptOrRespond({ forceLock: useFreshSession });
  if (first instanceof NextResponse) return first;

  let { orderNumber, pnr, bookingState, bookingData } = flow!;

  // ── STEP 5.5: Idempotency + pemulihan sesi stale ───────────────────────────
  // Orbis commit_booking mengembalikan order_number yang SAMA saat sesi global
  // masih memegang order lama. Bedakan:
  //  • retry sah (owner sama & status pending_payment) → kembalikan booking lama;
  //  • selain itu (beda akun / sudah lunas) → refresh sesi & ulangi sekali supaya
  //    dapat order_number BARU untuk booking yang benar-benar baru.
  const respondExisting = (existing: any) =>
    NextResponse.json({
      success: true,
      orderId: existing.id,
      orderNumber,
      pnr: existing.pnr || pnr,
      snapToken: existing.snapToken || '',
      redirectUrl: existing.snapRedirectUrl || '',
      bookingState,
      duplicate: true,
    });

  const existingBooking = await bookingStore.findByOrderNumber(orderNumber);
  if (existingBooking) {
    if (isLegitRetry(existingBooking)) {
      console.log(`[Flight Book] Duplicate orderNumber (${orderNumber}) → return existing ${existingBooking.id}`);
      return respondExisting(existingBooking);
    }

    console.warn(`[Flight Book] orderNumber ${orderNumber} sudah ada (status=${existingBooking.status}, owner=${existingBooking.userId}) → refresh sesi & ulangi`);
    await getOrbisSignature(true).catch(() => {});
    const second = await attemptOrRespond({ forceLock: true });
    if (second instanceof NextResponse) return second;

    orderNumber = flow!.orderNumber;
    pnr = flow!.pnr;
    bookingState = flow!.bookingState;
    bookingData = flow!.bookingData;

    const retriedExisting = await bookingStore.findByOrderNumber(orderNumber);
    if (retriedExisting) {
      if (isLegitRetry(retriedExisting)) {
        console.log(`[Flight Book] Duplicate setelah refresh sesi → return existing ${retriedExisting.id}`);
        return respondExisting(retriedExisting);
      }
      return errorResponse(
        'Sesi maskapai sedang dipakai transaksi lain. Silakan coba lagi beberapa saat.',
        409,
        { duplicateOtherOwner: true }
      );
    }
  }

  // ── STEP 6: Midtrans Snap Transaction ────────────────────────────────────
  // FIX (Bug #2): ID acak (tidak lagi predictable dari Date.now() saja).
  const orderId = generateBookingId('FLT');
  // Dicatat SEBELUM bookingStore.create: bila proses crash di antara dua langkah
  // ini, klaim idempotency berikutnya bisa menemukan Booking yang sudah tersimpan
  // dan mengembalikannya sebagai duplicate, alih-alih membuat order kedua.
  await recordIdempotencyOrderId(idempotencyKey, orderId);
  let snap = { token: '', redirect_url: '' };
  try {
    snap = await createSnapTransaction({
      orderId,
      amount: finalAmount,
      customerName: `${booker.first_name} ${booker.last_name || ''}`.trim(),
      customerEmail: booker.email,
      customerPhone: `${booker.calling_code || '62'}${booker.mobile || ''}`,
      itemDetails: [{
        id: orderId,
        price: Math.round(finalAmount),
        quantity: 1,
        name: `Tiket Pesawat: ${route_label || `${origin || ''} → ${destination || ''}`}`,
      }],
    });
    console.log('[Flight Book] Midtrans snap token OK');
  } catch (e: any) {
    console.error('[Flight Book] Midtrans failed:', e.message);
  }

  // ── STEP 6b: Merge seat data into passengerData ──────────────────────────
  // passenger_number 0-based (§3.17.3.1 assign_seats memakai 0, 1, 2, ...),
  // sama dengan payload selectedSeats yang dikirim dari checkout.
  const enrichedPassengers = passengers.map((p: any, i: number) => {
    const seatEntry = (selectedSeats || []).flatMap((seg: any) => seg.passengers || []).find((sp: any) => sp.passenger_number === i);
    return seatEntry ? { ...p, seat: seatEntry.seat_code } : p;
  });

  // ── STEP 6c: Save selectedBaggage info into bookingData ──────────────────
  const baggagePayload = body.selectedBaggage || null;

  // ── STEP 7: Simpan ke database ────────────────────────────────────────────
  try {
    await bookingStore.create({
      id: orderId,
      userId: userId ?? undefined,
      orderNumber,
      bookingType: 'flight',
      status: 'pending_payment',
      totalAmount: finalAmount,
      currency: 'IDR',
      routeLabel: route_label || `${origin || ''} → ${destination || ''}`,
      origin,
      destination,
      departureDate: departure_date,
      flightNumber: flight_number,
      airlineName: resolveAirlineName(airline_name || ''),
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
      pnr,
      provider: schedules?.[0]?.provider || '',
      passengerData: enrichedPassengers,
      bookingData: {
        ...bookingData,
        booker,
        contacts: contacts || [booker],
        arrival_date_from_search: arrival_date || null,
        selectedBaggage: baggagePayload || undefined,
      },
      ...(validCouponCode && {
        couponCode: validCouponCode,
        discountAmount: validDiscountAmount,
      }),
    });
    console.log('[Flight Book] Saved to DB | orderId:', orderId);
  } catch (e: any) {
    // Race condition (dua request paralel): kembalikan booking yang sudah tersimpan.
    if (e?.code === 'P2002') {
      const existing = await bookingStore.findByOrderNumber(orderNumber);
      if (existing) {
        if (!isLegitRetry(existing)) {
          console.warn(`[Flight Book] Race duplicate tidak valid (status=${existing.status}) → ditolak`);
          await getOrbisSignature(true).catch(() => {});
          return errorResponse(
            'Sesi maskapai sedang dipakai transaksi lain. Silakan coba lagi beberapa saat.',
            409,
            { duplicateOtherOwner: true }
          );
        }
        console.log('[Flight Book] Race duplicate → return existing', existing.id);
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          orderNumber,
          pnr: existing.pnr || pnr,
          snapToken: existing.snapToken || snap.token,
          redirectUrl: existing.snapRedirectUrl || snap.redirect_url,
          bookingState,
          duplicate: true,
        });
      }
    }
    console.error('[Flight Book] DB error (fatal):', e.message);
    return errorResponse('Gagal menyimpan pesanan. Silakan coba lagi.', 500);
  }

  // ── STEP 8: Log Payment record ────────────────────────────────────────────
  if (snap.token) {
    try {
      await bookingStore.logPayment({
        bookingId: orderId,
        orderId,
        amount: markedUpAmount,
        snapToken: snap.token,
        snapRedirectUrl: snap.redirect_url,
        status: 'pending',
      });
    } catch (e: any) {
      console.error('[Flight Book] Payment log error (non-fatal):', e.message);
    }
  }

  return NextResponse.json({
    success: true,
    orderId,
    orderNumber,
    pnr,
    snapToken: snap.token,
    redirectUrl: snap.redirect_url,
    bookingState,
  });
}