// lib/booking-segments.ts
// Normalisasi provider_bookings → segmen booking yang aman untuk tampil & dicetak.
// Dipakai oleh:
//   - lib/ticket-pdf.tsx (dokumen PDF resmi)
//   - app/api/bookings/[id]/route.ts (data display-safe ke halaman detail)
//
// Vendor (Orbis/CitiLink/KAI) menyimpan data perjalanan dalam struktur yang
// berbeda: beberapa memakai `provider_bookings[].segments[]`, lainnya memakai
// `provider_bookings[].journeys[].segments[]` (atau hanya journey fields seperti
// origin/arrival_date). Fungsi ini mengembalikan satu urutan segmen yang sudah
// diberi nama kota dan waktu yang konsisten.

export type NormalizedSegment = {
  origin?: string | null;
  destination?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  originTerminal?: string | null;
  destinationTerminal?: string | null;
  departureDate?: string | null;
  arrivalDate?: string | null;
  carrierName?: string | null;
  flightNumber?: string | null;
  cabinClass?: string | null;
  baggage?: string | null;
  passengers?: Array<{
    passenger_number?: number | string;
    number?: number | string;
    seat?: string | null;
    seat_code?: string | null;
    seat_assignment?: string | null;
  }>;
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function dateStr(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildFromLegish(
  j: Record<string, unknown>,
  leg: Record<string, unknown>,
): NormalizedSegment | null {
  const origin = str(leg.origin) ?? str(j.origin);
  const destination = str(leg.destination) ?? str(j.destination);
  const originName =
    str(leg.origin_display_name) ?? str(leg.origin_name) ?? str(leg.origin_city) ?? str(j.origin_display_name) ?? str(j.origin_name) ?? str(j.origin_city);
  const destinationName =
    str(leg.destination_display_name) ?? str(leg.destination_name) ?? str(leg.destination_city) ?? str(j.destination_display_name) ?? str(j.destination_name) ?? str(j.destination_city);
  const carrierName = str(leg.carrier_name) ?? str(j.carrier_name) ?? str(j.provider_name) ?? null;
  const flightNumber =
    str(leg.flight_number) ??
    str(leg.carrier_number) ??
    (str(leg.carrier_code) ? `${str(leg.carrier_code)}${str(leg.carrier_number) ?? ''}`.trim() : null) ??
    str(j.carrier_number) ??
    str(j.carrier_code) ??
    str(j.journey_code);
  const departureDate = dateStr(leg.departure_date) ?? dateStr(j.departure_date);
  const arrivalDate = dateStr(leg.arrival_date) ?? dateStr(j.arrival_date);
  const cabinClass = str(leg.cabin_class) ?? str(leg.cabin_class_name) ?? str(j.cabin_class) ?? str(j.class_of_service);
  const baggage = str(leg.baggage_allowance) ?? str(leg.cabin_baggage) ?? str(j.baggage_allowance) ?? str(j.cabin_baggage);

  if (!origin && !destination && !departureDate && !arrivalDate) return null;

  return {
    origin,
    destination,
    originName,
    destinationName,
    originTerminal: str(leg.origin_terminal) ?? str(leg.terminal) ?? null,
    destinationTerminal: str(leg.destination_terminal) ?? str(leg.terminal) ?? null,
    departureDate,
    arrivalDate,
    carrierName,
    flightNumber,
    cabinClass,
    baggage,
  };
}

/**
 * Flatten provider_bookings → array segmen. Order mengikuti urutan provider
 * dan journey (untuk rute lanjutan/transit), aman untuk rute direct.
 */
export function normalizeBookingSegments(providerBookings: unknown): NormalizedSegment[] {
  if (!Array.isArray(providerBookings)) return [];

  const out: NormalizedSegment[] = [];
  const seen = new Set<string>();

  const push = (seg: NormalizedSegment) => {
    const key = `${seg.origin ?? ''}-${seg.destination ?? ''}-${seg.departureDate ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(seg);
  };

  for (const pbRaw of providerBookings) {
    const pb = pbRaw && typeof pbRaw === 'object' ? (pbRaw as Record<string, unknown>) : {};
    const segments = Array.isArray(pb.segments) ? (pb.segments as unknown[]) : [];

    if (segments.length > 0) {
      for (const sRaw of segments) {
        const s = sRaw && typeof sRaw === 'object' ? (sRaw as Record<string, unknown>) : {};
        push({
          origin: str(s.origin) ?? null,
          destination: str(s.destination) ?? null,
          originName: str(s.origin_name) ?? str(s.origin_display_name) ?? null,
          destinationName: str(s.destination_name) ?? str(s.destination_display_name) ?? null,
          originTerminal: str(s.origin_terminal) ?? str(s.terminal) ?? null,
          destinationTerminal: str(s.destination_terminal) ?? str(s.terminal) ?? null,
          departureDate: dateStr(s.departure_date),
          arrivalDate: dateStr(s.arrival_date),
          carrierName: str(s.carrier_name) ?? str(s.carrier) ?? null,
          flightNumber: str(s.flight_number) ?? str(s.carrier_number) ?? null,
          cabinClass: str(s.cabin_class) ?? str(s.cabin_class_name) ?? str(s.class_of_service) ?? null,
          baggage: str(s.baggage_allowance) ?? str(s.cabin_baggage) ?? null,
          passengers: Array.isArray(s.passengers) ? (s.passengers as NormalizedSegment['passengers']) : [],
        });
      }
      continue;
    }

    const journeys = Array.isArray(pb.journeys) ? (pb.journeys as unknown[]) : [];
    if (journeys.length === 0) continue;

    for (const jRaw of journeys) {
      const j = jRaw && typeof jRaw === 'object' ? (jRaw as Record<string, unknown>) : {};
      const jSegments = Array.isArray(j.segments) ? (j.segments as unknown[]) : [];
      if (jSegments.length > 0) {
        for (const sRaw of jSegments) {
          const s = sRaw && typeof sRaw === 'object' ? (sRaw as Record<string, unknown>) : {};
          push({
            origin: str(s.origin) ?? str(j.origin) ?? null,
            destination: str(s.destination) ?? str(j.destination) ?? null,
            originName: str(s.origin_name) ?? str(s.origin_display_name) ?? str(j.origin_display_name) ?? str(j.origin_name) ?? str(j.origin_city) ?? null,
            destinationName: str(s.destination_name) ?? str(s.destination_display_name) ?? str(j.destination_display_name) ?? str(j.destination_name) ?? str(j.destination_city) ?? null,
            originTerminal: str(s.origin_terminal) ?? str(s.terminal) ?? null,
            destinationTerminal: str(s.destination_terminal) ?? str(s.terminal) ?? null,
            departureDate: dateStr(s.departure_date) ?? dateStr(j.departure_date),
            arrivalDate: dateStr(s.arrival_date) ?? dateStr(j.arrival_date),
            carrierName: str(s.carrier_name) ?? str(s.carrier) ?? str(j.carrier_name) ?? str(j.provider_name) ?? null,
            flightNumber: str(s.flight_number) ?? str(s.carrier_number) ?? str(j.carrier_number) ?? str(j.carrier_code) ?? str(j.journey_code) ?? null,
            cabinClass: str(s.cabin_class) ?? str(s.cabin_class_name) ?? str(s.class_of_service) ?? str(j.cabin_class) ?? str(j.class_of_service) ?? null,
            baggage: str(s.baggage_allowance) ?? str(s.cabin_baggage) ?? str(j.baggage_allowance) ?? str(j.cabin_baggage) ?? null,
            passengers: Array.isArray(s.passengers) ? (s.passengers as NormalizedSegment['passengers']) : [],
          });
        }
        continue;
      }

      const seg = buildFromLegish(j, j);
      if (seg) push(seg);
    }
  }

  return out;
}
