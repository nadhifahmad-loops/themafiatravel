import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';
import { prisma } from '@/lib/prisma';
import { flightSearchSchema, validateBody, apiError, handleOrbisError } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type Journey = { origin: string; destination: string; departure_date: string };

/** Bentuk schedule Orbis (longgar — hanya sebagian field yang dipakai di sini). */
type OrbisSchedule = {
  journeys?: Array<Record<string, unknown>>;
  origin?: string;
  destination?: string;
  departure_date?: string;
  sequence?: number | string;
  [key: string]: unknown;
};

/** Envelope respons search Orbis. */
type ScheduleEnvelope = {
  schedules?: OrbisSchedule[];
  response?: { schedules?: OrbisSchedule[] };
};

/**
 * Selaraskan daftar `schedules` dari Orbis dengan urutan journey_list.
 *
 * Orbis mengembalikan satu schedule per journey_list, tapi kalau salah satu leg
 * tidak punya penerbangan (terutama Multi/RT), entry-nya bisa saja hilang
 * sehingga index bergeser. Fungsi ini memaksa panjang array = jumlah leg dan
 * mengisi leg yang kosong dengan `journeys: []` supaya frontend yang memilih
 * per-leg tidak salah menampilkan data.
 */
function normalizeSchedules(data: ScheduleEnvelope | null | undefined, journeyList: Journey[], fallbackProvider: string): OrbisSchedule[] {
  const raw = data?.schedules || data?.response?.schedules;
  const schedules: OrbisSchedule[] = Array.isArray(raw) ? raw : [];
  const used = new Set<number>();

  const pick = (predicate: (s: OrbisSchedule, idx: number) => boolean): number => {
    const idx = schedules.findIndex((s, i) => !used.has(i) && predicate(s, i));
    if (idx >= 0) used.add(idx);
    return idx;
  };

  return journeyList.map((j, i) => {
    // 1. Cocokkan lewat `sequence` (1-based) — paling akurat.
    let matchIdx = pick((s) => Number(s?.sequence) === i + 1);
    // 2. Fallback: cocokkan origin + destination + departure_date.
    if (matchIdx < 0) {
      matchIdx = pick((s) => s?.origin === j.origin && s?.destination === j.destination && (s?.departure_date || '') === j.departure_date);
    }
    // 3. Fallback terakhir: cocokkan origin + destination saja.
    if (matchIdx < 0) {
      matchIdx = pick((s) => s?.origin === j.origin && s?.destination === j.destination);
    }
    if (matchIdx >= 0) return schedules[matchIdx];

    return {
      journeys: [],
      provider: fallbackProvider,
      origin: j.origin,
      destination: j.destination,
      departure_date: j.departure_date,
      sequence: i + 1,
    };
  });
}

/**
 * Cari tiap leg secara terpisah (One Way) lalu susun ulang menjadi daftar
 * `schedules` yang sejajar dengan journey_list. Dipakai sebagai fallback ketika
 * pencarian gabungan (Multi/RT) gagal total karena salah satu leg kosong.
 */
async function searchPerLeg(
  provider: string,
  journeyList: Journey[],
  pax: { adult: number; child: number; infant: number; cabin_class: string }
): Promise<OrbisSchedule[]> {
  const perLeg: Array<Array<Record<string, unknown>>> = await Promise.all(
    journeyList.map(async (j) => {
      try {
        const res = await flightAPI.search({
          provider,
          journey_list: [j],
          adult: pax.adult,
          child: pax.child,
          infant: pax.infant,
          cabin_class: pax.cabin_class,
          carrier_codes: [],
          is_combo_price: false,
          promo_codes: [],
        });
        const scheds = res?.schedules || res?.response?.schedules || [];
        return (scheds?.[0]?.journeys || []) as Array<Record<string, unknown>>;
      } catch (err) {
        console.warn(`[FLIGHT SEARCH] Per-leg fallback gagal untuk ${j.origin}→${j.destination}:`, err);
        return [] as Array<Record<string, unknown>>;
      }
    })
  );

  return journeyList.map((j, i) => ({
    journeys: perLeg[i],
    provider,
    origin: j.origin,
    destination: j.destination,
    departure_date: j.departure_date,
    sequence: i + 1,
  }));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return apiError('Terlalu banyak pencarian. Silakan coba lagi nanti.', 429, { retryAfter: rateLimit.retryAfter });
  }

  let providerToSearch: string = 'unknown';
  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.orbisSession.deleteMany({
      where: { createdAt: { lt: fifteenMinsAgo } },
    });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError('Request body tidak valid.', 400);
    }
    const validation = validateBody(flightSearchSchema, body);
    if (!validation.success) return validation.response;
    const data = validation.data;

    providerToSearch = data.provider || 'citilink';

    let journey_list: Journey[] = [];

    if (data.direction === 'Multi' && Array.isArray(data.routes) && data.routes.length > 0) {
      journey_list = data.routes.map((r) => ({
        origin: r.origin,
        destination: r.destination,
        departure_date: r.departure_date,
      }));
    } else if (Array.isArray(data.journey_list) && data.journey_list.length > 0) {
      journey_list = data.journey_list;
    } else {
      journey_list.push({
        origin: data.origin || '',
        destination: data.destination || '',
        departure_date: data.departure_date || '',
      });
      if (data.direction === 'RT' && data.return_date) {
        journey_list.push({
          origin: data.destination || '',
          destination: data.origin || '',
          departure_date: data.return_date,
        });
      }
    }

    for (const j of journey_list) {
      if (!j.origin || !j.destination || !j.departure_date) {
        return apiError('Data rute tidak lengkap (origin/destination/departure_date).', 400);
      }
    }

    console.log(
      `[FLIGHT SEARCH] Provider: ${providerToSearch} | ${journey_list.map(j => `${j.origin}→${j.destination}`).join(', ')} | dir: ${data.direction || 'OW'}`
    );

    const pax = {
      adult: Number(data.adult) || 1,
      child: Number(data.child) || 0,
      infant: Number(data.infant) || 0,
      cabin_class: data.cabin_class || 'Y',
    };

    try {
      const result = await flightAPI.search({
        provider: providerToSearch,
        journey_list,
        ...pax,
        carrier_codes: data.carrier_codes || [],
        is_combo_price: data.is_combo_price ?? (data.direction === 'RT'),
        promo_codes: [],
      });

      const schedules = normalizeSchedules(result, journey_list, providerToSearch);
      const base = result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
      return NextResponse.json({ success: true, data: { ...base, schedules } });
    } catch (searchError) {
      // Fallback: kalau pencarian gabungan gagal total (mis. salah satu leg
      // Multi/RT kosong sehingga Orbis balas error), coba per-leg supaya hasil
      // leg yang tersedia tetap bisa dipakai user tanpa reset.
      if (journey_list.length >= 2) {
        console.warn('[FLIGHT SEARCH] Pencarian gabungan gagal, mencoba fallback per-leg...', searchError);
        const perLeg = await searchPerLeg(providerToSearch, journey_list, pax);
        const hasAnyJourney = perLeg.some((s) => (s.journeys?.length || 0) > 0);
        if (hasAnyJourney) {
          return NextResponse.json({ success: true, data: { schedules: perLeg } });
        }
      }
      throw searchError;
    }

  } catch (error: unknown) {
    return handleOrbisError(error, 'FLIGHT SEARCH');
  }
}
