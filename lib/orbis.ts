import { prisma } from '@/lib/prisma';

// =========================
// 🔐 CONFIG
// =========================
const ORBIS_URL = process.env.ORBISWAY_BASE_URL!;
const ORBIS_USER = process.env.ORBISWAY_USER!;
const ORBIS_PASSWORD = process.env.ORBISWAY_PASSWORD!;
const ORBIS_API_KEY = process.env.ORBISWAY_API_KEY!;

// =========================
// ⚡ MEMORY CACHE
// =========================
let memorySignature: string | null = null;
let memoryExpiredAt = 0;

// =========================
// 🗺️ ERROR MAP
// =========================
const ORBIS_ERROR_MESSAGES: Record<number, string> = {
  1001: 'Permintaan tidak valid',
  1002: 'Sesi login maskapai habis',
  4011: 'Sesi pencarian expired, silakan cari ulang',
  4014: 'Jadwal sudah terkunci',
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
  // ⚡ MEMORY CACHE
  // =========================
  if (
    !forceRefresh &&
    memorySignature &&
    now < memoryExpiredAt
  ) {
    return memorySignature;
  }

  // =========================
  // 🗄️ DATABASE CACHE
  // =========================
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

  let res: Response;

  try {
    res = await fetchWithTimeout(
      `${ORBIS_URL}/session`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
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

    throw new Error(
      'Tidak dapat terhubung ke sistem maskapai'
    );
  }

  if (!res.ok) {
    throw new Error(
      `Sistem maskapai error (${res.status})`
    );
  }

  const raw = await res.json();

  const data = raw.result || raw;

  if (data.error_code !== 0) {
    throw new Error(
      data.error_msg || 'Login ORBIS gagal'
    );
  }

  const newSignature =
    data.response?.signature;

  if (!newSignature) {
    throw new Error(
      'Signature ORBIS tidak ditemukan'
    );
  }

  // =========================
  // ⏰ EXPIRY
  // =========================
  const expiryDate = new Date();

  expiryDate.setMinutes(
    expiryDate.getMinutes() + 45
  );

  // =========================
  // ⚡ SAVE MEMORY
  // =========================
  memorySignature = newSignature;
  memoryExpiredAt = expiryDate.getTime();

  // =========================
  // 🗄️ SAVE DATABASE
  // =========================
  await prisma.orbisSession.create({
    data: {
      signature: newSignature,
      expiresAt: expiryDate,
    },
  });

  // cleanup old session
  await prisma.orbisSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return newSignature;
}

// =========================
// 🌐 CORE REQUEST
// =========================
export async function orbisRequest(
  endpoint: string,
  action: string,
  body: object = {}
): Promise<any> {
  let signature = await getOrbisSignature();

  const doFetch = async (
    currentSignature: string
  ) => {
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
          },
          body: JSON.stringify(body),
        },
        25000
      );
    } catch (err) {
      console.error(
        `[ORBIS FETCH ERROR] ${action}`,
        err
      );

      throw new Error(
        'Koneksi ke sistem maskapai terputus'
      );
    }

    if (
      res.status === 502 ||
      res.status === 503
    ) {
      throw new Error(
        'Sistem maskapai sedang sibuk'
      );
    }

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status} pada ${action}`
      );
    }

    return res.json();
  };

  // =========================
  // 🚀 FIRST REQUEST
  // =========================
  let json = await doFetch(signature);

  let result = json.result || json;

  // =========================
  // 🔄 AUTO REFRESH TOKEN
  // =========================
  if (result.error_code === 1002) {
    console.warn(
      '[ORBIS] Signature expired, refreshing...'
    );

    signature = await getOrbisSignature(true);

    json = await doFetch(signature);

    result = json.result || json;
  }

  // =========================
  // ❌ HANDLE ERROR
  // =========================
  if (result.error_code !== 0) {
    console.error(
      `[ORBIS ERROR]`,
      action,
      result.error_code,
      result.error_msg
    );

    const friendlyMsg =
      getOrbisErrorMessage(
        result.error_code,
        result.error_msg
      );

    const err = new Error(friendlyMsg);

    (err as any).orbisCode =
      result.error_code;

    throw err;
  }

  return result.response;
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
  search: (params: any) =>
    orbisRequest(
      '/booking/airline',
      'search',
      {
        ...params,
        cabin_class:
          params.cabin_class || 'Y',
        carrier_codes:
          params.carrier_codes || [],
        promo_codes:
          params.promo_codes || [],
        is_combo_price:
          params.is_combo_price ?? false,
      }
    ),

  getPriceItinerary: (params: any) =>
    orbisRequest(
      '/booking/airline',
      'get_price_itinerary',
      params
    ),

  sellJourneys: (params: any) =>
    orbisRequest(
      '/booking/airline',
      'sell_journeys',
      params
    ),

  updateContacts: (params: any) =>
    orbisRequest(
      '/booking/airline',
      'update_contacts',
      params
    ),

  updatePassengers: (params: any) =>
    orbisRequest(
      '/booking/airline',
      'update_passengers',
      params
    ),

  getSeatAvailability: () =>
    orbisRequest(
      '/booking/airline',
      'get_seat_availability',
      {}
    ),

  getSsrAvailability: () =>
    orbisRequest(
      '/booking/airline',
      'get_ssr_availability',
      {}
    ),

  // Dipanggil SETELAH sell_journeys (lock) — memberikan harga bagasi yang lebih akurat
  getPostSsrAvailability: (params?: { order_number?: string; schedules?: any[] }) =>
    orbisRequest(
      '/booking/airline',
      'get_post_ssr_availability',
      params || {}
    ),

  assignSeats: (params: any) =>
    orbisRequest(
      '/booking/airline',
      'assign_seats',
      params
    ),

  /**
   * Jual SSR (bagasi tambahan dll.) SEBELUM commit_booking.
   * Format REQ sesuai docs:
   * { sell_ssrs_request: [{ sell_ssrs: [{ journey_code, availability_type, passengers:[{passenger_number, ssr_code}] }], provider }] }
   */
  sellSsrs: (params: {
    sell_ssrs_request: Array<{
      provider: string;
      sell_ssrs: Array<{
        journey_code:      string;
        availability_type: string;
        passengers:        Array<{ passenger_number: number; ssr_code: string }>;
      }>;
    }>;
  }) =>
    orbisRequest('/booking/airline', 'sell_ssrs', params),

  /**
   * Jual SSR SETELAH commit_booking (jika sudah punya order_number & pnr).
   * Format REQ:
   * { sell_ssrs_request: [{ sell_ssrs: [...], pnr }], order_number }
   */
  sellPostSsrs: (params: {
    order_number: string;
    sell_ssrs_request: Array<{
      pnr:       string;
      sell_ssrs: Array<{
        journey_code:      string;
        availability_type: string;
        passengers:        Array<{ passenger_number: number; ssr_code: string }>;
      }>;
    }>;
  }) =>
    orbisRequest('/booking/airline', 'sell_post_ssrs', params),

  commitBooking: (params: any) =>
    orbisRequest(
      '/booking/airline',
      'commit_booking',
      params
    ),

  getBooking: (order_number: string) =>
    orbisRequest(
      '/booking/airline',
      'get_booking',
      { order_number }
    ),

  issued: (order_number: string) =>
    orbisRequest(
      '/booking/airline',
      'issued',
      { order_number }
    ),

  cancelVoid: (order_number: string) =>
    orbisRequest(
      '/booking/airline',
      'cancel_void',
      { order_number }
    ),

  cancelRefund: (params: { order_number: string; provider_bookings: any[] }) =>
    orbisRequest(
      '/booking/airline',
      'cancel_refund',
      params
    ),
};

// =========================
// 🚆 TRAIN API (KAI RODEXTRIP)
// =========================
export const trainAPI = {
  /**
   * Cari jadwal kereta.
   * REQ: { journey_list: [{origin, destination, departure_date}], direction, adult, infant, provider }
   */
  search: (params: {
    journey_list: Array<{ origin: string; destination: string; departure_date: string }>;
    direction: 'OW' | 'RT';
    adult: number;
    infant: number;
    provider: string;
  }) =>
    orbisRequest('/booking/train', 'search', params),

  /**
   * Ambil daftar semua stasiun KAI.
   * REQ: { provider_type: "train" }
   */
  getDestinations: () =>
    orbisRequest('/booking/train', 'get_destination', { provider_type: 'train' }),

  /**
   * Cek ketersediaan kursi untuk fare_code tertentu.
   * REQ: { fare_codes: string[], provider: "kai" }
   */
  getSeatAvailability: (params: { fare_codes: string[]; provider: string }) =>
    orbisRequest('/booking/train', 'get_seat_availability', params),

  /**
   * Pilih kursi untuk penumpang.
   * REQ: { order_number, provider_bookings: [{provider, sequence, journeys: [{sequence, seats: [{cabin_code, seat_row, seat_column, passenger_sequence}]}]}] }
   */
  assignSeats: (params: any) =>
    orbisRequest('/booking/train', 'assign_seats', params),

  /**
   * Buat booking / lock seat.
   * REQ: { contacts, passengers, schedules: [{journeys:[{journey_code, fare_code}], provider}], booker, force_issued? }
   */
  commitBooking: (params: {
    contacts: any[];
    passengers: any[];
    schedules: any[];
    booker: any;
    force_issued?: boolean;
  }) =>
    orbisRequest('/booking/train', 'commit_booking', params),

  /**
   * Ambil detail booking berdasarkan order_number.
   * REQ: { order_number }
   */
  getBooking: (order_number: string) =>
    orbisRequest('/booking/train', 'get_booking', { order_number }),

  /**
   * Issue tiket (konfirmasi pembayaran ke KAI).
   * REQ: { order_number }
   */
  issued: (order_number: string) =>
    orbisRequest('/booking/train', 'issued', { order_number }),

  /**
   * Batalkan booking / refund ke KAI.
   * REQ: { order_number }
   */
  cancelBooking: (order_number: string) =>
    orbisRequest('/booking/train', 'cancel_booking', { order_number }),

  /**
   * Ambil printout / e-tiket.
   * REQ: { order_number, mode: "ticket", provider_type: "train" }
   */
  getPrintout: (order_number: string) =>
    orbisRequest('/booking/train', 'get_printout', {
      order_number,
      mode: 'ticket',
      provider_type: 'train',
    }),

  /**
   * Cek saldo agent.
   * REQ: {}
   */
  getBalance: () =>
    orbisRequest('/booking/train', 'get_balance', {}),
};

// =========================
// 🏨 HOTEL API (BARU DITAMBAHKAN)
// =========================
export const hotelAPI = {
  search: (params: any) => 
    orbisRequest('/hotel/search', 'search', params),

  getBooking: (order_number: string, issued_name: string, provider: string) => 
    orbisRequest('/hotel/booking', 'get_booking', { order_number, issued_name, provider }),

  sellHotel: (params: any) => 
    orbisRequest('/hotel/booking', 'sell_hotel', params),

  createBooking: (params: any) =>
    orbisRequest('/hotel/booking', 'create_booking', params),
    
  commitBooking: (params: any) => 
    orbisRequest('/hotel/booking', 'commit_booking', params),

  checkRefund: (order_number: string, issued_name: string, provider: string) =>
    orbisRequest('/hotel/booking', 'check_refund', { order_number, issued_name, provider }),

  cancelBooking: (order_number: string, issued_name: string, provider: string) =>
    orbisRequest('/hotel/booking', 'cancel_booking', { order_number, issued_name, provider }),
};

// =========================
// 🛡️ INSURANCE API
// =========================
export const insuranceAPI = {
  /**
   * Ambil konfigurasi semua provider asuransi (area, tipe perjalanan, dll).
   * REQ: {} (kosong)
   */
  getConfig: () =>
    orbisRequest('/booking/insurance', 'get_config', {}),

  /**
   * Cek ketersediaan produk asuransi.
   * REQ: { date_start, date_end, pax, destination, is_senior, international,
   *        destination_area, type, provider, product_type, carrier_code, age? }
   */
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
  }) =>
    orbisRequest('/booking/insurance', 'get_availability', params),

  /**
   * Hitung harga & validasi produk asuransi sebelum booking.
   * REQ: { data: { product_code, provider, carrier_code },
   *        pax, package, age: string[], age_type: "age"|"birth_date", adult, child?, infant? }
   */
  sellInsurance: (params: {
    data: { product_code: string; provider: string; carrier_code: string };
    pax: number;
    package: number;
    age: string[];
    age_type: 'age' | 'birth_date';
    adult: number;
    child?: number;
    infant?: number;
  }) =>
    orbisRequest('/booking/insurance', 'sell_insurance', params),

  /**
   * Buat booking / commit polis asuransi.
   * REQ: { contacts, passengers, booker, provider, carrier_code, voucher? }
   */
  commitBooking: (params: {
    contacts: any[];
    passengers: any[];
    booker: any;
    provider: string;
    carrier_code: string;
    voucher?: object;
  }) =>
    orbisRequest('/booking/insurance', 'commit_booking', params),

  /**
   * Issue polis (konfirmasi pembayaran ke provider).
   * REQ: { order_number, voucher?, agent_payment_method?, member?, use_point? }
   */
  issued: (params: { order_number: string; voucher?: object; agent_payment_method?: string; member?: boolean; use_point?: boolean }) =>
    orbisRequest('/booking/insurance', 'issued', { agent_payment_method: 'balance', member: false, use_point: false, voucher: {}, ...params }),

  /**
   * Ambil detail booking asuransi berdasarkan order_number.
   * REQ: { order_number, force_sync? }
   */
  getBooking: (order_number: string, force_sync = false) =>
    orbisRequest('/booking/insurance', 'get_booking', { order_number, force_sync }),

  /**
   * Batalkan polis asuransi.
   * REQ: { order_number }
   */
  cancelBooking: (order_number: string) =>
    orbisRequest('/booking/insurance', 'cancel_booking', { order_number }),

  /**
   * Cek saldo agent untuk asuransi.
   * REQ: {}
   */
  getBalance: () =>
    orbisRequest('/booking/insurance', 'get_balance', {}),
};