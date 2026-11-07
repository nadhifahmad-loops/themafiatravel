import { hotelAPI } from '@/lib/orbis';
import type { OrbisError } from '@/lib/orbis-types';

type HotelSearchResponse = {
  hotel_ids?: Array<{
    id?: string;
    name?: string;
    rating?: string | number;
    prices?: Record<string, unknown>;
  }>;
  city_ids?: unknown[];
};

// Penggunaan (dari root project):
//   node --env-file=.env --import tsx scripts/hotel-search-smoke.ts
//   node --env-file=.env --import tsx scripts/hotel-search-smoke.ts SG7355 2026-12-10 2026-12-12 SG
//
// Argumen opsional berurutan: destination_id, checkin_date, checkout_date, nationality,
// adult, child, room. Ini smoke test vendor manual, tidak termasuk `npm test`.

async function main() {
  const args = process.argv.slice(2);
  const dateOffset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const [
    destination_id = 'SG7355',
    checkin_date = dateOffset(30),
    checkout_date = dateOffset(32),
    nationality = 'SG',
    adultInput = '2',
    childInput = '0',
    roomInput = '1',
  ] = args;

  const payload: Record<string, unknown> = {
    checkin_date,
    checkout_date,
    destination_id,
    adult: Number(adultInput),
    child: Number(childInput),
    child_ages: [],
    room: Number(roomInput),
    nationality,
  };

  console.log('[HOTEL SEARCH TEST] payload:\n' + JSON.stringify(payload, null, 2) + '\n');
  const started = Date.now();

  try {
    const data = (await hotelAPI.search(payload)) as HotelSearchResponse;
    const ms = Date.now() - started;

    console.log(`[HOTEL SEARCH TEST] SUCCESS dalam ${ms}ms`);
    console.log('keys response:', Object.keys(data ?? {}));

    const hotelList = Array.isArray(data?.hotel_ids) ? data.hotel_ids : [];
    const cityList = Array.isArray(data?.city_ids) ? data.city_ids : [];
    console.log(`jumlah hotel: ${hotelList.length}, jumlah city: ${cityList.length}`);

    if (hotelList.length > 0) {
      console.log('\nContoh hotel pertama:');
      const h = hotelList[0];
      console.log(
        'id:', h.id,
        '| name:', h.name,
        '| rating:', h.rating,
        '| provider:', Object.keys(h.prices ?? {}).join(', '),
      );
      console.log('\n=== FULL RESPONSE ===\n');
    }
    console.log(JSON.stringify(data, null, 2));
  } catch (error: unknown) {
    const e = error as OrbisError;
    const ms = Date.now() - started;
    console.log(`[HOTEL SEARCH TEST] ERROR dalam ${ms}ms`);
    console.log('message:', e?.message);
    console.log('orbisCode:', e?.orbisCode);
    console.log('orbisResponse:', JSON.stringify(e?.orbisResponse ?? null, null, 2));
    process.exitCode = 1;
  }
}

main();