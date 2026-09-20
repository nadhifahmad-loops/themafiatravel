import { NextRequest, NextResponse } from 'next/server';
import { hotelAPI } from '@/lib/orbis';
import { handleOrbisError, hotelDetailSchema, validateBody } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Orbis response tidak punya skema ketat
type OrbisAny = Record<string, any>;

// FIX: get_details juga mengagregasi banyak vendor (lihat doc 3.5) dan bisa
// lambat, sama seperti search — samakan dengan hotel/book & train/book.
export const maxDuration = 90;

// ── Response cleanup: strip Orbis internal fields yang tidak perlu ditampilkan ──
// Field seperti service_charges, service_charge_summary, nightly_prices detail
// adalah data komisi/fee internal agent — TIDAK boleh dilihat user frontend.
function cleanHotelCode(hotelCode: OrbisAny): OrbisAny {
  if (!hotelCode || typeof hotelCode !== 'object') return hotelCode;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { near_by_facility, id2, compliance_text, prices: _prices, ...clean } = hotelCode;
  return clean;
}

function cleanPrice(price: OrbisAny): OrbisAny {
  if (!price || typeof price !== 'object') return price;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nightly_prices: _nightly, ...rest } = price;
  // Strip nightly_prices detail (service_charges, service_charge_summary)
  // tapi pertahankan struktur rooms yang dibutuhkan frontend
  return rest;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body tidak valid.' }, { status: 400 });
    }

    // Validasi — hotel_id wajib untuk get_details (doc §3.5.1.1/§3.5.2.1)
    const validation = validateBody(hotelDetailSchema, body);
    if (!validation.success) return validation.response;
    const v = validation.data;

    if (!v.hotel_id) {
      return NextResponse.json({ error: 'hotel_id wajib diisi untuk detail hotel' }, { status: 400 });
    }

    // FIX: semua field harus sesuai doc §3.5.1.1 — khususnya Number() conversion
    // untuk adult, child, room (type: int). child_ages dikirim sebagai array [x,y,z].
    const payload = {
      checkin_date: v.checkin_date,
      checkout_date: v.checkout_date,
      destination_id: v.destination_id,
      hotel_id: v.hotel_id,
      search_name: v.search_name ?? '',
      adult: Number(v.adult) || 2,
      child: Number(v.child) || 0,
      child_ages: v.child_ages?.map((n: string | number) => Number(n)) ?? [],
      room: Number(v.room) || 1,
      nationality: v.nationality ?? 'ID',
    };

    console.log('[HOTEL DETAIL] Payload ke Orbis:', payload);

    const raw: OrbisAny = await hotelAPI.getDetails(payload);

    // Cleanup response — strip internal Orbis fields
    const data = {
      ...raw,
      hotel_code: cleanHotelCode(raw?.hotel_code),
      prices: Array.isArray(raw?.prices)
        ? raw.prices.map(cleanPrice)
        : raw?.prices,
    };

    return NextResponse.json({ success: true, data });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- catch block perlu akses message
  } catch (e: any) {
    // FIX: sama seperti hotel/search — jangan gagal total kalau salah satu
    // vendor untuk hotel ini sedang unavailable. `prices` harus tetap array
    // kosong (bukan {}) karena frontend ([hotelId]/page.tsx) memperlakukan
    // data.prices sebagai array (`data?.prices || []`, lalu di-map/filter) —
    // objek kosong {} lolos dari fallback `||` karena truthy dan akan
    // menyebabkan error runtime saat dipanggil .map()/.filter().
    return handleOrbisError(e, 'HOTEL DETAIL', { prices: [], hotel_code: {}, prices_group_name: {} });
  }
}