import { NextRequest, NextResponse } from 'next/server';
import { insuranceAPI } from '@/lib/orbis';

// Map destination_area per provider agar API tidak error
const PROVIDER_AREAS: Record<string, string[]> = {
  assistcard: ['Europe', 'North America', 'Central America and Caribbean', 'South America', 'Africa', 'Asia', 'Oceania', 'Domestic', 'Receptive', 'Annual Card', 'Multiple Destinations'],
  bcainsurance: ['Asia Pasifik', 'Worldwide', 'Negara Schengen', 'Domestik'],
  zurich: ['Worldwide Excluding USA, Canada', 'Europe', 'Asia Pacific', 'Asia', 'Schengen', 'Worldwide', 'ASEAN', 'Domestic'],
  great_eastern: ['ASEAN', 'Asia Pacific', 'Domestic', 'Worldwide', 'Worldwide exc US/Canada'],
  oona: ['All'],
};

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
  try {
    const body = await req.json();
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
      providers, // array of providers, or single provider string
    } = body;

    if (!date_start || !date_end) {
      return NextResponse.json({ error: 'date_start dan date_end wajib diisi' }, { status: 400 });
    }

    // Tentukan list provider yang akan di-search
    const providerList: string[] = providers
      ? (Array.isArray(providers) ? providers : [providers])
      : ['assistcard', 'bcainsurance', 'zurich', 'great_eastern', 'oona'];

    console.log('[INSURANCE SEARCH] Providers:', providerList, '| Area:', destination_area);

    // Search semua provider secara parallel
    const searchPromises = providerList.map(async (provider) => {
      const area = pickBestArea(provider, destination_area || (international ? 'Asia' : 'Domestic'));
      const payload = {
        date_start,
        date_end,
        pax,
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
        const result = await insuranceAPI.getAvailability(payload);
        // result bisa berupa object { [provider]: [...] } atau array langsung
        const products = result?.[provider] || (Array.isArray(result) ? result : []);
        return { provider, products, area, error: null };
      } catch (e: any) {
        console.error(`[INSURANCE SEARCH] Provider ${provider} error:`, e.message);
        return { provider, products: [], area, error: e.message };
      }
    });

    const results = await Promise.all(searchPromises);

    // Gabungkan semua hasil
    const allProducts: any[] = [];
    const providerResults: Record<string, any> = {};
    const errors: Record<string, string> = {};

    for (const r of results) {
      providerResults[r.provider] = r.products;
      if (r.error) errors[r.provider] = r.error;
      // Tandai produk dengan info provider
      r.products.forEach((p: any) => {
        allProducts.push({ ...p, _searched_area: r.area });
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        all: allProducts,
        byProvider: providerResults,
        errors,
        meta: { date_start, date_end, pax, destination_area, international },
      },
    });

  } catch (e: any) {
    console.error('[INSURANCE SEARCH] Fatal error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}