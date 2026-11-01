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
// 📋 ORBIS CODESETS (§4)
// =========================
export const ORBIS_CABIN_CLASS: Record<string, string> = {
  Y: 'Economy',
  W: 'Premium Economy',
  C: 'Business',
  F: 'First Class',
};

export const ORBIS_SSR_TYPE: Record<string, string> = {
  BG: 'Baggage',
  BGA: 'Baggage Plane',
  BGC: 'Baggage Cabin',
  ML: 'Meal',
};

export const ORBIS_PAX_TYPE: Record<string, string> = {
  ADT: 'Adult',
  CHD: 'Child',
  INF: 'Infant',
  YCD: 'Senior Citizen',
  STU: 'Student Fare',
};

export const ORBIS_CHARGE_TYPE: Record<string, string> = {
  FARE: 'Fare',
  TAX: 'Tax',
  RAC: 'Agent Commission',
};

export const ORBIS_PAX_TITLE: Record<string, string> = {
  MR: 'Mr.',
  MRS: 'Mrs.',
  MS: 'Ms.',
  MSTR: 'Master',
  MISS: 'Miss',
};

export const ORBIS_BOOKING_STATE: Record<string, string> = {
  booked: 'Reservation Booked',
  cancel: 'Reservation Cancelled',
  cancel2: 'Reservation Expired',
  issued: 'Reservation Issued',
  fail_booked: 'Reservation Failed',
  partial_booked: 'Partial Booking',
  fail_issued: 'Issuance Failed',
  partial_issued: 'Partial Issuance',
  void: 'Reservation Void',
  partial_void: 'Partial Void',
  refund: 'Reservation Refunded',
  partial_refund: 'Partial Refund',
};

export const ORBIS_REFUND_STATE: Record<string, string> = {
  draft: 'New Refund Request',
  confirm: 'Refund Confirmed',
  sent: 'Refund Requested to Vendor',
  finalize: 'Refund Processing',
  done: 'Refund Completed',
};

export const ORBIS_SEAT_AVAILABILITY: Record<number, string> = {
  1: 'Available',
  0: 'Blocked',
  '-1': 'No Seat',
};

export const ORBIS_PRTINTOUT_MODE: Record<string, string> = {
  ticket: 'Ticket Only',
  ticket_price: 'Ticket with Price',
};

// =========================
// ⚡ MEMORY CACHE & LOCK
// =========================
let memorySignature: string | null = null;
let memoryExpiredAt = 0;
let fetchingSignature: Promise<string> | null = null; // Kunci Promise untuk cegah Race Condition

// =========================
// 🗺️ ERROR MAP
// =========================
// FIX: dilengkapi sesuai Codeset 4.1 pada dokumentasi Orbis Hotel API,
// sebelumnya banyak kode (4002-4005, 4012-4013, 4017-4019, 4022, 4024,
// 4027, 4029-4030, 4032-4033, 4043-4044) tidak dipetakan sehingga user
// hanya melihat pesan generik "Terjadi kesalahan sistem (xxxx)".
const ORBIS_ERROR_MESSAGES: Record<number, string> = {
  500: 'Terjadi kesalahan pada server',
  1001: 'Permintaan tidak valid',
  1002: 'Sesi login maskapai habis',
  4001: 'Action tidak valid',
  4002: 'Kredensial tidak valid, hubungi admin',
  4003: 'Sesi telah berakhir, silakan coba lagi',
  4004: 'Akses ditolak untuk aksi ini',
  4005: 'Provider sedang tidak tersedia',
  4006: 'Harga telah berubah',
  4007: 'Layanan SSR/seat tidak tersedia untuk penerbangan ini',
  4008: 'SSR/seat tidak tersedia',
  4009: 'Gagal menetapkan SSR',
  4010: 'Gagal menetapkan kursi',
  4011: 'Sesi pencarian expired, silakan cari ulang',
  4012: 'Sesi ganda terdeteksi, silakan coba lagi',
  4013: 'Data yang dikirim tidak valid',
  4014: 'Jadwal sudah terkunci',
  4015: 'Destinasi tidak diizinkan',
  4016: 'Gagal mengkonfirmasi booking',
  4017: 'Gagal mengambil data booking',
  4018: 'Akses dibatasi untuk akun ini',
  4019: 'Gagal melakukan reissue',
  4020: 'Jadwal tidak tersedia',
  4021: 'Harga tidak tersedia, silakan pilih jadwal lain',
  4022: 'Gagal membatalkan booking',
  4023: 'Data tidak ditemukan',
  4024: 'Sesi vendor telah berakhir',
  4025: 'Penerbangan tidak tersedia',
  4026: 'Booking hold tidak diizinkan, harus issued langsung',
  4027: 'Saldo vendor tidak mencukupi',
  4028: 'Bayi tidak dapat dipasangkan dengan lansia',
  4029: 'Gagal menerbitkan tiket/booking',
  4030: 'Akun dibekukan',
  4031: 'Data tidak ditemukan',
  4032: 'Transaksi gagal diproses',
  4033: 'Gagal melakukan pembayaran',
  4034: 'Transaksi sudah dibayar di vendor',
  4035: 'Transaksi gagal, perlu sync manual',
  4036: 'Transaksi sedang diproses, coba lagi nanti',
  4037: 'Frequent flyer tidak tersedia',
  4038: 'PNR tidak ditemukan',
  4039: 'PNR tidak dapat diproses',
  4040: 'Gagal split booking',
  4041: 'Gagal mengambil saldo vendor',
  4042: 'Tidak ada perubahan yang terdeteksi',
  4043: 'Pembatalan tidak tersedia untuk booking ini',
  4044: 'Split booking tidak tersedia',
  9999: 'Sistem maskapai sedang gangguan',
  // FIX: 9952 BUKAN bagian dari Codeset 4.1 resmi (codeset hanya berhenti di
  // 4044/9999) — ini kode internal Orbis untuk kegagalan infrastruktur saat
  // gateway mereka gagal terhubung ke Hotel Webservice (layanan agregasi
  // vendor: RDX07, RDX03, hotelbeds, mgjarvis, dst — lihat doc §2.1.2, yang
  // hanya mendokumentasikan environment "Development" untuk endpoint hotel,
  // Production masih "-"). Ini BUKAN bug di payload kita — signature/session
  // tetap berhasil (login OK), hanya action search/get_details/provision yang
  // gagal. Sudah diverifikasi: field & format payload search 100% cocok
  // dengan semua contoh di doc (§3.4.2.1/§3.4.3.1/§3.4.4.1), dan error yang
  // sama muncul di SEMUA destination_id yang dicoba (ID & luar negeri).
  9952: 'Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor, silakan coba lagi dalam beberapa saat',
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
// Action read-only (tidak mengubah state di Orbis) yang aman diulang otomatis
// kalau server mereka balas error 500 generik. Action mutasi (booked,
// commit_booking, cancel_booking, sell_*, issued, dst) SENGAJA tidak
// dimasukkan — retry di action semacam itu berisiko duplikasi kalau
// attempt pertama sebenarnya sudah diproses di sisi Orbis.
const ORBIS_RETRY_SAFE_ACTIONS = new Set([
  'search',
  'get_details',
  'provision',
  'get_cancellation_policy',
  'check_booking_status',
  'check_refund_amount',
  'get_booking',
  'get_balance',
  'get_config',
  'get_availability',
  'get_destinations',
  'get_printout',
  'get_seat_availability',
  'get_post_ssr_availability',
  'get_post_seat_availability',
  'get_price_itinerary',
  'get_ssr_availability',
  'get_ff_availability',
  'get_printout_list',
  'get_reschedule_availability',
  'pre_refund_login_list',
  'get_refund_booking',
  'get_destination_list',
]);

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

    // Log ini menampilkan body FINAL persis sebelum fetch (setelah transformasi
    // createBooking di atas — sekarang hanya `price_code` diluruskan ke String(),
    // tidak ada lagi rename/potong/stringify), supaya kalau error dari Orbis
    // terulang lagi, kita bisa lihat persis apa yang diterima server tanpa
    // harus menebak-nebak transformasi mana yang sudah/belum jalan.
    if (action === 'booked' || action === 'commit_booking' || action === 'cancel_booking') {
      console.log(`[ORBIS WIRE] action=${action} body=`, JSON.stringify(body, null, 2));
    }

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
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout saat menghubungi Orbis untuk ${action}`);
      }
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
          `response_keys=${responseKeys}`,
          `response=${JSON.stringify(result.response ?? null)}`
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

      // FIX: kode 500 "Internal server error" itu generik dari sisi Orbis
      // sendiri (server mereka crash/exception saat memproses request),
      // beda karakter dengan kode 4xxx (penolakan bisnis/validasi yang
      // memang final). Sebelumnya `!orbisErr.orbisCode` membuat SEMUA error
      // ber-kode — termasuk 500 — dianggap final dan tidak pernah di-retry.
      //
      // Tapi retry TIDAK aman untuk action yang mengubah state (booked,
      // commit_booking, cancel_booking, dst) — kalau attempt pertama
      // sebenarnya sudah sukses diproses di sisi Orbis tapi responsnya
      // gagal terkirim balik, retry bisa memicu booking/cancel dobel.
      // Jadi retry-on-500 hanya diizinkan untuk action read-only
      // (ORBIS_RETRY_SAFE_ACTIONS di atas).
      const isNetworkRetryable = !orbisErr.orbisCode && (
        orbisErr.message?.includes('terputus') ||
        orbisErr.message?.includes('sibuk') ||
        orbisErr.message?.includes('Timeout') ||
        orbisErr.message?.includes('abort')
      );
      // FIX: 9952 = "Connection error to Hotel Webservice" — kegagalan gateway
      // Orbis menghubungi layanan agregasi vendor hotel mereka sendiri (bukan
      // error validasi/bisnis seperti kode 4xxx). Diberi kesempatan retry yang
      // sama seperti 500 karena sifatnya sama-sama transient di sisi mereka,
      // hanya untuk action read-only (lihat ORBIS_RETRY_SAFE_ACTIONS di atas).
      const isServerGlitchRetryable = (orbisErr.orbisCode === 500 || orbisErr.orbisCode === 9952) && ORBIS_RETRY_SAFE_ACTIONS.has(action);
      const isRetryable = isNetworkRetryable || isServerGlitchRetryable;

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
  title: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  pax_type: string;
  gender?: string;
  nationality_code: string;
  identity?: OrbisPassengerIdentity;
  ff_numbers?: Array<{
    schedule_id: number;
    ff_number: string;
    ff_code: string;
  }>;
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

  // ── Get Post Seat Availability (§3.29) ───────────────────────────────────
  // Mendapatkan peta kursi untuk booking yang sudah issued (post-booking).
  // Request: { order_number, schedules: [{pnr}] }
  getPostSeatAvailability: (params: { order_number: string; schedules: Array<{ pnr: string }> }) =>
    orbisRequest('/booking/airline', 'get_post_seat_availability', params),

  // ── Assign Post Seats (§3.30) ────────────────────────────────────────────
  // Menetapkan kursi untuk booking yang sudah issued (post-booking).
  // Request: { order_number, segment_seat_request: [{pnr, segment_code, passengers: [{passenger_number, seat_code}]}] }
  assignPostSeats: (params: {
    order_number: string;
    segment_seat_request: Array<{
      pnr: string;
      segment_code: string;
      passengers: Array<{ passenger_number: number; seat_code: string }>;
    }>;
  }) => orbisRequest('/booking/airline', 'assign_post_seats', params),

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

  // ── Get FF Availability (§3.11) ────────────────────────────────────────────
  // Mendapatkan daftar frequent flyer program yang tersedia untuk penerbangan.
  // Dipanggil SEBELUM update_passengers jika ingin menyertakan FF pax.
  // Request body: {} (kosong — Orbis pakai sesi internal)
  getFfAvailability: () =>
    orbisRequest('/booking/airline', 'get_ff_availability', {}),

  // ── Get Printout List (§3.20) ──────────────────────────────────────────────
  // Mendapatkan URL e-ticket untuk booking yang sudah issued.
  // Request: { order_number, mode: 'ticket'|'ticket_price', provider_type: 'airline' }
  getPrintoutList: (params: { order_number: string; mode?: string }) =>
    orbisRequest('/printout', 'get_printout_list', {
      order_number: params.order_number,
      mode: params.mode || 'ticket',
      provider_type: 'airline',
    }),

  // ── Get Reschedule Availability (§3.25) ────────────────────────────────────
  // Mendapatkan jadwal penerbangan yang tersedia untuk reschedule.
  // Request: { order_number, cabin_class, reschedule_list: [{pnr, journeys: [{origin, destination, departure_date}]}] }
  getRescheduleAvailability: (params: {
    order_number: string;
    cabin_class: string;
    reschedule_list: Array<{
      pnr: string;
      journeys: Array<{ origin: string; destination: string; departure_date: string }>;
    }>;
  }) => orbisRequest('/booking/airline', 'get_reschedule_availability', params),

  // ── Sell Reschedule (§3.26) ────────────────────────────────────────────────
  // Menetapkan jadwal baru untuk reschedule.
  // Request: { order_number, schedules: [{pnr, journeys: [{segments: [{segment_code, fare_code}]}]}] }
  sellReschedule: (params: {
    order_number: string;
    schedules: OrbisStruct[];
  }) => orbisRequest('/booking/airline', 'sell_reschedule', params),

  // ── Pre Refund Login List (§3.22) ──────────────────────────────────────────
  // Mendapatkan captcha untuk proses refund (jika vendor menyediakan captcha).
  // Request: { order_number, provider: ["citilink"], pnr: ["ZD23NM"] }
  preRefundLoginList: (params: { order_number: string; provider: string[]; pnr: string[] }) =>
    // Captcha hanya langkah opsional. Batasi percobaan agar alur estimasi refund
    // dapat beralih ke get_refund_booking tanpa menunggu retry berulang.
    orbisRequest('/booking/airline', 'pre_refund_login_list', params, 30000, 1),

  // ── Get Refund Booking (§3.23) ─────────────────────────────────────────────
  // Mendapatkan detail refund booking.
  // Captcha wajib berdasarkan validasi vendor: { order_number, provider_bookings: [...], captcha: {pnr: value} }
  getRefundBooking: (params: {
    order_number: string;
    provider_bookings: OrbisStruct[];
    captcha: Record<string, string>;
  }) => orbisRequest('/booking/airline', 'get_refund_booking', params),

  // ── Get Fare Rules (§3.9) ──────────────────────────────────────────────────
  // Mendapatkan aturan/fare rules untuk jadwal penerbangan.
  // Request: { schedules: [{provider, journeys: [{segments: [{segment_code, fare_code}]}]}] }
  getFareRules: (params: OrbisStruct) =>
    orbisRequest('/booking/airline', 'get_fare_rules', params),

  // ── Update Booking (§3.31) ─────────────────────────────────────────────────
  // Update data booking setelah reschedule/SSR/seat.
  // Request: { order_number, schedules: [{pnr}] }
  updateBooking: (params: {
    order_number: string;
    schedules: Array<{ pnr: string }>;
  }) => orbisRequest('/booking/airline', 'update_booking', params),
};

// =========================
// 📡 CONTENT API
// Endpoint: /content (§2.1.3)
// =========================
export const contentAPI = {
  // ── Get Destination List (§3.4) ────────────────────────────────────────────
  // Mendapatkan daftar destinasi/kota yang tersedia.
  // Request: { provider_type: "airline" } — wajib diisi
  getDestinations: () =>
    orbisRequest('/content', 'get_destination_list', { provider_type: 'airline' }),

  // ── Get Carriers (§3.5) ────────────────────────────────────────────────────
  // Mendapatkan daftar semua maskapai yang tersedia di inventory.
  // Request: { provider_type: "airline" } — wajib diisi
  getCarriers: () =>
    orbisRequest('/content', 'get_carriers', { provider_type: 'airline' }),

  // ── Get Carrier Providers (§3.6) ──────────────────────────────────────────
  // Mendapatkan daftar provider untuk setiap maskapai.
  // Request: { provider_type: "airline" } — wajib diisi
  getCarrierProviders: () =>
    orbisRequest('/content', 'get_carrier_providers', { provider_type: 'airline' }),
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

  // Sesuai doc RODEXTRIP 1.3.3 — Actions List Train:
  // endpoint `content`, header action `get_destinations`, body { provider_type: "train" }.
  // (Sebelumnya salah: endpoint `/booking/train` + action `get_destination` → error 4001 "Invalid action type".)
  getDestinations: () =>
    orbisRequest('/content', 'get_destinations', { provider_type: 'train' }),

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
    orbisRequest('/printout', 'get_printout_api', {
      order_number,
      mode: 'ticket',
      provider_type: 'train',
    }),
};

// =========================
// 📡 ACCOUNT API
// Endpoint: /account (§3.3)
// =========================
export const accountAPI = {
  // ── Get Balance (§3.3) ─────────────────────────────────────────────────────
  // Mendapatkan saldo akun user.
  getBalance: () => orbisRequest('/account', 'get_balance', {}),
};

// =========================
// 🔐 SESSION API
// Endpoint: /session (§2.1.1)
// =========================
export const sessionAPI = {
  // ── Sign Out (§3.2) ──────────────────────────────────────────────────────
  // Sign out — server membatalkan signature, tidak bisa dipakai lagi.
  // Setelah signout sukses, bersihkan cache memory & DB supaya request
  // berikutnya otomatis sign-in ulang alih-alih pakai signature lama.
  signout: async () => {
    const result = await orbisRequest('/session', 'signout', {});
    // Bersihkan signature in-memory
    memorySignature = null;
    memoryExpiredAt = 0;
    // Bersihkan semua session di database
    await prisma.orbisSession.deleteMany({}).catch(() => {});
    return result;
  },
};

// ── Helper: normalisasi child_ages ──────────────────────────────────────────
// Internal aplikasi memakai array number murni [5, 7] (tanpa string), sesuai
// keputusan menghilangkan format string di codebase. TAPI di boundary ke Orbis,
// vendor mensyaratkan STRING "[5,7]" (doc §3.4.1.1) — kalau dikirim array,
// vendor balas daftar hotel kosong tanpa error_code. Jadi konversi terjadi
// HANYA di sini, tepat sebelum request dikirim.
function normalizeChildAges(
  childAges: unknown
): string {
  if (Array.isArray(childAges)) {
    return '[' + childAges.map(Number).filter(n => !isNaN(n)).join(',') + ']';
  }
  if (typeof childAges === 'string') {
    // Sudah string — rapi-kan ke format "[x,y,z]"
    const raw = childAges.replace(/^\[|\]$/g, '');
    const parsed = raw.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
    return '[' + parsed.join(',') + ']';
  }
  return '[]';
}

// ── Helper: tambahkan search_name jika belum ada ────────────────────────────
// Dokumentasi §3.4.2.1 / §3.5.2.1 menunjukkan search_name selalu ada (walaupun kosong).
function ensureSearchName<T extends Record<string, unknown>>(params: T): T {
  if (!('search_name' in params) || params.search_name === undefined || params.search_name === null) {
    return { ...params, search_name: '' };
  }
  return params;
}

// =========================
// 🏨 HOTEL API
// Semua action hotel menggunakan endpoint /booking/hotel
// Action names sesuai dokumentasi API Section 3.x
// =========================
export const hotelAPI = {
  // 3.4 Search Hotel Availability
  // FIX: timeout 90 detik – hotel search aggregates banyak vendor, bisa lambat
  search: (params: OrbisStruct) => {
    const normalized = ensureSearchName(params);
    if ('child_ages' in normalized) {
      normalized.child_ages = normalizeChildAges(normalized.child_ages);
    }
    return orbisRequest('/booking/hotel', 'search', normalized, 90000);
  },

  // 3.5 Hotel Search Detail (action header: get_details)
  // FIX: timeout 90 detik – sama seperti search
  getDetails: (params: OrbisStruct) => {
    const normalized = ensureSearchName(params);
    if ('child_ages' in normalized) {
      normalized.child_ages = normalizeChildAges(normalized.child_ages);
    }
    return orbisRequest('/booking/hotel', 'get_details', normalized, 90000);
  },

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
  // ROUND 1: payload lama merename `price_code` → `price_codes` (plural)
  // SEKALIGUS memotongnya ke bagian integer saja (`.split('~')[0]`), dan
  // men-JSON.stringify search_data/passenger/contact/booker. Saya kira nama
  // field yang benar adalah `price_code` (singular, sesuai §3.8.1.1/§3.8.2.1
  // dokumentasi PDF) dan objeknya harus native JSON — jadi awalnya diganti ke
  // `price_code` + objek native semua.
  //
  // ROUND 2: server balas error spesifik `"Internal server error, 'price_codes'"`
  // — pesan `KeyError` Python mentah (`str(KeyError('price_codes'))`), bukti
  // langsung bahwa key HARUS `price_codes` (plural). Nama field dari dev
  // sebelumnya terbukti benar di titik ini; dokumentasi PDF yang meleset
  // (sama seperti field `provider` di provision yang wajib tapi tidak
  // terdokumentasi). Value tetap dikirim UTUH (bukan dipotong `.split('~')[0]`)
  // karena format mgjarvis (`"RM_1511_0~Flexi~RO~False"`) tidak punya prefix
  // integer sama sekali — asumsi "harus integer" dari versi lama tidak
  // berlaku umum.
  //
  // ROUND 4: Doc §3.8.2.1 menunjukkan passenger, contact, booker, search_data,
  // special_request sebagai native JSON objects — BUKAN JSON strings.
  // Sekarang default: native objects (sesuai doc). Set
  // HOTEL_BOOK_STRINGIFY_NESTED=true hanya jika Orbis minta stringified.
  //
  // ROUND 5: Strip `provider` dari payload booked — §3.8.1.1 HANYA list:
  // hotel_code, price_code, passenger, contact, booker, special_request,
  // search_data. Field `provider` menyebabkan Orbis 500 (handler crash
  // karena tidak mengenali field). Juga strip `hotel_id` dari search_data
  // (tidak ada di §3.8.1.1 search_data fields).
  //
  // ROUND 6: Kembali ke `price_code` (singular, sesuai §3.8.1.1/§3.8.2.1).
  // Sebelumnya dipakai `price_codes` (plural) karena KeyError saat data
  // masih stringified — sekarang ternyata itu karena stringified data,
  // bukan nama field. Dengan native objects, `price_code` singular benar.
  createBooking: (params: OrbisStruct & {
    hotel_code: string;
    price_code?: string;
    provider?: string;
    special_request?: string;
  }) => {
    const { price_code, search_data, passenger, contact, booker, special_request, ...rest } = params;
    // §3.8.1.1: `provider` tidak ada di daftar field yang didukung — buang dari payload.
    delete rest.provider;
    // Doc §3.8.1.1 search_data: checkin_date, checkout_date, destination_id,
    // search_name, adult, child, child_ages, room/rooms, nationality.
    // Strip hotel_id (not documented, may cause Orbis 500).
    const cleanSearchData = search_data ? {
      ...Object.fromEntries(
        Object.entries(search_data as Record<string, unknown>).filter(([k]) => k !== 'hotel_id')
      ),
      // §3.8.1.1: child_ages harus berupa string "[5,5,10]" — konversi di boundary
      // karena internal memakai array number murni
      ...('child_ages' in (search_data as Record<string, unknown>) ? { child_ages: normalizeChildAges((search_data as Record<string, unknown>).child_ages) } : {}),
    } : search_data;
    const stringifyNested = process.env.HOTEL_BOOK_STRINGIFY_NESTED === 'true';
    const nested = stringifyNested
      ? {
          ...(cleanSearchData !== undefined ? { search_data: JSON.stringify(cleanSearchData) } : {}),
          ...(passenger !== undefined ? { passenger: JSON.stringify(passenger) } : {}),
          ...(contact !== undefined ? { contact: JSON.stringify(contact) } : {}),
          ...(booker !== undefined ? { booker: JSON.stringify(booker) } : {}),
          ...(special_request !== undefined ? { special_request: JSON.stringify(special_request) } : {}),
        }
      : {
          ...(cleanSearchData !== undefined ? { search_data: cleanSearchData } : {}),
          ...(passenger !== undefined ? { passenger } : {}),
          ...(contact !== undefined ? { contact } : {}),
          ...(booker !== undefined ? { booker } : {}),
          ...(special_request !== undefined ? { special_request } : {}),
        };
    return orbisRequest('/booking/hotel', 'booked', {
      ...rest,
      price_code: String(price_code ?? ''),
      ...nested,
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
  }, options?: { timeoutMs?: number; maxRetries?: number }) =>
    orbisRequest(
      '/booking/insurance',
      'get_availability',
      params,
      options?.timeoutMs ?? 60000,
      options?.maxRetries ?? 3
    ),

  sellInsurance: (params: {
    data: { product_code: string; provider: string; carrier_code: string };
    pax: number;
    package: number | string;
    age: number[] | string[];
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
    orbisRequest('/booking/insurance', 'cancel', { order_number }),

  getBalance: () =>
    orbisRequest('/booking/insurance', 'get_balance', {}),
};