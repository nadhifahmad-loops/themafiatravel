import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';
import { getAirlineProviderBookings, getAirlineRescheduleStatus, hasFlightDeparted } from '@/lib/orbis-post-booking';
import type { OrbisStruct } from '@/lib/orbis-types';

/**
 * Sell Reschedule — Orbis Airline API v2.2 §3.26
 *
 * Menetapkan jadwal baru untuk reschedule.
 * Request: { order_number, schedules: [{pnr, journeys: [{segments: [{segment_code, fare_code}]}]}] }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid request body');
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Request body tidak valid.' }, { status: 400 });
  }

  const { order_id, schedules } = body;

  if (typeof order_id !== 'string' || !order_id.trim()) {
    return NextResponse.json({ success: false, error: 'order_id wajib diisi.' }, { status: 400 });
  }

  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    return NextResponse.json({ success: false, error: 'schedules wajib diisi.' }, { status: 400 });
  }

  const user = session.user as { id?: string; email?: string; role?: string };
  const booking = await bookingStore.findById(order_id);

  if (!booking) {
    return NextResponse.json({ success: false, error: 'Booking tidak ditemukan.' }, { status: 404 }    );
  }

  if (booking.bookingType !== 'flight') {
    return NextResponse.json({ success: false, error: 'Reschedule online hanya tersedia untuk booking pesawat.' }, { status: 400 });
  }

  if (!canManageBooking(booking, {
    sessionUserId: user.id ?? null,
    sessionEmail: user.email ?? null,
    isAdmin: user.role === 'admin',
    bookerEmail: typeof body.booker_email === 'string' ? body.booker_email : undefined,
  })) {
    return NextResponse.json({ success: false, error: 'Akses tidak diizinkan.' }, { status: 403 });
  }

  if (!['paid', 'issued'].includes(booking.status)) {
    return NextResponse.json({ success: false, error: 'Reschedule hanya tersedia untuk booking yang sudah issued/dibayar.' }, { status: 400 });
  }

  if (hasFlightDeparted(booking)) {
    return NextResponse.json(
      { success: false, error: 'Jadwal yang sudah berangkat atau tanggalnya lewat tidak dapat di-reschedule.' },
      { status: 409 }
    );
  }

  const providerBookings = getAirlineProviderBookings(booking);
  if (!providerBookings.length || !Array.isArray(schedules) || schedules.length !== providerBookings.length) {
    return NextResponse.json({ success: false, error: 'Jadwal untuk seluruh PNR booking wajib dipilih.' }, { status: 400 });
  }

  const resolvedSchedules: OrbisStruct[] = [];
  for (const [index, rawSchedule] of schedules.entries()) {
    if (!rawSchedule || typeof rawSchedule !== 'object' || Array.isArray(rawSchedule)) {
      return NextResponse.json({ success: false, error: 'Format schedules tidak valid.' }, { status: 400 });
    }
    const schedule = rawSchedule as Record<string, unknown>;
    const expectedPnr = providerBookings[index]?.pnr;
    if (
      schedule.pnr !== expectedPnr
      || !Array.isArray(schedule.journeys)
      || schedule.journeys.length !== providerBookings[index].journeys.length
    ) {
      return NextResponse.json({ success: false, error: 'PNR/journey reschedule tidak sesuai dengan booking.' }, { status: 400 });
    }

    const journeys: Array<{ segments: Array<{ segment_code: string; fare_code: string }> }> = [];
    for (const rawJourney of schedule.journeys) {
      if (!rawJourney || typeof rawJourney !== 'object' || Array.isArray(rawJourney)) {
        return NextResponse.json({ success: false, error: 'Format journey reschedule tidak valid.' }, { status: 400 });
      }
      const journey = rawJourney as Record<string, unknown>;
      if (!Array.isArray(journey.segments) || journey.segments.length === 0) {
        return NextResponse.json({ success: false, error: 'Segmen dan fare reschedule wajib dipilih.' }, { status: 400 });
      }
      const segments: Array<{ segment_code: string; fare_code: string }> = [];
      for (const rawSegment of journey.segments) {
        if (!rawSegment || typeof rawSegment !== 'object' || Array.isArray(rawSegment)) {
          return NextResponse.json({ success: false, error: 'Format segmen reschedule tidak valid.' }, { status: 400 });
        }
        const segment = rawSegment as Record<string, unknown>;
        if (
          typeof segment.segment_code !== 'string' || !segment.segment_code.trim()
          || typeof segment.fare_code !== 'string' || !segment.fare_code.trim()
        ) {
          return NextResponse.json({ success: false, error: 'segment_code dan fare_code wajib diisi.' }, { status: 400 });
        }
        segments.push({
          segment_code: segment.segment_code.trim(),
          fare_code: segment.fare_code.trim(),
        });
      }
      journeys.push({ segments });
    }
    resolvedSchedules.push({ pnr: expectedPnr, journeys });
  }

  try {
    const data: unknown = await flightAPI.sellReschedule({
      order_number: booking.orderNumber,
      schedules: resolvedSchedules,
    });

    const rescheduleStatus = getAirlineRescheduleStatus(
      data,
      providerBookings.map(({ pnr }) => pnr)
    );
    if (!rescheduleStatus.allSucceeded) {
      const message = rescheduleStatus.partialSuccess
        ? 'Maskapai hanya mengonfirmasi sebagian PNR. Jangan kirim ulang reschedule; hubungi customer service untuk rekonsiliasi booking.'
        : 'Maskapai tidak mengonfirmasi keberhasilan reschedule untuk seluruh PNR.';
      console.error('[Reschedule Sell Status Error]', JSON.stringify(rescheduleStatus.providers));
      return NextResponse.json({
        success: false,
        error: message,
        manualReviewRequired: rescheduleStatus.partialSuccess,
        providerStatuses: rescheduleStatus.providers,
      }, { status: 422 });
    }

    const warnings: string[] = [];
    try {
      await flightAPI.updateBooking({
        order_number: booking.orderNumber,
        schedules: providerBookings.map(({ pnr }) => ({ pnr })),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Tidak diketahui';
      console.error('[Reschedule Update Booking Error]', message);
      warnings.push('Reschedule sudah berhasil di vendor, tetapi update_booking gagal. Data vendor perlu diperiksa admin.');
    }

    try {
      await flightAPI.getBooking(booking.orderNumber);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Tidak diketahui';
      console.error('[Reschedule Get Booking Error]', message);
      warnings.push('Reschedule sudah berhasil di vendor, tetapi sinkronisasi get_booking gagal. Data vendor perlu diperiksa admin.');
    }

    try {
      const root = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const responseProviders = Array.isArray(root.sell_reschedule_provider) ? root.sell_reschedule_provider : [];
      const responseProvidersByPnr = new Map<string, Record<string, unknown>>();
      for (const rawProvider of responseProviders) {
        if (!rawProvider || typeof rawProvider !== 'object' || Array.isArray(rawProvider)) continue;
        const providerData = rawProvider as Record<string, unknown>;
        if (typeof providerData.pnr === 'string') responseProvidersByPnr.set(providerData.pnr, providerData);
      }
      const journeys = responseProviders.flatMap((provider) => {
        if (!provider || typeof provider !== 'object' || Array.isArray(provider)) return [];
        const providerData = provider as Record<string, unknown>;
        const pnr = typeof providerData.pnr === 'string' ? providerData.pnr : '';
        const providerName = typeof providerData.provider === 'string' ? providerData.provider : undefined;
        const providerJourneys = Array.isArray(providerData.journeys) ? providerData.journeys : [];
        return providerJourneys.flatMap((journey) => {
          if (!journey || typeof journey !== 'object' || Array.isArray(journey)) return [];
          const journeyData = journey as Record<string, unknown>;
          const segments = Array.isArray(journeyData.segments) ? journeyData.segments : [];
          const firstSegment = segments[0] && typeof segments[0] === 'object'
            ? segments[0] as Record<string, unknown>
            : {};
          const lastSegment = segments[segments.length - 1] && typeof segments[segments.length - 1] === 'object'
            ? segments[segments.length - 1] as Record<string, unknown>
            : firstSegment;
          const origin = typeof journeyData.origin === 'string'
            ? journeyData.origin
            : typeof firstSegment.origin === 'string' ? firstSegment.origin : '';
          const destination = typeof journeyData.destination === 'string'
            ? journeyData.destination
            : typeof lastSegment.destination === 'string' ? lastSegment.destination : '';
          const departureDate = typeof journeyData.departure_date === 'string'
            ? journeyData.departure_date
            : typeof firstSegment.departure_date === 'string' ? firstSegment.departure_date : '';
          const carrierCode = typeof firstSegment.carrier_code === 'string' ? firstSegment.carrier_code : '';
          const carrierNumber = typeof firstSegment.carrier_number === 'string' ? firstSegment.carrier_number : '';
          const flightNumber = `${carrierCode}${carrierNumber}` || undefined;
          if (!pnr || !origin || !destination || !departureDate || Number.isNaN(Date.parse(departureDate))) return [];
          return [{
            pnr,
            provider: providerName,
            origin,
            destination,
            departureDate,
            ...(flightNumber ? { flightNumber } : {}),
          }];
        });
      });
      const expectedJourneyCount = providerBookings.reduce((total, provider) => total + provider.journeys.length, 0);
      const hasCompleteProviderData = journeys.length === expectedJourneyCount
        && providerBookings.every((provider) => {
          const responseProvider = responseProvidersByPnr.get(provider.pnr);
          return Array.isArray(responseProvider?.journeys)
            && responseProvider.journeys.length === provider.journeys.length;
        });
      const refreshedProviderBookings = hasCompleteProviderData
        ? responseProviders.filter((provider): provider is Record<string, unknown> =>
          Boolean(provider && typeof provider === 'object' && !Array.isArray(provider))
        )
        : undefined;
      if (journeys.length && !hasCompleteProviderData) {
        warnings.push('Reschedule berhasil di vendor, tetapi data seluruh PNR tidak lengkap. Itinerary lokal belum diperbarui dan perlu diperiksa admin.');
      }

      if (!journeys.length) {
        warnings.push('Reschedule berhasil di vendor, tetapi detail jadwal baru tidak tersedia pada respons. Admin perlu memeriksa sinkronisasi booking.');
      } else {
        const firstJourney = journeys[0];
        const totalPrice = typeof root.total_price === 'number' && Number.isFinite(root.total_price)
          ? root.total_price
          : null;
        const adminFee = typeof root.total_admin_fee === 'number' && Number.isFinite(root.total_admin_fee)
          ? root.total_admin_fee
          : null;
        const updatedBooking = await bookingStore.recordFlightReschedule(booking.id, {
          pnr: firstJourney?.pnr ?? providerBookings[0].pnr,
          ...(firstJourney?.provider ? { provider: firstJourney.provider } : {}),
          originalDepartureDate: booking.departureDate?.toISOString() ?? null,
          departureDate: firstJourney?.departureDate ?? null,
          origin: firstJourney?.origin ?? null,
          destination: firstJourney?.destination ?? null,
          flightNumber: firstJourney?.flightNumber ?? null,
          amount: totalPrice,
          adminFee,
          ...(refreshedProviderBookings ? { providerBookings: refreshedProviderBookings } : {}),
          journeys,
        });
        if (!updatedBooking) {
          warnings.push('Reschedule berhasil di vendor, tetapi perubahan tidak dapat disimpan ke database lokal.');
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Tidak diketahui';
      console.error('[Reschedule Local Sync Error]', message);
      warnings.push('Reschedule berhasil di vendor, tetapi perubahan tidak dapat disimpan ke database lokal.');
    }

    return NextResponse.json({ success: true, data, warnings });
  } catch (error: unknown) {
    const errorData = error && typeof error === 'object'
      ? error as { orbisCode?: unknown }
      : {};
    const code = errorData.orbisCode;
    const msg = error instanceof Error ? error.message : '';

    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    if (code === 4019 || code === 4009 || code === 4010) {
      return NextResponse.json(
        { success: false, error: msg || 'Gagal melakukan reschedule' },
        { status: 422 }
      );
    }

    console.error('[Reschedule Sell Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal menjual jadwal reschedule' },
      { status: 500 }
    );
  }
}
