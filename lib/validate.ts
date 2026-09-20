import { z, ZodSchema, ZodError } from 'zod';
import { NextResponse } from 'next/server';

// ─── API Helpers ─────────────────────────────────────────────────────────────

export function apiError(message: string, status = 400, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: false, error: message, ...extra }, { status });
}

export function apiSuccess(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

// Kode error Orbis yang berarti "tidak ada hasil dari provider ini" —
// bukan bug di request kita, jadi degradasi ke hasil kosong (success: true)
// alih-alih mematikan seluruh pencarian. Lihat Codeset 4.1 di dokumentasi:
// 4005 Provider is unavailable, 4023 Data tidak ditemukan (mis. destinasi/
// kode hotel/stasiun tidak dikenali vendor). 4015/4020 bukan bagian dari
// codeset resmi hotel/train, tapi beberapa provider mengembalikannya lewat
// error_msg saja (bukan error_code terstruktur) untuk kasus serupa, jadi
// tetap dicek lewat teks pesan sebagai fallback.
export function handleOrbisError(error: unknown, context: string, emptyData: unknown = []): NextResponse {
  const err = error as { orbisCode?: number; message?: string };
  const orbisCode = err?.orbisCode;
  const msg = String(err?.message || 'Unknown error');

  console.error(`[${context}] Error:`, msg, orbisCode ? `code: ${orbisCode}` : '(no orbisCode)');

  // FIX: 9952 bukan bagian dari Codeset 4.1 resmi — kode internal Orbis untuk
  // "Connection error to Hotel Webservice" (gateway mereka gagal menghubungi
  // layanan agregasi vendor hotel mereka sendiri, walau signature/session kita
  // valid). Ini kegagalan infrastruktur di sisi Orbis, bukan bug request kita
  // (sudah dicek: payload cocok 100% dengan dokumentasi, dan gagal di semua
  // destination_id). Sudah otomatis di-retry (lihat orbis.ts), jadi kalau
  // masih sampai sini berarti retry pun gagal — beri pesan yang jujur (503,
  // "layanan sedang gangguan") daripada raw 500 generik atau hasil kosong
  // yang menyesatkan (seolah memang tidak ada hotel yang cocok).
  const isHotelWebserviceDown = orbisCode === 9952 || msg.toLowerCase().includes('connection error to hotel webservice');
  if (isHotelWebserviceDown) {
    console.log(`[${context}] Hotel Webservice Orbis tidak dapat dihubungi (code=9952) walau setelah retry.`);
    return apiError('Layanan pencarian hotel sedang mengalami gangguan koneksi ke vendor. Silakan coba lagi dalam beberapa saat.', 503);
  }

  const isNotAllowed = orbisCode === 4015 || msg.includes('4015') || msg.toLowerCase().includes('not allowed');
  const isUnavailable = orbisCode === 4005 || msg.includes('4005') || msg.toLowerCase().includes('unavailable');
  const isNoSchedules = orbisCode === 4020 || msg.toLowerCase().includes('no schedules');
  const isNotFound = orbisCode === 4023 || msg.toLowerCase().includes('tidak ditemukan') || msg.toLowerCase().includes('not found');

  if (isNotAllowed || isUnavailable || isNoSchedules || isNotFound) {
    console.log(`[${context}] Provider offline / route tidak tersedia / tidak ditemukan (code=${orbisCode ?? 'n/a'}), mengembalikan hasil kosong.`);
    return apiSuccess({ data: emptyData });
  }

  if (orbisCode === 4011 || msg.toLowerCase().includes('kedaluwarsa')) {
    return apiError('Sesi kedaluwarsa. Silakan cari ulang.', 410);
  }

  if (orbisCode === 4014 || msg.includes('called this function before') || msg.includes('dikunci sebelumnya')) {
    console.log(`[${context}] Already processed (4014), continuing.`);
    return apiError('Already processed', 409);
  }

  if (msg.toLowerCase().includes('sibuk') || msg.includes('503') || msg.includes('502')) {
    return apiError('Sistem sedang sibuk. Silakan coba lagi.', 503);
  }

  return apiError(msg, 500, orbisCode ? { orbisCode } : undefined);
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      error.issues.forEach((err) => {
        const path = err.path.join('.');
        if (!details[path]) details[path] = [];
        details[path].push(err.message);
      });
      return {
        success: false,
        response: apiError('Validasi gagal. Periksa data yang dikirim.', 400, { details }),
      };
    }
    return {
      success: false,
      response: apiError('Terjadi kesalahan validasi.', 400),
    };
  }
}

// ─── Common Schemas ──────────────────────────────────────────────────────────
export const journeySchema = z.object({
  origin: z.string().min(1, 'Origin wajib diisi'),
  destination: z.string().min(1, 'Destination wajib diisi'),
  departure_date: z.string().min(1, 'Departure date wajib diisi'),
});

export const passengerIdentitySchema = z.object({
  identity_type: z.enum(['ktp', 'passport', 'sim', 'other']).optional().default('ktp'),
  identity_number: z.string().optional(),
  identity_expdate: z.string().optional(),
  identity_country_of_issued_code: z.string().optional(),
});

export const passengerSchema = z.object({
  title: z.enum(['MR', 'MRS', 'MS', 'MSTR', 'MISS']).optional().default('MR'),
  first_name: z.string().min(1, 'Nama depan wajib diisi'),
  last_name: z.string().optional(),
  birth_date: z.string().min(1, 'Tanggal lahir wajib diisi'),
  pax_type: z.enum(['ADT', 'CHD', 'INF', 'YCD', 'STU']),
  gender: z.enum(['male', 'female']).optional(),
  nationality_code: z.string().optional().default('ID'),
  identity: passengerIdentitySchema.optional(),
});

export const contactSchema = z.object({
  title: z.enum(['MR', 'MRS', 'MS', 'MSTR', 'MISS']).optional().default('MR'),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  email: z.string().email('Email tidak valid'),
  calling_code: z.string().optional().default('62'),
  mobile: z.string().min(1, 'Nomor telepon wajib diisi'),
  nationality_code: z.string().optional().default('ID'),
});

export const bookerSchema = z.object({
  title: z.enum(['MR', 'MRS', 'MS', 'MSTR', 'MISS']).optional().default('MR'),
  first_name: z.string().min(1, 'Nama pemesan wajib diisi'),
  last_name: z.string().optional(),
  email: z.string().email('Email pemesan tidak valid'),
  calling_code: z.string().optional().default('62'),
  mobile: z.string().min(1, 'Telepon pemesan wajib diisi'),
  nationality_code: z.string().optional().default('ID'),
});

// ─── Auth ────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(128),
  phone: z.string().optional(),
});

// ─── Flight ──────────────────────────────────────────────────────────────────
export const flightSearchSchema = z.object({
  direction: z.enum(['OW', 'RT', 'Multi']).optional().default('OW'),
  origin: z.string().optional(),
  destination: z.string().optional(),
  departure_date: z.string().optional(),
  return_date: z.string().optional(),
  routes: z.array(journeySchema).optional(),
  journey_list: z.array(journeySchema).optional(),
  adult: z.union([z.number(), z.string()]).optional(),
  child: z.union([z.number(), z.string()]).optional(),
  infant: z.union([z.number(), z.string()]).optional(),
  cabin_class: z.enum(['Y', 'C', 'F', 'W']).optional(),
  carrier_codes: z.array(z.string()).optional(),
  is_combo_price: z.boolean().optional(),
  provider: z.string().optional(),
}).passthrough().refine(
  (data) => {
    if (data.direction === 'Multi') return data.routes && data.routes.length > 0;
    if (data.journey_list && data.journey_list.length > 0) return true;
    return data.origin && data.destination && data.departure_date;
  },
  { message: 'Data rute tidak lengkap' }
);

export const flightBookSchema = z.object({
  schedules: z.array(z.any()).min(1, 'Data jadwal wajib diisi'),
  passengers: z.array(passengerSchema).min(1, 'Data penumpang wajib diisi'),
  contacts: z.array(contactSchema).optional(),
  booker: bookerSchema,
  is_combo_price: z.boolean().optional().default(false),
  cabin_class: z.enum(['Y', 'C', 'F', 'W']).optional().default('Y'),
  adult: z.number().int().min(0).optional().default(1),
  child: z.number().int().min(0).optional().default(0),
  infant: z.number().int().min(0).optional().default(0),
  total_amount: z.number().positive('total_amount harus positif'),
  route_label: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  departure_date: z.string().optional(),
  arrival_date: z.string().optional(),
  flight_number: z.string().optional(),
  airline_name: z.string().optional(),
  selectedSeats: z.array(z.any()).optional(),
  selectedBaggage: z.object({
    ssr_code: z.string(),
    journey_code: z.string(),
    kg: z.number().optional(),
    name: z.string().optional(),
  }).optional(),
  selectedMeal: z.object({
    ssr_code: z.string(),
    journey_code: z.string(),
    name: z.string().optional(),
  }).optional(),
  is_locked_before: z.boolean().optional().default(false),
  coupon_code: z.string().optional(),
  discount_amount: z.number().optional().default(0),
});

// ─── Hotel ───────────────────────────────────────────────────────────────────
export const hotelSearchSchema = z.object({
  destination_id: z.string().min(1, 'destination_id wajib diisi'),
  checkin_date: z.string().min(1, 'Tanggal check-in wajib diisi'),
  checkout_date: z.string().min(1, 'Tanggal check-out wajib diisi'),
  search_name: z.string().optional(),
  hotel_id: z.string().optional(),
  adult: z.union([z.number(), z.string()]).optional(),
  child: z.union([z.number(), z.string()]).optional(),
  child_ages: z.array(z.number()).optional(),
  room: z.union([z.number(), z.string()]).optional(),
  nationality: z.string().optional(),
}).passthrough();

// Hotel Search Detail (§3.5) — mirip search tapi hotel_id wajib
export const hotelDetailSchema = z.object({
  checkin_date: z.string().min(1, 'Tanggal check-in wajib diisi'),
  checkout_date: z.string().min(1, 'Tanggal check-out wajib diisi'),
  destination_id: z.string().min(1, 'destination_id wajib diisi'),
  hotel_id: z.string().min(1, 'hotel_id wajib diisi untuk detail hotel'),
  search_name: z.string().optional(),
  adult: z.union([z.number(), z.string()]).optional(),
  child: z.union([z.number(), z.string()]).optional(),
  child_ages: z.array(z.number()).optional(),
  room: z.union([z.number(), z.string()]).optional(),
  nationality: z.string().optional(),
}).passthrough();

// Tamu hotel — punya bentuk berbeda dari penumpang flight (tanpa birth_date).
export const hotelGuestSchema = z.object({
  title: z.string().optional(),
  first_name: z.string().min(1, 'Nama depan wajib diisi'),
  last_name: z.string().optional(),
  pax_type: z.string().optional(),
  nationality_code: z.string().optional(),
  identity_country_of_issued_code: z.string().optional(),
}).passthrough();

export const hotelBookSchema = z.object({
  hotel_code: z.string().min(1, 'Kode hotel wajib diisi'),
  price_code: z.string().min(1, 'Kode harga wajib diisi'),
  provider: z.string().optional(),
  // §3.8.1.1: passenger dan contact wajib (M) pada request create_booking
  passenger: z.union([hotelGuestSchema, z.array(hotelGuestSchema)]),
  contact: z.union([contactSchema.passthrough(), z.array(contactSchema.passthrough())]),
  booker: bookerSchema.passthrough(),
  special_request: z.string().optional(),
  search_data: z.object({
    checkin_date: z.string().min(1),
    checkout_date: z.string().min(1),
    // §3.8.1.1: destination_id, adult, child, child_ages, room, nationality — semua M
    destination_id: z.string().optional(),
    adult: z.union([z.number(), z.string()]).optional(),
    child: z.union([z.number(), z.string()]).optional(),
    child_ages: z.array(z.number()).optional(),
    room: z.union([z.number(), z.string()]).optional(),
    nationality: z.string().optional(),
    hotel_id: z.string().optional(),
    search_name: z.string().optional(),
    // Hotel detail fields — dari frontend checkout
    meal_type: z.string().optional(),
    room_description: z.string().optional(),
    nights: z.union([z.number(), z.string()]).optional(),
  }).passthrough(),
  total_amount: z.number().positive('total_amount harus positif'),
  hotel_name: z.string().optional(),
  coupon_code: z.string().optional(),
  discount_amount: z.number().optional(),
});

// ─── Train ───────────────────────────────────────────────────────────────────
export const trainSearchSchema = z.object({
  journey_list: z.array(journeySchema).min(1, 'journey_list tidak boleh kosong'),
  direction: z.enum(['OW', 'RT']).optional().default('OW'),
  adult: z.union([z.number(), z.string()]).optional(),
  infant: z.union([z.number(), z.string()]).optional(),
}).passthrough();

export const trainScheduleSchema = z.object({
  provider: z.string().optional(),
  journeys: z.array(z.object({
    journey_code: z.string().optional(),
    fare_code: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();

export const trainBookSchema = z.object({
  contacts: z.array(contactSchema.passthrough()).min(1, 'Data kontak wajib diisi'),
  passengers: z.array(passengerSchema.passthrough()).min(1, 'Data penumpang wajib diisi'),
  schedules: z.array(trainScheduleSchema).min(1, 'Data jadwal wajib diisi'),
  booker: bookerSchema.passthrough(),
  total_amount: z.number().positive('total_amount harus positif'),
  origin: z.string().optional(),
  destination: z.string().optional(),
  departure_date: z.string().optional(),
  arrival_date: z.string().optional(),
  train_name: z.string().optional(),
  train_number: z.string().optional(),
  cabin_class: z.string().optional(),
  coupon_code: z.string().optional(),
  discount_amount: z.number().optional(),
});

// ─── Insurance ───────────────────────────────────────────────────────────────
export const insuranceSearchSchema = z.object({
  date_start: z.string().min(1, 'Tanggal mulai wajib diisi'),
  date_end: z.string().min(1, 'Tanggal akhir wajib diisi'),
  pax: z.union([z.number(), z.string()]).optional(),
  destination: z.string().optional(),
  is_senior: z.boolean().optional(),
  international: z.boolean().optional(),
  destination_area: z.string().optional(),
  type: z.string().optional(),
  product_type: z.string().optional(),
  providers: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough();

export const insuranceBookSchema = z.object({
  contacts: z.array(contactSchema.passthrough()).min(1, 'Data kontak wajib diisi'),
  passengers: z.array(passengerSchema.passthrough()).min(1, 'Data penumpang wajib diisi'),
  booker: bookerSchema.passthrough(),
  provider: z.string().min(1, 'Provider wajib diisi'),
  carrier_code: z.string().optional(),
  total_amount: z.number().positive('total_amount harus positif'),
  product_name: z.string().optional(),
  product_code: z.string().optional(),
  package: z.union([z.number(), z.string()]).optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  destination: z.string().optional(),
  coupon_code: z.string().optional(),
});

// ─── Payment ─────────────────────────────────────────────────────────────────
export const paymentNotificationSchema = z.object({
  order_id: z.string().min(1),
  transaction_status: z.string().min(1),
  status_code: z.string(),
  signature_key: z.string(),
  transaction_id: z.string(),
  gross_amount: z.string(),
  payment_type: z.string(),
  fraud_status: z.string().optional(),
});

// ─── User ────────────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  image: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter').max(128),
});