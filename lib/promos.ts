import { prisma } from '@/lib/prisma';

/**
 * Helper untuk kartu promo homepage (tabel PromoRoute).
 * CATATAN: modul ini hanya untuk kode server. Client cukup import tipe-nya
 * dengan `import type { PromoItem } from '@/lib/promos'`.
 */

export const PROMO_SERVICES = ['flight', 'hotel', 'train'] as const;
export type PromoService = (typeof PROMO_SERVICES)[number];

/** Bentuk data yang aman dikirim ke client component (Date sudah jadi ISO string). */
export interface PromoItem {
  id: number;
  service: PromoService;
  titleId: string;
  titleEn: string | null;
  badgeId: string | null;
  badgeEn: string | null;
  image: string;
  priceFrom: number;
  validUntil: string | null;
  origin: string | null;
  destination: string | null;
  airline: string | null;
  airlineImg: string | null;
  destinationId: string | null;
  q: string | null;
  city: string | null;
  isActive: boolean;
  sortOrder: number;
}

const SELECT = {
  id: true, service: true, titleId: true, titleEn: true, badgeId: true, badgeEn: true,
  image: true, priceFrom: true, validUntil: true, origin: true, destination: true,
  airline: true, airlineImg: true, destinationId: true, q: true, city: true,
  isActive: true, sortOrder: true,
} as const;

type PromoRow = Omit<PromoItem, 'validUntil' | 'service'> & {
  service: string;
  validUntil: Date | null;
};

function serialize(row: PromoRow): PromoItem {
  return {
    ...row,
    service: row.service as PromoService,
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
  };
}

export function isPromoService(value: unknown): value is PromoService {
  return typeof value === 'string' && (PROMO_SERVICES as readonly string[]).includes(value);
}

/** Promo aktif & belum lewat masa berlaku — dipakai homepage & endpoint publik. */
export async function getActivePromos(): Promise<PromoItem[]> {
  const now = new Date();
  const rows = await prisma.promoRoute.findMany({
    where: {
      isActive: true,
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    select: SELECT,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  return rows.map(serialize);
}

/* ─── Validasi input admin ─────────────────────────────────────────────────── */

export type PromoPayload = Omit<PromoItem, 'id' | 'isActive' | 'sortOrder'> & {
  isActive: boolean;
  sortOrder: number;
};

type RawInput = Partial<Record<keyof PromoItem, unknown>>;

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};

/**
 * Normalisasi + validasi body request admin.
 * Mengembalikan `{ data }` bila valid, atau `{ error }` dengan pesan siap tampil.
 */
export function normalizePromo(body: unknown): { data: PromoPayload } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Data promo tidak valid.' };
  const b = body as RawInput;

  if (!isPromoService(b.service)) return { error: 'Layanan harus "flight", "hotel", atau "train".' };

  const titleId = str(b.titleId);
  if (!titleId) return { error: 'Judul promo wajib diisi.' };

  const image = str(b.image);
  if (!image) return { error: 'Gambar wajib diisi.' };

  const priceFrom = typeof b.priceFrom === 'number' ? b.priceFrom : Number(b.priceFrom);
  if (!Number.isFinite(priceFrom) || priceFrom <= 0) return { error: 'Harga harus lebih dari 0.' };

  let validUntil: Date | null = null;
  if (b.validUntil !== null && b.validUntil !== undefined && b.validUntil !== '') {
    const d = new Date(String(b.validUntil));
    if (Number.isNaN(d.getTime())) return { error: 'Masa berlaku tidak valid.' };
    validUntil = d;
  }

  const origin = str(b.origin);
  const destination = str(b.destination);

  if (b.service === 'hotel') {
    if (!str(b.destinationId)) return { error: 'Kode destinasi hotel wajib diisi.' };
  } else if (!origin || !destination) {
    return { error: `Asal & tujuan wajib diisi untuk promo ${b.service === 'flight' ? 'pesawat' : 'kereta'}.` };
  }

  const sortOrder = Number.isFinite(Number(b.sortOrder)) ? Math.max(0, Math.trunc(Number(b.sortOrder))) : 0;

  return {
    data: {
      service: b.service,
      titleId,
      titleEn: str(b.titleEn),
      badgeId: str(b.badgeId),
      badgeEn: str(b.badgeEn),
      image,
      priceFrom: Math.round(priceFrom),
      validUntil: validUntil ? validUntil.toISOString() : null,
      origin,
      destination,
      airline: str(b.airline),
      airlineImg: str(b.airlineImg),
      destinationId: str(b.destinationId),
      q: str(b.q),
      city: str(b.city),
      isActive: b.isActive !== false,
      sortOrder,
    },
  };
}
