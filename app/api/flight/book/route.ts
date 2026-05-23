import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI, OrbisSchedule, OrbisPassenger, OrbisPassengerIdentity } from '@/lib/orbis';
import { createSnapTransaction } from '@/lib/midtrans';
import { bookingStore } from '@/lib/store';

function errorResponse(message: string, status = 422, extra?: object) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId: string | null = session ? (session.user as any).id : null;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Request body tidak valid.', 400);
  }

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
    flight_number,
    airline_name,
    selectedSeats,
    is_locked_before,
  } = body;

  if (!schedules?.length)   return errorResponse('Data jadwal tidak ditemukan.', 400);
  if (!passengers?.length)  return errorResponse('Data penumpang tidak lengkap.', 400);
  if (!booker?.first_name || !booker?.email) return errorResponse('Data pemesan tidak lengkap.', 400);

  // ── STEP 1: sell_journeys ─────────────────────────────────────────────────
  if (!is_locked_before) {
    try {
      await flightAPI.sellJourneys({
        adult: Number(adult) || 1,
        child: Number(child) || 0,
        infant: Number(infant) || 0,
        schedules: schedules as OrbisSchedule[],
        is_combo_price: !!is_combo_price,
        promo_codes: [],
      });
      console.log('[Flight Book] ✅ sell_journeys OK');
    } catch (e: any) {
      const code = (e as any).orbisCode;
      const msg  = e.message || '';
      if (code === 4014 || msg.includes('dikunci sebelumnya') || msg.includes('called this function before')) {
        console.log('[Flight Book] sell_journeys 4014 — already locked, continue.');
      } else if (code === 4011 || msg.includes('Missing Requirements') || msg.includes('kedaluwarsa')) {
        return NextResponse.json({ success: false, error: 'SESSION_EXPIRED', message: 'Sesi maskapai berakhir.' }, { status: 410 });
      } else {
        return errorResponse(`Gagal mengunci tiket: ${msg}`);
      }
    }
  }

  // ── STEP 2: update_contacts ───────────────────────────────────────────────
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
    console.log('[Flight Book] ✅ update_contacts OK');
  } catch (e: any) {
    const code = (e as any).orbisCode;
    const msg = e.message || '';
    // 🔥 AUTO-FIX 4014: Jika sudah pernah dikirim di sesi yang sama, abaikan error!
    if (code === 4014 || msg.includes('called this function before')) {
      console.log('[Flight Book] update_contacts 4014 — already updated, continue.');
    } else if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json({ success: false, error: 'SESSION_EXPIRED', message: 'Sesi maskapai berakhir.' }, { status: 410 });
    } else {
      return errorResponse(`Gagal menyimpan kontak: ${msg}`);
    }
  }

  // ── STEP 3: update_passengers ─────────────────────────────────────────────
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
        title: p.title || 'MR',
        first_name: p.first_name,
        last_name: p.last_name || p.first_name,
        birth_date: p.birth_date,
        pax_type: p.pax_type as 'ADT' | 'CHD' | 'INF',
        nationality_code: p.nationality_code || 'ID',
        ...(identity && { identity }),
      };
    });

    await flightAPI.updatePassengers({ passengers: formattedPassengers });
    console.log('[Flight Book] ✅ update_passengers OK');
  } catch (e: any) {
    if (e.clientError) return errorResponse(e.message, 422);
    const code = (e as any).orbisCode;
    const msg = e.message || '';
    // 🔥 AUTO-FIX 4014: Jika sudah pernah dikirim di sesi yang sama, abaikan error!
    if (code === 4014 || msg.includes('called this function before')) {
      console.log('[Flight Book] update_passengers 4014 — already updated, continue.');
    } else if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json({ success: false, error: 'SESSION_EXPIRED', message: 'Sesi maskapai berakhir.' }, { status: 410 });
    } else {
      return errorResponse(`Gagal menyimpan penumpang: ${msg}`);
    }
  }

  // ── STEP 4: assign_seats (Opsional) ──────────────────────────────────────
  if (selectedSeats && selectedSeats.length > 0) {
    try {
      const formattedSeatRequest = selectedSeats.map((seatReq: any) => ({
        segment_code: String(seatReq.segment_code),
        passengers: seatReq.passengers.map((paxSeat: any) => ({
          passenger_number: Number(paxSeat.passenger_number),
          seat_code: String(paxSeat.seat_code)
        }))
      }));

      const seatPayload = {
        provider: schedules?.[0]?.provider || 'citilink',
        segment_seat_request: formattedSeatRequest
      };

      await flightAPI.assignSeats(seatPayload);
      console.log('[Flight Book] ✅ assign_seats OK');
    } catch (e: any) {
      console.warn('[Flight Book] ⚠️ assign_seats gagal (dilanjutkan tanpa kursi):', e.message);
    }
  }

  // ── STEP 4b: sell SSR bagasi (Opsional, SEBELUM commit_booking) ────────────
  if (body.selectedBaggage && body.selectedBaggage.ssr_code && body.selectedBaggage.ssr_code !== 'NOBAG') {
    try {
      const journeyCode = body.selectedBaggage.journey_code || '';
      const ssrCode     = body.selectedBaggage.ssr_code;
      const adultCount  = Number(adult) || 1;
      const provider    = (schedules as any[])?.[0]?.provider || 'citilink';

      await flightAPI.sellSsrs({
        sell_ssrs_request: [{
          provider,
          sell_ssrs: [{
            journey_code:      journeyCode,
            availability_type: 'baggage',
            passengers: Array.from({ length: adultCount }, (_, i) => ({
              passenger_number: i,
              ssr_code:         ssrCode,
            })),
          }],
        }],
      });
      console.log('[Flight Book] ✅ sell_ssrs bagasi OK:', ssrCode);
    } catch (e: any) {
      const code = (e as any).orbisCode;
      console.warn(`[Flight Book] ⚠️ sell_ssrs bagasi gagal (non-fatal) [${code}]:`, e.message);
    }
  }

  // ── STEP 5: commit_booking ────────────────────────────────────────────────
  let bookingData: any = null;
  try {
    bookingData = await flightAPI.commitBooking({ force_issued: false });
    console.log('[Flight Book] ✅ commit_booking | order_number:', bookingData?.order_number);
  } catch (e: any) {
    return errorResponse(`Konfirmasi pemesanan gagal: ${e.message}`);
  }

  const orderNumber = bookingData?.order_number;
  const pnr         = bookingData?.pnr;
  const bookingState = bookingData?.state;

  if (!orderNumber) return errorResponse('Nomor pesanan tidak diterima dari maskapai.', 500);

  // ── STEP 6: Midtrans Snap Transaction ────────────────────────────────────
  const orderId = `TMT-FLT-${Date.now()}`;
  let snap = { token: '', redirect_url: '' };
  try {
    snap = await createSnapTransaction({
      orderId,
      amount: total_amount,
      customerName: `${booker.first_name} ${booker.last_name || ''}`.trim(),
      customerEmail: booker.email,
      customerPhone: `${booker.calling_code || '62'}${booker.mobile || ''}`,
      itemDetails: [{
        id: orderId,
        price: Math.round(total_amount),
        quantity: 1,
        name: `Tiket Pesawat: ${route_label || `${origin} → ${destination}`}`,
      }],
    });
    console.log('[Flight Book] ✅ Midtrans snap token OK');
  } catch (e: any) {
    console.error('[Flight Book] Midtrans gagal (PNR sudah ada):', e.message);
  }

  // ── STEP 7: Simpan ke database ────────────────────────────────────────────
  try {
    await bookingStore.create({
      id: orderId,
      userId: userId as any,
      orderNumber,
      bookingType: 'flight',
      status: 'pending_payment',
      totalAmount: total_amount,
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
      passengerData: passengers,
      bookingData,
    });
    console.log('[Flight Book] ✅ Saved to DB | orderId:', orderId);
  } catch (e: any) {
    console.error('[Flight Book] DB error (non-fatal):', e.message);
  }

  // ── STEP 8: Log Payment record ────────────────────────────────────────────
  if (snap.token) {
    try {
      await bookingStore.logPayment({
        bookingId: orderId,
        orderId,
        amount: total_amount,
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