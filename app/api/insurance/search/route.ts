import { NextRequest, NextResponse } from 'next/server';
import { insuranceAPI } from '@/lib/orbis';
import { insuranceSearchSchema, validateBody } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Map destination_area per provider agar API tidak error
const PROVIDER_AREAS: Record<string, string[]> = {
  assistcard: ['Europe', 'North America', 'Central America and Caribbean', 'South America', 'Africa', 'Asia', 'Oceania', 'Domestic', 'Receptive', 'Annual Card', 'Multiple Destinations'],
  bcainsurance: ['Asia Pasifik', 'Worldwide', 'Negara Schengen', 'Domestik'],
  zurich: ['Worldwide Excluding USA, Canada', 'Europe', 'Asia Pacific', 'Asia', 'Schengen', 'Worldwide', 'ASEAN', 'Domestic'],
  great_eastern: ['ASEAN', 'Asia Pacific', 'Domestic', 'Worldwide', 'Worldwide exc US/Canada'],
  oona: ['All'],
};

const DEFAULT_PROVIDERS = Object.keys(PROVIDER_AREAS);

type InsuranceProduct = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function normalizeProducts(result: unknown, provider: string): InsuranceProduct[] {
  const resultRecord = asRecord(result);
  const responseRecord = asRecord(resultRecord?.response);
  const dataRecord = asRecord(resultRecord?.data);
  const candidates = [
    resultRecord?.[provider],
    responseRecord?.[provider],
    dataRecord?.[provider],
    resultRecord?.response,
    resultRecord?.data,
    result,
  ];
  const rawProducts = candidates.find((value) => Array.isArray(value)) || [];

  return rawProducts
    .filter((product): product is InsuranceProduct => Boolean(asRecord(product)))
    .map((product) => ({
      ...product,
      provider: typeof product.provider === 'string' ? product.provider : provider,
      carrier_code: typeof product.carrier_code === 'string' ? product.carrier_code : provider,
      product_code: String(product.product_code || product.plan_code || product.code || ''),
      product_name: String(product.product_name || product.plan_name || product.name || 'Paket Asuransi'),
      package: typeof (product.package ?? product.package_id ?? product.package_code ?? product.package_number) === 'string'
        || typeof (product.package ?? product.package_id ?? product.package_code ?? product.package_number) === 'number'
        ? (product.package ?? product.package_id ?? product.package_code ?? product.package_number)
        : 1,
      total_price: Number(
        product.total_price ?? product.price_total ?? product.premium ?? product.price ?? 0
      ),
    }))
    .filter((product) => product.product_code && Number.isFinite(product.total_price) && product.total_price > 0);
}

// Pilih area terbaik dari provider berdasarkan input user
function pickBestArea(provider: string, requestedArea: string): string {
  const validAreas = PROVIDER_AREAS[provider] || [];
  // exact match dulu
  if (validAreas.includes(requestedArea)) return requestedArea;
  // case-insensitive
  const lower = requestedArea.toLowerCase();
  const found = validAreas.find(a => a.toLowerCase().includes(lower) || lower.includes(a.toLowerCase()));
  if (found) return found;
  // fallback: oona pakai "All", domestic, atau area pertama
  if (provider === 'oona') return 'All';
  const domestic = validAreas.find(a => a.toLowerCase().includes('domestic'));
  return domestic || validAreas[0] || requestedArea;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak pencarian. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body tidak valid.' }, { status: 400 });
    }

    const validation = validateBody(insuranceSearchSchema, body);
    if (!validation.success) return validation.response;
    const v = validation.data;

    const {
      date_start,
      date_end,
      pax = 1,
      destination = '',
      is_senior = false,
      international = true,
      destination_area,
      type = 'single_trip',
      product_type = 'individual',
      providers,
    } = v;

    if (!date_start || !date_end) {
      return NextResponse.json({ error: 'date_start dan date_end wajib diisi' }, { status: 400 });
    }

    const start = new Date(`${date_start}T00:00:00Z`).getTime();
    const end = new Date(`${date_end}T00:00:00Z`).getTime();
    const passengerCount = Number(pax);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return NextResponse.json({ error: 'Tanggal selesai harus setelah tanggal mulai.' }, { status: 400 });
    }
    if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 20) {
      return NextResponse.json({ error: 'Jumlah peserta harus antara 1 dan 20.' }, { status: 400 });
    }

    // Tentukan list provider yang akan di-search
    const requestedProviders: string[] = providers
      ? (Array.isArray(providers) ? providers : [providers])
      : DEFAULT_PROVIDERS;
    const providerList = [...new Set(requestedProviders.map(String).filter((provider) => DEFAULT_PROVIDERS.includes(provider)))];
    if (providerList.length === 0) {
      return NextResponse.json({ error: 'Provider asuransi tidak valid.' }, { status: 400 });
    }

    console.log('[INSURANCE SEARCH] Providers:', providerList, '| Area:', destination_area);

    // Search semua provider secara parallel
    const searchPromises = providerList.map(async (provider) => {
      const area = pickBestArea(provider, destination_area || (international ? 'Asia' : 'Domestic'));
      const payload = {
        date_start,
        date_end,
        pax: passengerCount,
        destination,
        is_senior,
        international,
        destination_area: area,
        type,
        provider,
        product_type,
        carrier_code: provider,
        age: '',
      };

      try {
        const result = await insuranceAPI.getAvailability(payload, { timeoutMs: 30000, maxRetries: 1 });
        const products = normalizeProducts(result, provider);
        return { provider, products, area, error: null };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Provider gagal merespons.';
        const friendlyMessage = /timeout|terputus/i.test(message)
          ? 'Provider tidak merespons dalam 30 detik.'
          : message;
        console.error(`[INSURANCE SEARCH] Provider ${provider} error:`, e);
        return { provider, products: [], area, error: friendlyMessage };
      }
    });

    const results = await Promise.all(searchPromises);

    // Gabungkan semua hasil
    const allProducts: InsuranceProduct[] = [];
    const providerResults: Record<string, InsuranceProduct[]> = {};
    const errors: Record<string, string> = {};

    for (const r of results) {
      providerResults[r.provider] = r.products;
      if (r.error) errors[r.provider] = r.error;
      // Tandai produk dengan info provider
      r.products.forEach((p) => {
        allProducts.push({ ...p, _searched_area: r.area });
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        all: allProducts,
        byProvider: providerResults,
        errors,
        meta: { date_start, date_end, pax: passengerCount, destination_area, international, providers: providerList },
      },
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gagal mencari asuransi.';
    console.error('[INSURANCE SEARCH] Fatal error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}