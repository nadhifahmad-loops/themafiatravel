import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI } from '@/lib/orbis';
import { bookingStore } from '@/lib/store';
import { canManageBooking } from '@/lib/booking-access';
import { getAirlineProviderBookings, getFlightCabinClass, hasFlightDeparted } from '@/lib/orbis-post-booking';

/**
 * Get Reschedule Availability — Orbis Airline API v2.2 §3.25
 *
 * Mendapatkan jadwal penerbangan yang tersedia untuk reschedule.
 * Request: { order_number, cabin_class, reschedule_list: [{pnr, journeys: [{origin, destination, departure_date}]}] }
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

  const { order_id, reschedule_list } = body;

  if (typeof order_id !== 'string' || !order_id.trim()) {
    return NextResponse.json({ success: false, error: 'order_id wajib diisi.' }, { status: 400 });
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
    return NextResponse.json(
      { success: false, error: 'Reschedule hanya tersedia untuk booking yang sudah issued/dibayar.' },
      { status: 400 }
    );
  }

  if (hasFlightDeparted(booking)) {
    return NextResponse.json(
      { success: false, error: 'Jadwal yang sudah berangkat atau tanggalnya lewat tidak dapat di-reschedule.' },
      { status: 409 }
    );
  }

  const providerBookings = getAirlineProviderBookings(booking);
  if (!providerBookings.length) {
    return NextResponse.json({ success: false, error: 'Data itinerary reschedule tidak lengkap.' }, { status: 400 });
  }

  const requestedList = Array.isArray(reschedule_list) ? reschedule_list : null;
  if (reschedule_list !== undefined && !requestedList) {
    return NextResponse.json({ success: false, error: 'reschedule_list harus berupa array.' }, { status: 400 });
  }
  if (requestedList && requestedList.length !== providerBookings.length) {
    return NextResponse.json({ success: false, error: 'Semua PNR booking harus disertakan untuk reschedule.' }, { status: 400 });
  }

  const resolvedRescheduleList = providerBookings.map((providerBooking, index) => {
    const requestedProvider = requestedList?.[index];
    if (requestedProvider && (!requestedProvider || typeof requestedProvider !== 'object' || Array.isArray(requestedProvider))) {
      return null;
    }
    const requestedRecord = requestedProvider as Record<string, unknown> | undefined;
    if (requestedRecord?.pnr !== undefined && requestedRecord.pnr !== providerBooking.pnr) return null;
    const requestedJourneys = requestedRecord?.journeys;
    if (requestedJourneys !== undefined && (!Array.isArray(requestedJourneys) || requestedJourneys.length !== providerBooking.journeys.length)) {
      return null;
    }

    const journeys = providerBooking.journeys.map((journey, journeyIndex) => {
      const requestedJourney = Array.isArray(requestedJourneys)
        ? requestedJourneys[journeyIndex]
        : undefined;
      if (requestedJourney !== undefined && (!requestedJourney || typeof requestedJourney !== 'object' || Array.isArray(requestedJourney))) {
        return null;
      }
      const requestedJourneyRecord = requestedJourney as Record<string, unknown> | undefined;
      if (
        (requestedJourneyRecord?.origin !== undefined && requestedJourneyRecord.origin !== journey.origin)
        || (requestedJourneyRecord?.destination !== undefined && requestedJourneyRecord.destination !== journey.destination)
      ) {
        return null;
      }
      const departureDate = requestedJourneyRecord?.departure_date;
      const date = typeof departureDate === 'string' ? departureDate.trim() : journey.departure_date.slice(0, 10);
      const parsedDate = new Date(`${date}T00:00:00Z`);
      const today = new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date < today) return null;
      return { origin: journey.origin, destination: journey.destination, departure_date: date };
    });

    if (journeys.some((journey) => !journey)) return null;
    return { pnr: providerBooking.pnr, journeys };
  });

  if (resolvedRescheduleList.some((item) => !item)) {
    return NextResponse.json({ success: false, error: 'Jadwal reschedule tidak sesuai dengan itinerary booking.' }, { status: 400 });
  }
  const validRescheduleList = resolvedRescheduleList.flatMap((item) => {
    if (!item) return [];
    const journeys = item.journeys.filter((journey): journey is NonNullable<typeof journey> => Boolean(journey));
    return [{ pnr: item.pnr, journeys }];
  });

  try {
    const data = await flightAPI.getRescheduleAvailability({
      order_number: booking.orderNumber,
      cabin_class: getFlightCabinClass(booking),
      reschedule_list: validRescheduleList,
    });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const code = error && typeof error === 'object' ? (error as { orbisCode?: number }).orbisCode : undefined;
    const msg = error instanceof Error ? error.message : '';

    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    console.error('[Reschedule Availability Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil jadwal reschedule' },
      { status: 500 }
    );
  }
}
