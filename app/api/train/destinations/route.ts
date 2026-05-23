import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';

// Cache sederhana in-memory (daftar stasiun jarang berubah)
let _cache: any[] | null = null;
let _cacheAt = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 jam

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now = Date.now();
    if (_cache && (now - _cacheAt) < CACHE_TTL) {
      return NextResponse.json({ success: true, data: _cache, fromCache: true });
    }

    const raw = await trainAPI.getDestinations();

    // Flatten: ambil semua destinations dari semua negara
    const stations: any[] = [];
    const countries = Array.isArray(raw) ? raw : [raw];
    for (const country of countries) {
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
  } catch (e: any) {
    console.error('[Train Destinations ERROR]', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
