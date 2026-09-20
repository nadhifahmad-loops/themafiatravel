import { hotelAPI } from '@/lib/orbis';

// Penggunaan (dari root project):
//   node --env-file=.env --import tsx scripts/hotel-search-test.ts
//   node --env-file=.env --import tsx scripts/hotel-search-test.ts SG7355 2026-10-10 2026-10-12 SG
//
// Argumen opsional berurutan: destination_id, checkin_date, checkout_date, nationality,
// adult, child, room. Memanggil hotelAPI.search yang SAMA dengan route
// app/api/hotel/search/route.ts (termasuk normalisasi child_ages & retry).

async function main() {
  const args = process.argv.slice(2);
  const [
    destination_id = 'SG7355',
    checkin_date = '2026-10-10',
    checkout_date = '2026-10-12',
    nationality = 'SG',
    adultInput = '2',
    childInput = '0',
    roomInput = '1',
  ] = args;

  const payload: Record<string, unknown> = {
    checkin_date,
    checkout_date,
    destination_id,
    search_name: '',
    adult: Number(adultInput),
    child: Number(childInput),
    child_ages: [],
    room: Number(roomInput),
    nationality,
  };

  console.log('[HOTEL SEARCH TEST] payload:\n' + JSON.stringify(payload, null, 2) + '\n');
  const started = Date.now();

  try {
    const data = (await hotelAPI.search(payload)) as Record<string, any>;
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
  } catch (e: any) {
    const ms = Date.now() - started;
    console.log(`[HOTEL SEARCH TEST] ERROR dalam ${ms}ms`);
    console.log('message:', e?.message);
    console.log('orbisCode:', e?.orbisCode);
    console.log('orbisResponse:', JSON.stringify(e?.orbisResponse ?? null, null, 2));
    process.exitCode = 1;
  }
}

main();