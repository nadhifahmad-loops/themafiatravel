import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type OrbisProvisionError = Error & {
  orbisCode?: number;
  orbisResponse?: unknown;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  return fallback;
};

// Error Orbis yang berarti "sesi/cache kadaluwarsa, harus cari ulang" — bukan bug kode kita
const isCacheMiss = (pe: OrbisProvisionError) =>
  pe.orbisCode === 4021 || pe.orbisCode === 4011 || pe.orbisCode === 4014 || pe.orbisCode === 4023;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json() as {
      hotel_code?: string;
      vendor_price_code?: string;
      provider?: string;
      search_data?: {
        checkin_date?: string;
        checkout_date?: string;
        destination_id?: string;
        adult?: number;
        child?: number;
        child_ages?: number[];
        room?: number;
        nationality?: string;
      };
    };

    const { hotel_code, vendor_price_code, provider, search_data } = body;

    if (!hotel_code || hotel_code === 'undefined') {
      return NextResponse.json({ error: 'hotel_code tidak boleh kosong' }, { status: 400 });
    }
    if (!vendor_price_code || !vendor_price_code.trim()) {
      return NextResponse.json({ error: 'price_code tidak boleh kosong' }, { status: 400 });
    }
    // CATATAN PENTING: walau dokumentasi 3.7.1.1 cuma menyebut hotel_code + price_code,
    // pengujian nyata membuktikan Orbis MEWAJIBKAN field "provider" — tanpa itu server
    // Orbis balas 500 "Internal server error, 'provider'" (KeyError literal di sisi mereka).
    // Jadi provider WAJIB dikirim, bukan opsional.
    if (!provider || !provider.trim()) {
      return NextResponse.json({ error: 'provider tidak boleh kosong (wajib untuk provision)' }, { status: 400 });
    }

    const priceCode = vendor_price_code.trim();

    const respondFromOrbisError = (pe: OrbisProvisionError, code: string, prov: string) => {
      if (pe.orbisCode === 4006 && pe.orbisResponse) {
        // Respons provision membawa provider INTERNAL (mis. "mgjarvis") — pakai itu
        // supaya re-provision di checkout juga memakai kode internal yang benar.
        const internalProvider = (pe.orbisResponse as any)?.provider || prov;
        return NextResponse.json({ success: true, data: pe.orbisResponse, priceChanged: true, priceChangedMsg: 'Harga kamar telah berubah.', selectedProvider: internalProvider, selectedPriceCode: code });
      }
      if (pe.orbisCode === 4003 || pe.orbisCode === 1002) {
        return NextResponse.json({ error: 'Sesi hotel telah kedaluwarsa. Silakan cari kamar kembali.' }, { status: 410 });
      }
      return null;
    };

    // FIX (dikonfirmasi live): provision Orbis baru berhasil jika get_cancellation_policy
    // untuk price_code yang sama dipanggil TERLEBIH DAHULU. Tanpa itu vendor membalas
    // 4021 "No Match Room ... in Cache" walau price_code segar dari get_details.
    // gcp berperan "mendaftarkan"/memvalidasi kamar ke cache vendor sebelum provision.
    // Error gcp bersifat non-fatal: provision tetap dicoba.
    //
    // Selain itu, respons gcp memuat provider INTERNAL (mis. "mgjarvis") yang WAJIB
    // dipakai sebagai field provider provision. Nama tampilan dari get_details
    // (mis. "MG Bedbank") TIDAK cocok dengan cache vendor → provision dibalas 4021.
    const warmAndProvision = async (code: string, prov: string) => {
      let internalProvider = prov;
      try {
        const gcpRes: any = await hotelAPI.getCancellationPolicy(String(hotel_code), code);
        if (gcpRes?.provider) internalProvider = String(gcpRes.provider);
      } catch (warmErr) {
        console.warn('[HOTEL PROVISION] gcp warmup gagal (non-fatal):', getErrorMessage(warmErr, '').slice(0, 120));
      }
      const data = await hotelAPI.provision(String(hotel_code), code, internalProvider, true);
      return { data, provider: internalProvider };
    };

    // ── ATTEMPT 1: pakai price_code dari frontend (paling segar — didapat dari
    // halaman detail hotel yang baru saja di-load user) + provider (wajib). ──
    console.log(`[HOTEL PROVISION] Attempt 1: price_code="${priceCode}" provider="${provider}"`);
    try {
      const res = await warmAndProvision(priceCode, provider);
      console.log('[HOTEL PROVISION] SUCCESS on attempt 1!');
      return NextResponse.json({ success: true, data: res.data, priceChanged: false, selectedProvider: res.provider, selectedPriceCode: priceCode });
    } catch (err) {
      const pe = err as OrbisProvisionError;
      const handled = respondFromOrbisError(pe, priceCode, provider);
      if (handled) return handled;
      console.warn(`[HOTEL PROVISION] Attempt 1 failed: code=${pe.orbisCode} | ${String(pe.orbisResponse ?? pe.message).slice(0, 150)}`);

      if (!isCacheMiss(pe)) {
        // Error di luar "cache/room tidak match" — tidak ada gunanya retry dengan code baru
        return NextResponse.json({
          success: false,
          error: 'Kamar ini belum bisa diverifikasi saat ini. Harga atau ketersediaan mungkin sudah berubah. Silakan pilih kamar lain atau coba beberapa saat lagi.',
          fallback: false,
        }, { status: 409 });
      }
    }

    // ── ATTEMPT 2 (fallback): price_code dari Attempt 1 sudah tidak match cache
    // vendor (kemungkinan basi/kadaluwarsa). Ambil price_code BENAR-BENAR BARU
    // lewat SATU kali get_details, lalu langsung provision — tanpa jeda/panggilan
    // lain di antaranya supaya cache room yang baru dibuat tidak keburu basi lagi. ──
    if (!search_data?.checkin_date || !search_data?.checkout_date || !search_data?.destination_id) {
      return NextResponse.json({
        success: false,
        error: 'Kamar ini belum bisa diverifikasi saat ini. Harga atau ketersediaan mungkin sudah berubah. Silakan pilih kamar lain atau coba beberapa saat lagi.',
        fallback: false,
      }, { status: 409 });
    }

    try {
      console.log('[HOTEL PROVISION] Attempt 2: refetch get_details untuk price_code segar...');
      const detailData = await hotelAPI.getDetails({
        checkin_date: search_data.checkin_date,
        checkout_date: search_data.checkout_date,
        destination_id: search_data.destination_id,
        hotel_id: String(hotel_code),
        search_name: '',
        adult: search_data.adult ?? 2,
        child: search_data.child ?? 0,
        child_ages: search_data.child_ages ?? [],
        room: search_data.room ?? 1,
        nationality: search_data.nationality ?? 'ID',
      });

      const rawPrices = detailData?.prices;
      const priceList: any[] = Array.isArray(rawPrices)
        ? rawPrices
        : rawPrices && typeof rawPrices === 'object'
          ? Object.values(rawPrices)
          : [];

      // Cari entri dengan provider yang sama persis; kalau tidak ada, pakai yang pertama.
      const targetProvider = provider.trim().toLowerCase();
      const match = priceList.find((p: any) => String(p?.provider ?? '').toLowerCase() === targetProvider) ?? priceList[0];
      const freshCode = match?.price_code != null ? String(match.price_code) : '';
      const freshProvider = match?.provider ? String(match.provider) : provider;

      if (!freshCode) {
        console.warn('[HOTEL PROVISION] Attempt 2: tidak ada price_code baru dari get_details — kamar sudah tidak tersedia.');
        return NextResponse.json({
          success: false,
          error: 'Kamar ini sudah tidak tersedia. Silakan pilih kamar lain.',
          fallback: false,
        }, { status: 409 });
      }

      console.log(`[HOTEL PROVISION] Attempt 2: price_code segar="${freshCode}" provider="${freshProvider}"`);
      try {
        const data2 = await warmAndProvision(freshCode, freshProvider);
        console.log('[HOTEL PROVISION] SUCCESS on attempt 2 (fresh price_code)!');
        return NextResponse.json({ success: true, data: data2.data, priceChanged: true, priceChangedMsg: 'Harga kamar diperbarui.', selectedProvider: data2.provider, selectedPriceCode: freshCode });
      } catch (err2) {
        const pe2 = err2 as OrbisProvisionError;
        const handled2 = respondFromOrbisError(pe2, freshCode, freshProvider);
        if (handled2) return handled2;
        console.warn(`[HOTEL PROVISION] Attempt 2 failed: code=${pe2.orbisCode} | ${String(pe2.orbisResponse ?? pe2.message).slice(0, 150)}`);
      }
    } catch (fetchErr) {
      console.warn('[HOTEL PROVISION] Attempt 2: get_details gagal:', getErrorMessage(fetchErr, ''));
    }

    console.warn('[HOTEL PROVISION] Semua percobaan gagal — kamar tidak tersedia di provider');
    return NextResponse.json({
      success: false,
      error: 'Kamar ini belum bisa diverifikasi saat ini. Harga atau ketersediaan mungkin sudah berubah. Silakan pilih kamar lain atau coba beberapa saat lagi.',
      fallback: false,
    }, { status: 409 });
  } catch (error) {
    console.error('[HOTEL PROVISION ERROR]', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Gagal memverifikasi ketersediaan kamar') }, { status: 500 });
  }
}