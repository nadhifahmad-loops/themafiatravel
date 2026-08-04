import { prisma } from '@/lib/prisma';
import type { OrbisError, OrbisStruct } from '@/lib/orbis-types';

// =========================
// 🔐 CONFIG
// =========================
const ORBIS_URL = process.env.ORBISWAY_BASE_URL!;
const ORBIS_USER = process.env.ORBISWAY_USER!;
const ORBIS_PASSWORD = process.env.ORBISWAY_PASSWORD!;
const ORBIS_API_KEY = process.env.ORBISWAY_API_KEY!;

// =========================
// ⚡ MEMORY CACHE & LOCK
// =========================
let memorySignature: string | null = null;
let memoryExpiredAt = 0;
let fetchingSignature: Promise<string> | null = null; // Kunci Promise untuk cegah Race Condition

// =========================
// 🗺️ ERROR MAP
// =========================
const ORBIS_ERROR_MESSAGES: Record<number, string> = {
  1001: 'Permintaan tidak valid',
  1002: 'Sesi login maskapai habis',
  4006: 'Harga telah berubah',
  4011: 'Sesi pencarian expired, silakan cari ulang',
  4014: 'Jadwal sudah terkunci',
  4021: 'Harga tidak tersedia, silakan pilih kamar lain',
  4023: 'Data tidak ditemukan',
  9999: 'Sistem maskapai sedang gangguan',
};

function getOrbisErrorMessage(
  errorCode: number,
  rawMsg: string
): string {
  return (
    ORBIS_ERROR_MESSAGES[errorCode] ||
    rawMsg ||
    `Terjadi kesalahan sistem (${errorCode})`
  );
}

// =========================
// ⏱️ FETCH TIMEOUT
// =========================
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = 90000
) {
  const controller = new AbortController();

  const id = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });

    return response;
  } finally {
    clearTimeout(id);
  }
}

// =========================
// 🔑 GET SIGNATURE
// =========================
export async function getOrbisSignature(
  forceRefresh = false
): Promise<string> {
  const now = Date.now();

  // =========================
  // ⚡ 1. CEK MEMORY CACHE
  // =========================
  if (!forceRefresh && memorySignature && now < memoryExpiredAt) {
    return memorySignature;
  }

  // =========================
  // ⏳ 2. TUNGGU JIKA ADA PROSES FETCHING BERJALAN
  // =========================
  if (!forceRefresh && fetchingSignature) {
    return fetchingSignature;
  }

  // =========================
  // 🔒 3. LOCK PROSES KE DALAM PROMISE
  // =========================
  fetchingSignature = (async () => {
    // 🗄️ Cek Database Cache
    if (!forceRefresh) {
      const dbSession = await prisma.orbisSession.findFirst({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (dbSession) {
        memorySignature = dbSession.signature;
        memoryExpiredAt = dbSession.expiresAt.getTime();
        return dbSession.signature;
      }
    }

    console.log('[ORBIS] Requesting new signature...');
    
    // Pengecekan .env variables untuk memastikan kredensial masuk
    console.log('[ORBIS CONFIG CHECK]', {
      url: ORBIS_URL ? 'Terisi' : 'KOSONG',
      user: ORBIS_USER ? 'Terisi' : 'KOSONG',
      pass: ORBIS_PASSWORD ? 'Terisi' : 'KOSONG',
      key: ORBIS_API_KEY ? 'Terisi' : 'KOSONG'
    });

    let res: Response;

    try {
      res = await fetchWithTimeout(
        `${ORBIS_URL}/session`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            // User-Agent ini penting untuk melewati proteksi firewall/Cloudflare maskapai
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            action: 'signin',
          },
          body: JSON.stringify({
            user: ORBIS_USER,
            password: ORBIS_PASSWORD,
            api_key: ORBIS_API_KEY,
          }),
        },
        15000
      );
    } catch (err) {
      console.error('[ORBIS LOGIN ERROR]', err);
      throw new Error('Tidak dapat terhubung ke sistem maskapai');
    }

    if (!res.ok) {
      // Tangkap pesan asli dari server jika terjadi error 403 atau lainnya
      const errorText = await res.text();
      console.error('[ORBIS RAW ERROR RESPONSE]:', errorText);
      throw new Error(`Sistem maskapai error (${res.status})`);
    }

    const raw = await res.json();
    const data = raw.result || raw;

    if (data.error_code !== 0) {
      throw new Error(data.error_msg || 'Login ORBIS gagal');
    }

    const newSignature = data.response?.signature;

    if (!newSignature) {
      throw new Error('Signature ORBIS tidak ditemukan');
    }

    console.log('[Orbis] Signature refreshed successfully');

    // ⏰ Set Expiry 20 Menit (sesuai API spec: signature valid for 20 minutes)
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 20);

    // ⚡ Save Memory
    memorySignature = newSignature;
    memoryExpiredAt = expiryDate.getTime();

    // 🗄️ Save Database
    await prisma.orbisSession.create({
      data: {
        signature: newSignature,
        expiresAt: expiryDate,
      },
    });

    // Cleanup old session
    await prisma.orbisSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return newSignature;
  })();

  try {
    const signature = await fetchingSignature;
    return signature;
  } finally {
    // 🔓 Lepaskan lock setelah selesai agar token bisa di-refresh nanti
    fetchingSignature = null;
  }
}

// =========================
// 🌐 CORE REQUEST
// =========================
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- respons Orbisway tidak memiliki skema ketat; caller mengetik ulang per penggunaan
export async function orbisRequest<T = any>(
  endpoint: string,
  action: string,
  body: object = {},
  timeoutMs = 60000,
  maxRetries = 3
): Promise<T> {
  let signature = await getOrbisSignature();

  const doFetch = async (currentSignature: string) => {
    let res: Response;

    try {
      res = await fetchWithTimeout(
        `${ORBIS_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            action,
            signature: currentSignature,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: JSON.stringify(body),
        },
        timeoutMs
      );
    } catch (err) {
      console.error(`[ORBIS FETCH ERROR] ${action}`, err);
      throw new Error('Koneksi ke sistem maskapai terputus');
    }

    if (res.status === 502 || res.status === 503) {
      throw new Error('Sistem maskapai sedang sibuk');
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} pada ${action}`);
    }

    return res.json();
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let json = await doFetch(signature);
      let result = json.result || json;

      // Auto Refresh Token
      if (result.error_code === 1002 || result.error_code === 4003) {
        console.warn(`[ORBIS] Signature expired (${result.error_code}), refreshing...`);
        signature = await getOrbisSignature(true);
        json = await doFetch(signature);
        result = json.result || json;
      }

      if (result.error_code !== 0) {
        const responseKeys = result.response && typeof result.response === 'object'
          ? Object.keys(result.response).join(',')
          : String(result.response ?? 'null');
        console.error(
          `[ORBIS ERROR] action=${action}`,
          `code=${result.error_code}`,
          `msg=${JSON.stringify(result.error_msg)}`,
          `response_keys=${responseKeys}`
        );
        const friendlyMsg = getOrbisErrorMessage(result.error_code, result.error_msg);
        const err = new Error(friendlyMsg) as OrbisError;
        err.orbisCode = result.error_code;
        err.orbisResponse = result.response;
        throw err;
      }

      return result.response;
    } catch (err: unknown) {
      const orbisErr = err as OrbisError;
      lastError = orbisErr;
      const isRetryable = !orbisErr.orbisCode && (
        orbisErr.message?.includes('terputus') ||
        orbisErr.message?.includes('sibuk') ||
        orbisErr.message?.includes('Timeout') ||
        orbisErr.message?.includes('abort')
      );

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[ORBIS] Retry ${attempt}/${maxRetries} for ${action} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

// =========================
// ✈️ FLIGHT API
// =========================
export interface OrbisSchedule {
  provider: string;
  journeys: {
    segments: {
      segment_code: string;
      fare_code: string;
    }[];
  }[];
}

export interface OrbisPassengerIdentity {
  identity_type: string;
  identity_number: string;
  identity_expdate: string;
  identity_country_of_issued_code: string;
}

export interface OrbisPassenger {
  passenger_number: number;
  type: string;
  first_name: string;
  last_name: string;
  title: string;
  birth_date: string;
  nationality: string;
  identity?: OrbisPassengerIdentity;
}

export const flightAPI = {
  search: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'search', {
      ...params,
      cabin_class: params.cabin_class || 'Y',
      carrier_codes: params.carrier_codes || [],
      promo_codes: params.promo_codes || [],
      is_combo_price: params.is_combo_price ?? false,
    }),

  getPriceItinerary: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'get_price_itinerary', params),

  sellJourneys: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'sell_journeys', params),

  updateContacts: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'update_contacts', params),

  updatePassengers: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'update_passengers', params),

  getSeatAvailability: () =>
    orbisRequest('/booking/airline', 'get_seat_availability', {}),

  getSsrAvailability: () =>
    orbisRequest('/booking/airline', 'get_ssr_availability', {}),

  getPostSsrAvailability: (params?: { order_number?: string; schedules?: OrbisStruct[] }) =>
    orbisRequest('/booking/airline', 'get_post_ssr_availability', params || {}),

  assignSeats: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'assign_seats', params),

  sellSsrs: (params: {
    sell_ssrs_request: Array<{
      provider: string;
      sell_ssrs: Array<{
        journey_code: string;
        availability_type: string;
        passengers: Array<{ passenger_number: number; ssr_code: string }>;
      }>;
    }>;
  }) => orbisRequest('/booking/airline', 'sell_ssrs', params),

  sellPostSsrs: (params: {
    order_number: string;
    sell_ssrs_request: Array<{
      pnr: string;
      sell_ssrs: Array<{
        journey_code: string;
        availability_type: string;
        passengers: Array<{ passenger_number: number; ssr_code: string }>;
      }>;
    }>;
  }) => orbisRequest('/booking/airline', 'sell_post_ssrs', params),

  commitBooking: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'commit_booking', params),

  getBooking: (order_number: string) =>
    orbisRequest('/booking/airline', 'get_booking', { order_number }),

  issued: (order_number: string) =>
    orbisRequest('/booking/airline', 'issued', { order_number }),

  cancel: (params: { order_number: string; provider_bookings?: OrbisStruct[] }) =>
    orbisRequest('/booking/airline', 'cancel', params),

  cancelVoid: (order_number: string) =>
    orbisRequest('/booking/airline', 'cancel', { order_number }),

  cancelRefund: (params: { order_number: string; provider_bookings: OrbisStruct[] }) => {
    console.log('[ORBIS CANCEL REFUND] Full request body:', JSON.stringify(params, null, 2));
    return orbisRequest('/booking/airline', 'cancel', params);
  },
};

// =========================
// 🚆 TRAIN API (KAI RODEXTRIP)
// =========================
export const trainAPI = {
  search: (params: {
    journey_list: Array<{ origin: string; destination: string; departure_date: string }>;
    direction: 'OW' | 'RT';
    adult: number;
    infant: number;
    provider: string;
  }) => orbisRequest('/booking/train', 'search', params),

  getDestinations: () =>
    orbisRequest('/booking/train', 'get_destination', { provider_type: 'train' }),

  getSeatAvailability: (params: { fare_codes: string[]; provider: string }) =>
    orbisRequest('/booking/train', 'get_seat_availability', params),

  assignSeats: (params: OrbisStruct) =>
    orbisRequest('/booking/train', 'assign_seats', params),

  commitBooking: (params: {
    contacts: OrbisStruct[];
    passengers: OrbisStruct[];
    schedules: OrbisStruct[];
    booker: OrbisStruct;
    force_issued?: boolean;
  }) => orbisRequest('/booking/train', 'commit_booking', params),

  getBooking: (order_number: string) =>
    orbisRequest('/booking/train', 'get_booking', { order_number }),

  issued: (order_number: string) =>
    orbisRequest('/booking/train', 'issued', { order_number }),

  cancelBooking: (order_number: string) =>
    orbisRequest('/booking/train', 'cancel_booking', { order_number }),

  getPrintout: (order_number: string) =>
    orbisRequest('/booking/train', 'get_printout', {
      order_number,
      mode: 'ticket',
      provider_type: 'train',
    }),

  getBalance: () => orbisRequest('/booking/train', 'get_balance', {}),
};

// =========================
// 🏨 HOTEL API
// Semua action hotel menggunakan endpoint /booking/hotel
// Action names sesuai dokumentasi API Section 3.x
// =========================
export const hotelAPI = {
  // 3.4 Search Hotel Availability
  // FIX: timeout 90 detik – hotel search aggregates banyak vendor, bisa lambat
  search: (params: OrbisStruct) =>
    orbisRequest('/booking/hotel', 'search', params, 90000),

  // 3.5 Hotel Search Detail (action header: get_details)
  // FIX: timeout 90 detik – sama seperti search
  getDetails: (params: OrbisStruct) =>
    orbisRequest('/booking/hotel', 'get_details', params, 90000),

  // 3.6 Get Cancellation Policy
  getCancellationPolicy: (hotel_code: string, price_code: string) =>
    orbisRequest('/booking/hotel', 'get_cancellation_policy', { hotel_code, price_code }),

  // 3.7 Provision – harga & ketersediaan terbaru (error 4006 = harga berubah, data tetap ada)
  // price_code = string dari get_details (format "{int}~{float}", server Orbis melakukan .split("~"))
  // Dikonfirmasi live (debug hotel provision):
  //  - Field "provider" WAJIB dikirim. Tanpa provider Orbis balas 500 "Internal server error, 'provider'"
  //    (KeyError literal di sisi mereka) — walau tidak tercantum di dokumentasi 3.7.1.1.
  //  - Wajib memanggil get_cancellation_policy untuk price_code yang sama SEBELUM provision.
  //    Tanpa gcp, provision selalu dibalas 4021 "No Match Room ... in Cache" (kamar belum
  //    "terdaftar" di cache vendor). Dengan gcp → provision berhasil (sudah diverifikasi).
  //  - Kode price_code dari hasil search (format vendor asli, mis. "RM_1511_0~Flexi~RO~False"
  //    untuk MG Bedbank) TIDAK bisa dipakai provision — bagian int() gagal parse.
  //  - MG Bedbank (mgjarvis) butuh provider INTERNAL ("mgjarvis") — bukan nama tampilan
  //    ("MG Bedbank"). Respons get_cancellation_policy memuat provider internal tersebut;
  //    pakai itu sebagai field provider provision, jika tidak → 4021 No Match Room.
  // includeProvider dipakai agar provider selalu ikut terkirim (wajib untuk provision).
  provision: (hotel_code: string, price_code: string, provider?: string, includeProvider = true) =>
    orbisRequest('/booking/hotel', 'provision', {
        hotel_code: String(hotel_code),
        price_code: String(price_code),
        ...(includeProvider && provider ? { provider: String(provider) } : {}),
    }),

  // 3.8 Create Booking (action header: booked)
  // Dikonfirmasi langsung ke server Orbis: field yang dibaca server adalah `price_codes`
  // (PLURAL — walau dokumen 3.8.1.1 menulis `price_code`; tanpa field ini server balas
  // KeyError 'price_codes'). Nilainya INTEGER — bagian int dari price_code get_details
  // (format "{int}~{float}"); dokumen menulis contoh `"price_code": "1"`.
  // search_data/passenger/contact/booker/special_request dikirim sebagai JSON string
  // (server melakukan json.loads; objek mentah memicu error "must be str ... not bool").
  createBooking: (params: OrbisStruct & {
    hotel_code: string;
    price_code?: string;
    price_codes?: string | number;
    provider?: string;
    special_request?: string;
  }) => {
    const { price_code, price_codes, search_data, passenger, contact, booker, special_request, ...rest } = params;
    const rawCode = price_codes || String(price_code || '');
    const intCode = String(rawCode).split('~')[0];
    const jsonString = (v: unknown) => JSON.stringify(v);
    return orbisRequest('/booking/hotel', 'booked', {
      ...rest,
      price_codes: intCode,
      ...(search_data !== undefined ? { search_data: jsonString(search_data) } : {}),
      ...(passenger !== undefined ? { passenger: jsonString(passenger) } : {}),
      ...(contact !== undefined ? { contact: jsonString(contact) } : {}),
      ...(booker !== undefined ? { booker: jsonString(booker) } : {}),
      ...(special_request !== undefined ? { special_request: jsonString(special_request) } : {}),
    });
  },

  // 3.9 Check Booking Status (action header: check_booking_status)
  getBooking: (order_number: string, issued_name: string, provider: string) =>
    orbisRequest('/booking/hotel', 'check_booking_status', { order_number, issued_name, provider }),

  // 3.10 Check Refund Amount
  checkRefundAmount: (order_number: string, issued_name: string, provider: string) =>
    orbisRequest('/booking/hotel', 'check_refund_amount', { order_number, issued_name, provider }),

  // 3.11 Cancel Booking
  cancelBooking: (order_number: string, issued_name: string, provider: string) =>
    orbisRequest('/booking/hotel', 'cancel_booking', { order_number, issued_name, provider }),
};

// =========================
// 🛡️ INSURANCE API
// =========================
export const insuranceAPI = {
  getConfig: () =>
    orbisRequest('/booking/insurance', 'get_config', {}),

  getAvailability: (params: {
    date_start: string;
    date_end: string;
    pax: number;
    destination?: string;
    is_senior?: boolean;
    international?: boolean;
    destination_area: string;
    type: string;
    provider: string;
    product_type: string;
    carrier_code: string;
    age?: string;
  }) => orbisRequest('/booking/insurance', 'get_availability', params),

  sellInsurance: (params: {
    data: { product_code: string; provider: string; carrier_code: string };
    pax: number;
    package: number;
    age: string[];
    age_type: 'age' | 'birth_date';
    adult: number;
    child?: number;
    infant?: number;
  }) => orbisRequest('/booking/insurance', 'sell_insurance', params),

  commitBooking: (params: {
    contacts: OrbisStruct[];
    passengers: OrbisStruct[];
    booker: OrbisStruct;
    provider: string;
    carrier_code: string;
    voucher?: object;
  }) => orbisRequest('/booking/insurance', 'commit_booking', params),

  issued: (params: { order_number: string; voucher?: object; agent_payment_method?: string; member?: boolean; use_point?: boolean }) =>
    orbisRequest('/booking/insurance', 'issued', { agent_payment_method: 'balance', member: false, use_point: false, voucher: {}, ...params }),

  getBooking: (order_number: string, force_sync = false) =>
    orbisRequest('/booking/insurance', 'get_booking', { order_number, force_sync }),

  cancelBooking: (order_number: string) =>
    orbisRequest('/booking/insurance', 'cancel_booking', { order_number }),

  getBalance: () =>
    orbisRequest('/booking/insurance', 'get_balance', {}),
};