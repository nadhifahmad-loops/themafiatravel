import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI, getOrbisSignature, OrbisSchedule, OrbisPassenger, OrbisPassengerIdentity } from '@/lib/orbis';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';
import { flightBookSchema, validateBody } from '@/lib/validate';
import { getMarkup, applyFlatMarkup } from '@/lib/markup';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { generateBookingId } from '@/lib/security';
import { checkSubmittedPrice } from '@/lib/price-check';

export const maxDuration = 90;

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
  const session = await getServerSession(authOptions);
  const userId: string | null = session?.user.id ?? null;
  const ip = getClientIp(req as unknown as Request);
  const rateLimit = await checkRateLimit(`booking:flight:${ip}`, 'booking');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan booking. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Request body tidak valid.', 400);
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
    cabin_class,
  } = validation.data;

  // ── STEP 0: Price Revalidation (fail-closed) ──────────────────────────────
  // Harga dari client tidak boleh dipercaya mentah-mentah; bila harga riil tidak
  // bisa diverifikasi (error/timeout Orbis), booking DITOLAK alih-alih lanjut.
  try {
    const priceData = await flightAPI.getPriceItinerary({
      adult: Number(adult) || 1,
      child: Number(child) || 0,
      infant: Number(infant) || 0,
      provider: schedules[0]?.provider || 'citilink',
      schedules: schedules as OrbisSchedule[],
      is_combo_price: !!is_combo_price,
      promo_codes: [],
    });

    const priceCheck = checkSubmittedPrice({
      submitted: total_amount,
      refreshed: priceData?.total_amount,
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

  // ── STEP 1–5: Alur booking di sesi maskapai ───────────────────────────────
  // Dibungkus fungsi agar bisa diulang SEKALI memakai sesi baru ketika sesi
  // global masih memegang order lama (booking jadwal yang sama = duplicate).
  const runOrbisBookingFlow = async (opts: { forceLock: boolean }) => {
    // STEP 1: sell_journeys (selalu re-lock saat sesi baru)
    if (opts.forceLock || !is_locked_before) {
      try {
        await flightAPI.sellJourneys({
          adult: Number(adult) || 1,
          child: Number(child) || 0,
          infant: Number(infant) || 0,
          cabin_class: cabin_class || 'Y',
          schedules: schedules as OrbisSchedule[],
          is_combo_price: !!is_combo_price,
          promo_codes: [],
        });
        console.log('[Flight Book] sell_journeys OK');
      } catch (e: any) {
        const code = e?.orbisCode;
        const msg = e.message || '';
        if (code === 4014 || msg.includes('dikunci sebelumnya') || msg.includes('called this function before')) {
          console.log('[Flight Book] sell_journeys 4014 — already locked, continue.');
        } else if (code === 4011 || msg.includes('Missing Requirements') || msg.includes('kedaluwarsa')) {
          throw Object.assign(new Error('Sesi maskapai berakhir.'), { orbisError: 'SESSION_EXPIRED', status: 410 });
        } else {
          throw Object.assign(new Error(`Gagal mengunci tiket: ${msg}`), { status: 422 });
        }
      }
    }

    // STEP 2: update_contacts
    try {
      await flightAPI.updateContacts({
        booker: {
          title: booker.title || 'MR',
          first_name: booker.first_name,
          last_name: booker.last_name || '',
          email: booker.email,
          calling_code: booker.calling_code || '62',
          mobile: booker.mobile || '',
          nationality_code: booker.nationality_code || 'ID',
          is_also_booker: true,
        },
        contacts: (contacts || [booker]).map((c: any) => ({
          title: c.title || 'MR',
          first_name: c.first_name,
          last_name: c.last_name || '',
          email: c.email,
          calling_code: c.calling_code || '62',
          mobile: c.mobile || '',
          nationality_code: c.nationality_code || 'ID',
          is_also_booker: false,
        })),
      });
      console.log('[Flight Book] update_contacts OK');
    } catch (e: any) {
      const code = e?.orbisCode;
      const msg = e.message || '';
      if (code === 4014 || msg.includes('called this function before')) {
        console.log('[Flight Book] update_contacts 4014 — already updated, continue.');
      } else if (code === 4011 || msg.includes('kedaluwarsa')) {
        throw Object.assign(new Error('Sesi maskapai berakhir.'), { orbisError: 'SESSION_EXPIRED', status: 410 });
      } else {
        throw Object.assign(new Error(`Gagal menyimpan kontak: ${msg}`), { status: 422 });
      }
    }

    // STEP 3: update_passengers
    try {
      const formattedPassengers: OrbisPassenger[] = passengers.map((p: any, idx: number) => {
        const identType: string = p.identity?.identity_type || 'ktp';
        let identity: OrbisPassengerIdentity | undefined;

        if (p.identity?.identity_number) {
          if (identType === 'passport') {
            if (!p.identity.identity_expdate) {
              throw Object.assign(new Error(`Tanggal kadaluarsa paspor penumpang ke-${idx + 1} (${p.first_name}) wajib diisi.`), { clientError: true });
            }
            identity = {
              identity_type: 'passport',
              identity_number: p.identity.identity_number,
              identity_expdate: p.identity.identity_expdate,
              identity_country_of_issued_code: p.identity.identity_country_of_issued_code || 'ID',
            };
          } else {
            identity = {
              identity_type: identType as OrbisPassengerIdentity['identity_type'],
              identity_number: p.identity.identity_number,
              identity_expdate: '',
              identity_country_of_issued_code: '',
            };
          }
        }

        return {
          passenger_number: idx,
          type: p.pax_type || 'ADT',
          title: p.title || 'MR',
          first_name: p.first_name,
          last_name: p.last_name || p.first_name,
          birth_date: p.birth_date,
          nationality: p.nationality_code || 'ID',
          pax_type: p.pax_type as 'ADT' | 'CHD' | 'INF',
          nationality_code: p.nationality_code || 'ID',
          ...(identity && { identity }),
        };
      });

      await flightAPI.updatePassengers({ passengers: formattedPassengers });
      console.log('[Flight Book] update_passengers OK');
    } catch (e: any) {
      if (e.clientError) throw Object.assign(new Error(e.message), { status: 422 });
      const code = e?.orbisCode;
      const msg = e.message || '';
      if (code === 4014 || msg.includes('called this function before')) {
        console.log('[Flight Book] update_passengers 4014 — already updated, continue.');
      } else if (code === 4011 || msg.includes('kedaluwarsa')) {
        throw Object.assign(new Error('Sesi maskapai berakhir.'), { orbisError: 'SESSION_EXPIRED', status: 410 });
      } else {
        throw Object.assign(new Error(`Gagal menyimpan penumpang: ${msg}`), { status: 422 });
      }
    }

    // STEP 4: assign_seats (Opsional, non-fatal)
    if (selectedSeats && selectedSeats.length > 0) {
      try {
        const formattedSeatRequest = selectedSeats.map((seatReq: any) => ({
          segment_code: String(seatReq.segment_code),
          passengers: seatReq.passengers.map((paxSeat: any) => ({
            passenger_number: Number(paxSeat.passenger_number),
            seat_code: String(paxSeat.seat_code)
          }))
        }));

        await flightAPI.assignSeats({
          provider: schedules?.[0]?.provider || 'citilink',
          segment_seat_request: formattedSeatRequest
        });
        console.log('[Flight Book] assign_seats OK');
      } catch (e: any) {
        console.warn('[Flight Book] assign_seats failed (continuing without seats):', e.message);
      }
    }

    // STEP 4b: sell SSR bagasi (Opsional, non-fatal)
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

  const first = await attemptOrRespond({ forceLock: false });
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
  let snap = { token: '', redirect_url: '' };
  try {
    snap = await createSnapTransaction({
      orderId,
      amount: markedUpAmount,
      customerName: `${booker.first_name} ${booker.last_name || ''}`.trim(),
      customerEmail: booker.email,
      customerPhone: `${booker.calling_code || '62'}${booker.mobile || ''}`,
      itemDetails: [{
        id: orderId,
        price: Math.round(markedUpAmount),
        quantity: 1,
        name: `Tiket Pesawat: ${route_label || `${origin || ''} → ${destination || ''}`}`,
      }],
    });
    console.log('[Flight Book] Midtrans snap token OK');
  } catch (e: any) {
    console.error('[Flight Book] Midtrans failed:', e.message);
  }

  // ── STEP 6b: Merge seat data into passengerData ──────────────────────────
  const enrichedPassengers = passengers.map((p: any, i: number) => {
    const seatEntry = (selectedSeats || []).flatMap((seg: any) => seg.passengers || []).find((sp: any) => sp.passenger_number === i + 1);
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
      totalAmount: markedUpAmount,
      currency: 'IDR',
      routeLabel: route_label || `${origin || ''} → ${destination || ''}`,
      origin,
      destination,
      departureDate: departure_date,
      flightNumber: flight_number,
      airlineName: airline_name,
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