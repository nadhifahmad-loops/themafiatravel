export const HOTEL_PROVIDER_UNAVAILABLE = 'HOTEL_PROVIDER_UNAVAILABLE';

export const HOTEL_OUTAGE_MESSAGE =
  'Layanan hotel sedang mengalami gangguan koneksi ke vendor. Silakan coba lagi dalam beberapa saat.';

type OrbisLikeError = {
  orbisCode?: unknown;
  message?: unknown;
};

export type HotelApiErrorInfo = {
  status: number;
  code?: string;
  message: string;
  orbisCode?: number;
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as OrbisLikeError).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

export function getOrbisErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return asNumber((error as OrbisLikeError).orbisCode);
}

/**
 * 9952 bukan bagian dari Codeset 4.1 resmi. Kode ini dikirim Orbis ketika
 * gateway mereka gagal menghubungi layanan hotel vendor. Perlakukan sebagai
 * gangguan layanan (503), bukan error validasi atau hasil kosong.
 */
export function isHotelProviderOutage(error: unknown): boolean {
  return getOrbisErrorCode(error) === 9952
    || /connection error to hotel webservice/i.test(getRawMessage(error));
}

/**
 * Terjemahkan error Orbis hotel menjadi status HTTP + pesan yang aman
 * ditampilkan ke pengguna. Pesan mentah vendor tidak pernah diteruskan.
 */
export function resolveHotelApiError(error: unknown, fallback: string): HotelApiErrorInfo {
  const orbisCode = getOrbisErrorCode(error);

  if (isHotelProviderOutage(error)) {
    return {
      status: 503,
      code: HOTEL_PROVIDER_UNAVAILABLE,
      message: HOTEL_OUTAGE_MESSAGE,
      orbisCode,
    };
  }

  switch (orbisCode) {
    case 4005:
      return {
        status: 503,
        code: 'HOTEL_PROVIDER_UNAVAILABLE',
        message: 'Provider hotel sedang tidak tersedia. Silakan coba lagi dalam beberapa saat.',
        orbisCode,
      };
    case 4011:
      return {
        status: 410,
        code: 'HOTEL_SESSION_EXPIRED',
        message: 'Sesi pencarian hotel sudah kedaluwarsa. Silakan cari ulang kamar.',
        orbisCode,
      };
    case 4014:
      return {
        status: 409,
        code: 'HOTEL_REQUEST_ALREADY_PROCESSED',
        message: 'Permintaan ini sudah diproses sebelumnya. Muat ulang status pesanan sebelum mencoba lagi.',
        orbisCode,
      };
    case 4006:
      return {
        status: 409,
        code: 'HOTEL_PRICE_CHANGED',
        message: 'Harga atau ketersediaan kamar berubah. Silakan cari ulang kamar.',
        orbisCode,
      };
    case 4022:
    case 4043:
      return {
        status: 422,
        code: 'HOTEL_CANCEL_NOT_ALLOWED',
        message:
          'Pembatalan belum dapat diproses vendor. Kemungkinan sudah melewati batas pembatalan atau kebijakan hotel tidak mengizinkan. Hubungi customer service bila perlu.',
        orbisCode,
      };
    case 4023:
      return {
        status: 404,
        code: 'HOTEL_BOOKING_NOT_FOUND',
        message: 'Data reservasi hotel tidak ditemukan di vendor. Hubungi customer service untuk bantuan.',
        orbisCode,
      };
    default:
      return {
        status: orbisCode ? 502 : 500,
        code: orbisCode ? 'HOTEL_VENDOR_ERROR' : undefined,
        message: fallback,
        orbisCode,
      };
  }
}
