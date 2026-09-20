// lib/train-seat-data.ts
// Helper server-only untuk alur "Change Seat" KAI (get_seat_availability & assign_seats).
// Derivasi fare_code dan penyusunan payload assign_seats dipindah dari client ke
// server, sehingga client cukup mengirim orderId + pilihan kursi, tanpa perlu
// data mentah Orbis (harga net/cost vendor) ataupun identifier internal.

type JsonRecord = Record<string, unknown>;

const asRecord = (v: unknown): JsonRecord => (v && typeof v === 'object' ? (v as JsonRecord) : {});

const strOf = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/**
 * Subset aman (display) dari provider_bookings KAI untuk dikirim ke client:
 * hanya journey + kursi. Tidak menyertakan harga, biaya, maupun field vendor.
 */
export function safeTrainProviderBookings(providerBookings: unknown): Array<JsonRecord> {
  if (!Array.isArray(providerBookings)) return [];
  const out: Array<JsonRecord> = [];

  for (const pbRaw of providerBookings) {
    const pb = asRecord(pbRaw);
    const journeys = Array.isArray(pb.journeys) ? (pb.journeys as unknown[]) : [];
    const safeJourneys: Array<JsonRecord> = [];

    for (const jRaw of journeys) {
      const j = asRecord(jRaw);
      const safeSeats: Array<JsonRecord> = [];
      const rawSeats = Array.isArray(j.seats) ? (j.seats as unknown[]) : [];
      for (const sRaw of rawSeats) {
        const s = asRecord(sRaw);
        const seatRow: JsonRecord = {};
        const seat = strOf(s.seat);
        if (seat) seatRow.seat = seat;
        if (s.seat_code != null) seatRow.seat_code = s.seat_code;
        if (s.passenger_sequence != null) seatRow.passenger_sequence = s.passenger_sequence;
        const passenger = strOf(s.passenger);
        if (passenger) seatRow.passenger = passenger;
        if (Object.keys(seatRow).length) safeSeats.push(seatRow);
      }

      const journeyRow: JsonRecord = {};
      const sequence = typeof j.sequence === 'number' || typeof j.sequence === 'string' ? j.sequence : undefined;
      if (sequence !== undefined) journeyRow.sequence = sequence;
      const fareCode = strOf(j.fare_code);
      if (fareCode) journeyRow.fare_code = fareCode;
      const origin = strOf(j.origin);
      if (origin) journeyRow.origin = origin;
      const destination = strOf(j.destination);
      if (destination) journeyRow.destination = destination;
      const originName = strOf(j.origin_name);
      if (originName) journeyRow.origin_name = originName;
      const destinationName = strOf(j.destination_name);
      if (destinationName) journeyRow.destination_name = destinationName;
      if (safeSeats.length) journeyRow.seats = safeSeats;

      if (Object.keys(journeyRow).length) safeJourneys.push(journeyRow);
    }

    if (safeJourneys.length) out.push({ journeys: safeJourneys });
  }

  return out;
}

/**
 * Kumpulkan fare_code unik dari seluruh journey (urutan stabil sesuai booking).
 * Dipakai server untuk memanggil get_seat_availability — client tidak perlu
 * mengirim/mengetahui fare_code.
 */
export function deriveTrainFareCodes(bookingData: unknown): string[] {
  const bd = asRecord(bookingData);
  const pbs = Array.isArray(bd.provider_bookings) ? (bd.provider_bookings as unknown[]) : [];
  const codes: string[] = [];
  for (const pbRaw of pbs) {
    const pb = asRecord(pbRaw);
    const journeys = Array.isArray(pb.journeys) ? (pb.journeys as unknown[]) : [];
    for (const jRaw of journeys) {
      const fc = strOf(asRecord(jRaw).fare_code);
      if (fc) codes.push(fc);
    }
  }
  return Array.from(new Set(codes));
}

export interface TrainSeatChange {
  journeyIdx: number;
  passenger_sequence: number;
  cabin_code: string;
  seat_row: number;
  seat_column: string;
}

/**
 * Susun payload provider_bookings untuk assign_seats berdasarkan pilihan kursi
 * dari client. journeyIdx adalah indeks flatten (urutan iterasi provider_bookings
 * → journeys) yang sama dengan urutan journey yang ditampilkan client.
 * Hanya journey yang ada perubahan kursinya yang dikirim; penumpang lain tetap
 * di kursi lamanya.
 */
export function buildTrainAssignPayload(bookingData: unknown, changes: TrainSeatChange[]): unknown[] {
  const bd = asRecord(bookingData);
  const pbs = Array.isArray(bd.provider_bookings) ? (bd.provider_bookings as unknown[]) : [];
  const result: Array<JsonRecord> = [];
  let flattenIdx = 0;

  for (const pbRaw of pbs) {
    const pb = asRecord(pbRaw);
    const journeys = Array.isArray(pb.journeys) ? (pb.journeys as unknown[]) : [];
    const jChanges: Array<JsonRecord> = [];

    for (const jRaw of journeys) {
      const j = asRecord(jRaw);
      const seats = changes
        .filter((c) => c.journeyIdx === flattenIdx)
        .map((c) => ({
          cabin_code: c.cabin_code,
          seat_row: Number(c.seat_row) || 0,
          seat_column: c.seat_column,
          passenger_sequence: Number(c.passenger_sequence) || 0,
        }));
      flattenIdx += 1;

      if (seats.length) {
        jChanges.push({
          sequence: Number(j.sequence) || 0,
          seats,
        });
      }
    }

    if (jChanges.length) {
      const entry: JsonRecord = { provider: 'kai', journey: jChanges };
      if (typeof pb.sequence === 'number') entry.sequence = pb.sequence;
      result.push(entry);
    }
  }

  return result;
}