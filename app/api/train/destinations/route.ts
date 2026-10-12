import { NextRequest, NextResponse } from 'next/server';
import { trainAPI } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

interface TrainStationRow {
  code: string;
  name: string;
  city: string;
  label: string;
}

interface OrbisCountry {
  code?: string;
  destinations?: Array<{ code: string; name: string; city: string; active?: boolean }>;
}

// Cache sederhana in-memory (daftar stasiun jarang berubah)
let _cache: TrainStationRow[] | null = null;
let _cacheAt = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 jam

// Orbis `get_destinations` mengembalikan SELURUH stasiun dunia
// (~131.000 stasiun / ~13 MB). Karena provider kereta di sini KAI
// (Indonesia) dan contoh di doc RODEXTRIP hanya berisi Indonesia,
// kita batasi ke negara Indonesia saja (code "ID") supaya payload
// yang dikirim ke browser wajar (~300 stasiun).
const TRAIN_COUNTRY_CODE = 'ID';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const now = Date.now();
    if (_cache && (now - _cacheAt) < CACHE_TTL) {
      return NextResponse.json({ success: true, data: _cache, fromCache: true });
    }

    const raw = await trainAPI.getDestinations();

    // Flatten: ambil destinations dari negara terkait saja (lihat TRAIN_COUNTRY_CODE)
    const stations: TrainStationRow[] = [];
    const countries: OrbisCountry[] = Array.isArray(raw) ? raw : [raw];
    const matchedCountry = countries.some((c) => c?.code === TRAIN_COUNTRY_CODE);
    for (const country of countries) {
      if (matchedCountry && country?.code !== TRAIN_COUNTRY_CODE) continue;
      if (Array.isArray(country.destinations)) {
        for (const d of country.destinations) {
          if (d.active !== false) {
            stations.push({
              code: d.code,
              name: d.name,
              city: d.city,
              label: `${d.name} (${d.code})`,
            });
          }
        }
      }
    }

    // Urutkan berdasarkan kota lalu nama
    stations.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

    _cache = stations;
    _cacheAt = now;

    return NextResponse.json({ success: true, data: stations });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal mengambil daftar stasiun kereta';
    console.error('[Train Destinations ERROR]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
