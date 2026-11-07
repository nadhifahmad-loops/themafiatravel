import type { OrbisStruct } from '@/lib/orbis-types';

type HotelSearchData = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeHotelChildAges(childAges: unknown): string {
  const values = Array.isArray(childAges)
    ? childAges
    : typeof childAges === 'string'
      ? childAges.replace(/^\[|\]$/g, '').split(',')
      : [];
  const ages = values
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= 0 && value <= 12);

  return `[${ages.join(',')}]`;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized || undefined;
  }
  return undefined;
}

function firstRoom(response: Record<string, unknown>): Record<string, unknown> | undefined {
  const rooms = response.hotel_rooms;
  if (Array.isArray(rooms)) {
    return rooms.find(isRecord);
  }
  if (isRecord(rooms)) {
    return rooms;
  }
  return undefined;
}

export function getOrbisHotelProvisionPriceCode(response: unknown, fallback = ''): string {
  if (isRecord(response)) {
    const priceCode = text(response.price_code);
    if (priceCode) return priceCode;
  }
  return fallback;
}

export function getOrbisHotelBookingIdentifiers(
  response: unknown,
  fallbackProvider = '',
  fallbackIssuedName = '',
) {
  const booking = isRecord(response) ? response : {};
  const room = firstRoom(booking);
  const orderNumber = text(booking.order_number);
  const pnr = text(booking.pnr)
    || text(room?.pnr)
    || text(room?.booking_code)
    || orderNumber;

  return {
    orderNumber,
    pnr,
    issuedName: text(booking.issued_name)
      || text(room?.issued_name)
      || pnr
      || text(fallbackIssuedName),
    provider: text(booking.provider) || text(room?.provider) || text(fallbackProvider),
  };
}

export function buildOrbisHotelBookingPayload(params: OrbisStruct): OrbisStruct {
  const searchData = isRecord(params.search_data) ? params.search_data as HotelSearchData : undefined;
  const payload: OrbisStruct = {
    hotel_code: String(params.hotel_code ?? ''),
    price_codes: String(params.price_code ?? ''),
    passengers: params.passengers ?? params.passenger ?? [],
    contact: params.contact ?? [],
    booker: params.booker ?? {},
    kwargs: { force_issued: 'True' },
  };

  if (typeof params.special_request === 'string') {
    payload.special_request = params.special_request;
  }

  if (searchData) {
    payload.search_data = {
      checkin_date: searchData.checkin_date,
      checkout_date: searchData.checkout_date,
      destination_id: searchData.destination_id,
      adult: Number(searchData.adult ?? 2),
      child: Number(searchData.child ?? 0),
      child_ages: normalizeHotelChildAges(searchData.child_ages),
      rooms: Number(searchData.rooms ?? searchData.room ?? 1),
      nationality: searchData.nationality,
    };
  }

  return payload;
}
