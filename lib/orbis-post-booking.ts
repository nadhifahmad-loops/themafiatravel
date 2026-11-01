export type FlightBookingSnapshot = {
  orderNumber?: string | null;
  pnr?: string | null;
  provider?: string | null;
  origin?: string | null;
  destination?: string | null;
  departureDate?: string | Date | null;
  bookingData?: unknown;
  passengerData?: unknown;
};

export type AirlineJourney = {
  origin: string;
  destination: string;
  departure_date: string;
};

export type AirlineProviderBooking = {
  pnr: string;
  provider?: string;
  journeys: Array<AirlineJourney & { pax: number[] }>;
};

export function getFlightCabinClass(booking: FlightBookingSnapshot): string {
  const bookingData = record(booking.bookingData);
  const storedClass = text(bookingData?.cabin_class);
  if (storedClass) return storedClass;

  const providerBookings = Array.isArray(bookingData?.provider_bookings) ? bookingData.provider_bookings : [];
  for (const rawProviderBooking of providerBookings) {
    const providerBooking = record(rawProviderBooking);
    const journeys = Array.isArray(providerBooking?.journeys) ? providerBooking.journeys : [];
    for (const rawJourney of journeys) {
      const journey = record(rawJourney);
      const segments = Array.isArray(journey?.segments) ? journey.segments : [];
      for (const rawSegment of segments) {
        const cabinClass = text(record(rawSegment)?.cabin_class);
        if (cabinClass) return cabinClass;
      }
    }
  }
  return 'Y';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dateText(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return text(value);
}

function passengerNumbers(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const numbers = value.map((passenger, index) => {
    if (typeof passenger === 'number' && Number.isInteger(passenger)) return passenger;
    const item = record(passenger);
    const number = item?.passenger_number ?? item?.number ?? item?.sequence;
    return typeof number === 'number' && Number.isInteger(number) ? number : index;
  });
  return numbers.length ? numbers : fallback;
}

function journeyFrom(value: unknown, fallback: FlightBookingSnapshot): AirlineJourney | null {
  const journey = record(value);
  if (!journey) return null;
  const segments = Array.isArray(journey.segments)
    ? journey.segments.map(record).filter((segment): segment is Record<string, unknown> => Boolean(segment))
    : [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const origin = text(journey.origin) ?? text(firstSegment?.origin) ?? text(fallback.origin);
  const destination = text(journey.destination) ?? text(lastSegment?.destination) ?? text(fallback.destination);
  const departureDate = dateText(journey.departure_date)
    ?? dateText(firstSegment?.departure_date)
    ?? dateText(fallback.departureDate);

  if (!origin || !destination || !departureDate) return null;
  return { origin, destination, departure_date: departureDate };
}

export function getAirlineProviderBookings(booking: FlightBookingSnapshot): AirlineProviderBooking[] {
  const bookingData = record(booking.bookingData);
  const source = Array.isArray(bookingData?.provider_bookings)
    ? bookingData.provider_bookings
    : [];
  const passengerData = Array.isArray(booking.passengerData) ? booking.passengerData : [];
  const passengerFallback = Array.from({ length: Math.max(passengerData.length, 1) }, (_, index) => index);
  const bookings = source.flatMap((providerBooking) => {
    const item = record(providerBooking);
    if (!item) return [];
    const pnr = text(item.pnr) ?? text(booking.pnr) ?? text(booking.orderNumber);
    const provider = text(item.provider) ?? text(booking.provider) ?? undefined;
    const rawJourneys = Array.isArray(item.journeys)
      ? item.journeys
      : Array.isArray(item.segments)
        ? item.segments
        : [];
    const journeys = rawJourneys.flatMap((rawJourney) => {
      const journey = journeyFrom(rawJourney, booking);
      if (!journey) return [];
      const itemRecord = record(rawJourney);
      const rawPassengers = itemRecord?.passengers ?? itemRecord?.pax;
      return [{ ...journey, pax: passengerNumbers(rawPassengers, passengerFallback) }];
    });

    return pnr && journeys.length ? [{ pnr, ...(provider ? { provider } : {}), journeys }] : [];
  });

  if (bookings.length) return bookings;

  const pnr = text(booking.pnr) ?? text(booking.orderNumber);
  const journey = journeyFrom({
    origin: booking.origin,
    destination: booking.destination,
    departure_date: booking.departureDate,
  }, booking);
  if (!pnr || !journey) return [];

  return [{
    pnr,
    ...(text(booking.provider) ? { provider: text(booking.provider)! } : {}),
    journeys: [{ ...journey, pax: passengerFallback }],
  }];
}

export function toAirlineRefundBookings(booking: FlightBookingSnapshot) {
  return getAirlineProviderBookings(booking).map(({ pnr, journeys }) => ({ pnr, journeys }));
}

function dateInJakarta(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function hasPassedDeparture(value: unknown, now: Date): boolean {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) && value.getTime() <= now.getTime();
  }
  if (typeof value !== 'string' || !value.trim()) return false;

  const normalized = value.trim();
  const date = normalized.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (date < dateInJakarta(now)) return true;

  const includesTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  if (!includesTimezone || date > dateInJakarta(now)) return false;

  const timestamp = Date.parse(normalized.replace(' ', 'T'));
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

export function hasFlightDeparted(booking: FlightBookingSnapshot, now = new Date()): boolean {
  if (hasPassedDeparture(booking.departureDate, now)) return true;

  const bookingData = record(booking.bookingData);
  const providerBookings = Array.isArray(bookingData?.provider_bookings)
    ? bookingData.provider_bookings
    : [];
  return providerBookings.some((rawProviderBooking) => {
    const providerBooking = record(rawProviderBooking);
    const journeys = Array.isArray(providerBooking?.journeys) ? providerBooking.journeys : [];
    return journeys.some((rawJourney) => {
      const journey = record(rawJourney);
      if (hasPassedDeparture(journey?.departure_date, now)) return true;
      const segments = Array.isArray(journey?.segments) ? journey.segments : [];
      return segments.some((rawSegment) =>
        hasPassedDeparture(record(rawSegment)?.departure_date, now)
      );
    });
  });
}

export function extractAirlineRefundAmount(value: unknown): number | null {
  const root = record(value);
  if (!root) return null;

  const amount = (candidate: unknown): number | null => {
    const parsed = typeof candidate === 'number'
      ? candidate
      : typeof candidate === 'string' && candidate.trim()
        ? Number(candidate)
        : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const sumAmounts = (candidates: unknown[]): number | null => {
    if (!candidates.length) return null;
    const amounts = candidates.map(amount);
    return amounts.every((candidate): candidate is number => candidate !== null)
      ? amounts.reduce((total, candidate) => total + candidate, 0)
      : null;
  };

  for (const key of ['refundable_amount', 'refund_amount']) {
    const found = amount(root[key]);
    if (found !== null) return found;
  }

  const refundList = Array.isArray(root.refund_list) ? root.refund_list : [];
  const refundListAmount = sumAmounts(refundList.map((item) => record(item)?.refund_amount));
  if (refundListAmount !== null) return refundListAmount;

  const providerBookings = Array.isArray(root.provider_bookings) ? root.provider_bookings : [];
  if (!providerBookings.length) return null;

  const providerAmounts = providerBookings.map((item) => {
    const providerBooking = record(item);
    const direct = amount(providerBooking?.refundable_amount) ?? amount(providerBooking?.refund_amount);
    if (direct !== null) return direct;
    const fees = Array.isArray(providerBooking?.refund_fee) ? providerBooking.refund_fee : [];
    return sumAmounts(fees.map((fee) => record(fee)?.received_amount));
  });
  if (providerAmounts.every((candidate): candidate is number => candidate !== null)) {
    return providerAmounts.reduce((total, candidate) => total + candidate, 0);
  }

  return null;
}

export function getAirlineRefundCancellationStatus(value: unknown, expectedPnrs: string[]) {
  const root = record(value);
  if (!root) return { confirmed: false, providers: [] as Array<{ pnr: string; state: string; error: string }> };

  const rawProviders = Array.isArray(root.provider_bookings) ? root.provider_bookings : [];
  const providers = rawProviders.flatMap((rawProvider) => {
    const provider = record(rawProvider);
    if (!provider) return [];
    return [{
      pnr: text(provider.pnr) ?? '',
      state: text(provider.state)?.toLowerCase() ?? '',
      error: text(provider.error_msg) ?? '',
    }];
  });

  if (providers.length) {
    const remaining = [...providers];
    const confirmed = providers.length === expectedPnrs.length
      && expectedPnrs.every((pnr) => {
        const index = remaining.findIndex((provider) =>
          provider.pnr === pnr && provider.state === 'refund' && !provider.error
        );
        if (index < 0) return false;
        remaining.splice(index, 1);
        return true;
      });
    return { confirmed, providers };
  }

  const state = text(root.state)?.toLowerCase() ?? '';
  const pnr = text(root.pnr) ?? '';
  const error = text(root.error_msg) ?? '';
  const confirmed = expectedPnrs.length === 1 && state === 'refund'
    && (!pnr || pnr === expectedPnrs[0]) && !error;
  return {
    confirmed,
    providers: [{ pnr, state, error }],
  };
}

export function getAirlineRescheduleStatus(value: unknown, expectedPnrs: string[]) {
  const root = record(value);
  const rawProviders = Array.isArray(root?.sell_reschedule_provider)
    ? root.sell_reschedule_provider
    : [];
  const providers = rawProviders.flatMap((rawProvider) => {
    const provider = record(rawProvider);
    if (!provider) return [];
    return [{
      pnr: text(provider.pnr) ?? '',
      status: text(provider.status)?.toUpperCase() ?? '',
      error: text(provider.error_msg) ?? '',
    }];
  });

  const remaining = [...providers];
  const allSucceeded = providers.length === expectedPnrs.length
    && expectedPnrs.every((pnr) => {
      const index = remaining.findIndex((provider) =>
        provider.pnr === pnr && provider.status === 'SUCCEED' && !provider.error
      );
      if (index < 0) return false;
      remaining.splice(index, 1);
      return true;
    });

  const partialSuccess = !allSucceeded && providers.some((provider) =>
    expectedPnrs.includes(provider.pnr) && provider.status === 'SUCCEED' && !provider.error
  );
  return { allSucceeded, partialSuccess, providers };
}
