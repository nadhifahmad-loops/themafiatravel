import { hotelAPI } from '@/lib/orbis';

export interface VerifyHotelPriceInput {
  hotel_code: string;
  price_code: string;
  provider: string;
  search_data?: {
    checkin_date?: string;
    checkout_date?: string;
    destination_id?: string;
    hotel_id?: string;
    adult?: number | string;
    child?: number | string;
    child_ages?: (number | string)[];
    room?: number | string;
    nationality?: string;
  } | null;
}

export interface HotelPriceResult {
  priceCode: string;
  priceTotal: number;
  provider: string;
  priceChanged?: boolean;
}

export type HotelPriceErrorCode = 'SESSION_EXPIRED' | 'UNAVAILABLE' | 'UNVERIFIABLE';

export class HotelPriceError extends Error {
  priceError: HotelPriceErrorCode;
  constructor(code: HotelPriceErrorCode, message: string) {
    super(message);
    this.name = 'HotelPriceError';
    this.priceError = code;
  }
}

const orbisCodeOf = (err: unknown): number | undefined =>
  (err as { orbisCode?: number })?.orbisCode;

const isCacheMissCode = (code?: number) =>
  code === 4021 || code === 4011 || code === 4014 || code === 4023;

const isSessionExpiredCode = (code?: number) => code === 4003 || code === 1002;

// gcp berperan "mendaftarkan" kamar ke cache vendor; tanpa itu provision dibalas
// 4021 "No Match Room ... in Cache". Respons gcp juga memuat provider INTERNAL
// (mis. "mgjarvis") yang wajib dipakai sebagai field provider provision.
async function warmAndProvision(hotel_code: string, code: string, provider: string) {
  let internalProvider = provider;
  try {
    const gcpRes = (await hotelAPI.getCancellationPolicy(hotel_code, code)) as { provider?: string };
    if (gcpRes?.provider) internalProvider = String(gcpRes.provider);
  } catch {
    // non-fatal: warmup gagal, provision tetap dicoba
  }
  const data = await hotelAPI.provision(hotel_code, code, internalProvider, true);
  return { data, provider: internalProvider };
}

async function provisionOnce(hotel_code: string, code: string, provider: string): Promise<HotelPriceResult> {
  try {
    const { data, provider: effectiveProvider } = await warmAndProvision(hotel_code, code, provider);
    const priceTotal = Number(data?.price_total);
    if (!Number.isFinite(priceTotal) || priceTotal <= 0) {
      throw new HotelPriceError('UNVERIFIABLE', 'Harga kamar tidak valid dari Orbis.');
    }
    return { priceCode: code, priceTotal, provider: effectiveProvider };
  } catch (err) {
    if (err instanceof HotelPriceError) throw err;
    const codeNumber = orbisCodeOf(err);
    if (codeNumber === 4006) {
      // 4006: harga berubah, respons masih membawa data harga terbaru.
      const res = (err as { orbisResponse?: { price_total?: number; price_code?: string; provider?: string } })?.orbisResponse;
      const priceTotal = Number(res?.price_total);
      if (Number.isFinite(priceTotal) && priceTotal > 0) {
        const freshCode = res?.price_code != null ? String(res.price_code) : code;
        const freshProvider = res?.provider ? String(res.provider) : provider;
        return { priceCode: freshCode, priceTotal, provider: freshProvider, priceChanged: true };
      }
      throw new HotelPriceError('UNVERIFIABLE', 'Harga kamar berubah dan tidak dapat diverifikasi.');
    }
    if (isSessionExpiredCode(codeNumber)) {
      throw new HotelPriceError('SESSION_EXPIRED', 'Sesi pencarian hotel telah kedaluwarsa. Silakan cari kamar kembali.');
    }
    if (isCacheMissCode(codeNumber)) {
      throw new HotelPriceError('UNAVAILABLE', 'Kamar belum tersedia di cache vendor.');
    }
    throw new HotelPriceError('UNVERIFIABLE', 'Provision kamar gagal.');
  }
}

export async function verifyHotelPrice(input: VerifyHotelPriceInput): Promise<HotelPriceResult> {
  const { hotel_code, price_code, provider, search_data } = input;

  try {
    return await provisionOnce(hotel_code, price_code, provider);
  } catch (err) {
    if (!(err instanceof HotelPriceError) || err.priceError !== 'UNAVAILABLE') throw err;
  }

  // Fallback: price_code basi → ambil price_code benar-benar baru lewat satu kali
  // get_details, lalu langsung provision (tanpa panggilan lain di antaranya).
  if (!search_data?.checkin_date || !search_data?.checkout_date || !search_data?.destination_id) {
    throw new HotelPriceError('UNAVAILABLE', 'Kamar tidak dapat diverifikasi ulang. Silakan cari kamar kembali.');
  }

  try {
    const detailData = (await hotelAPI.getDetails({
      checkin_date: search_data.checkin_date,
      checkout_date: search_data.checkout_date,
      destination_id: search_data.destination_id,
      hotel_id: String(hotel_code),
      search_name: '',
      adult: Number(search_data.adult ?? 2),
      child: Number(search_data.child ?? 0),
      child_ages: search_data.child_ages ?? [],
      room: Number(search_data.room ?? 1),
      nationality: search_data.nationality ?? 'ID',
    })) as { prices?: unknown };

    const rawPrices = detailData?.prices;
    type PriceEntry = { provider?: unknown; price_code?: unknown };
    const priceList: PriceEntry[] = Array.isArray(rawPrices)
      ? (rawPrices as PriceEntry[])
      : rawPrices && typeof rawPrices === 'object'
        ? Object.values(rawPrices as PriceEntry[])
        : [];
    const targetProvider = (provider || '').trim().toLowerCase();
    const match = priceList.find((p) => String(p?.provider ?? '').toLowerCase() === targetProvider) ?? priceList[0];
    const freshCode = match?.price_code != null ? String(match.price_code) : '';
    const freshProvider = match?.provider ? String(match.provider) : provider;

    if (!freshCode) {
      throw new HotelPriceError('UNAVAILABLE', 'Kamar sudah tidak tersedia. Silakan pilih kamar lain.');
    }
    return await provisionOnce(hotel_code, freshCode, freshProvider);
  } catch (err) {
    if (err instanceof HotelPriceError) throw err;
    throw new HotelPriceError('UNVERIFIABLE', 'Gagal memperbarui harga kamar.');
  }
}