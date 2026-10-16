// ============================================================
// IDEMPOTENCY — Anti double-order untuk endpoint booking
// Dipakai oleh: flight, hotel, train, insurance book
//
// MASALAH YANG DISELESAIKAN
//   User menekan tombol checkout 2× cepat (atau retry jaringan / duplikat
//   lintas tab) sehingga dua request identik masuk. Tanpa pengaman, keduanya
//   mengeksekusi commit_booking di Orbis + membuat dua transaksi Midtrans.
//
// CARA KERJA
//   Client menghasilkan SATU UUID per attempt checkout lalu mengirimkannya
//   sebagai header `Idempotency-Key`. Karena kedua klik berasal dari attempt
//   yang sama, key-nya identik — server cukup bertanya "key ini sudah pernah
//   diproses?".
//
//   Klaim dilakukan dengan INSERT ke tabel `IdempotencyKey` yang primary
//   key-nya unik. Dari beberapa request paralel, HANYA SATU yang berhasil
//   INSERT (pemenang race) — sisanya kalah P2002 lalu membaca status baris:
//     • completed  → kembalikan response yang tersimpan (duplicate: true)
//                    (true idempotency: hasil sama, bukan error)
//     • processing → 409 IN_PROGRESS — request pertama masih berjalan
//     • conflict   → 409 IDEMPOTENCY_CONFLICT — key dipakai payload lain
//
//   Setelah handler selesai:
//     • 2xx + success:true → `completed` (response disimpan SEBELUM dikirim,
//       sehingga bila responsenya hilang di jaringan, retry tetap memperoleh
//       hasil yang sama alih-alih membuat order baru).
//     • selain itu         → baris DIHAPUS, sehingga user boleh retry.
//
// KOMPATIBILITAS MUNDUR
//   Client yang tidak mengirim key → `absent` → route berjalan persis seperti
//   sebelumnya. Tidak ada perubahan pada model Booking / Payment, sehingga
//   seluruh flow downstream (webhook Midtrans, penerbitan tiket, refund,
//   expire cron, e-tiket) tidak terpengaruh.
// ============================================================

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type BookingType = 'flight' | 'hotel' | 'train' | 'insurance';

/** Baris `processing` yang lebih tua dari ini dianggap crash/abandoned dan boleh di-reclaim. */
export const PROCESSING_TTL_MS = 10 * 60 * 1000;
/** Baris `completed` disimpan cukup lama untuk menangani retry yang sangat telat, lalu dibersihkan cron. */
export const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000;

// Key terlalu pendek hampir pasti bukan UUID (client kita mengirim 36 karakter).
// Menganggapnya absent mencegah satu user mengunci dirinya sendiri selamanya.
const MIN_KEY_LENGTH = 8;

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Kode `PrismaClientKnownRequestError` — mis. `P2002` = unique constraint violation. */
function prismaErrorCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null || !('code' in e)) return undefined;
  const code = (e as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export type IdempotencyClaim =
  | { state: 'absent'; key: null }
  | { state: 'started'; key: string }
  | { state: 'completed'; key: string; response: Record<string, unknown> }
  | { state: 'processing'; key: string }
  | { state: 'conflict'; key: string };

// ── Pembersihan (dipanggil cron expire-bookings) ─────────────────────────────
/**
 * Menghapus baris idempotency yang sudah kedaluwarsa.
 *
 * • `completed`  → dihapus begitu `expiresAt` lewat (created/completed + 24 jam).
 *                  Cukup lama untuk menangani retry yang sangat telat.
 * • `processing` → TIDAK ikut begitu `expiresAt` lewat, karena `expiresAt`
 *                  adalah batas reclaim (10 menit). Bila baris ini langsung
 *                  dihapus, retry setelah crash tidak lagi bisa menemukan
 *                  Booking yang sempat tersimpan → order ganda. Baris hanya
 *                  dibuang setelah `PROCESSING_RETENTION_MS` tambahan lewat.
 */
export const PROCESSING_RETENTION_MS = 60 * 60 * 1000;

export async function cleanupIdempotencyKeys(now = new Date()): Promise<number> {
  try {
    const processingCutoff = new Date(now.getTime() - PROCESSING_RETENTION_MS);
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        OR: [
          { status: 'completed', expiresAt: { lte: now } },
          { status: 'processing', expiresAt: { lte: processingCutoff } },
        ],
      },
    });
    if (result.count > 0) console.log(`[Idempotency] Cleanup: ${result.count} baris kedaluwarsa dihapus.`);
    return result.count;
  } catch (e) {
    console.warn('[Idempotency] Cleanup gagal (non-fatal):', errMessage(e));
    return 0;
  }
}

// ── Fingerprint payload ─────────────────────────────────────────────────────
// JSON.stringify biasa sensitif terhadap urutan key. Dua request yang isinya
// sama persis bisa menghasilkan string berbeda bila urutan property beda,
// sehingga dianggap "bukan duplikat". Kunci diurutkan rekursif dulu supaya
// fingerprint-nya stabil.

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const v = canonicalize(source[key]);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  return JSON.stringify(canonicalize(value) ?? null);
}

export function hashPayload(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

// ── Bentuk record key ───────────────────────────────────────────────────────
// `userId = NULL` (guest) harus ikut menjamin keunikan. Postgres menganggap
// NULL ≠ NULL, jadi unique constraint biasa bisa bocor untuk guest (dua guest
// sama-sama INSERT). Dengan menggabungkan semuanya ke satu PK tunggal,
// keunikan menjadi pasti untuk login maupun guest.
export function buildRecordKey(bookingType: string, userId: string | null | undefined, rawKey: string): string {
  return `${bookingType}:${userId || 'anon'}:${rawKey}`;
}

function normalizeRawKey(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length >= MIN_KEY_LENGTH ? trimmed : null;
}

/**
 * Fallback bila client tidak mengirim header `Idempotency-Key` dan malah
 * menaruhnya di body request. Header diprioritaskan karena tidak melewati
 * validasi skema body.
 */
export function readBodyIdempotencyKey(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>).idempotency_key;
  return typeof value === 'string' ? value : null;
}

// ── Klaim ───────────────────────────────────────────────────────────────────
export async function claimIdempotency(input: {
  rawKey: string | null | undefined;
  bookingType: BookingType;
  userId: string | null | undefined;
  payloadHash: string;
}): Promise<IdempotencyClaim> {
  const rawKey = normalizeRawKey(input.rawKey);
  if (!rawKey) return { state: 'absent', key: null };

  const key = buildRecordKey(input.bookingType, input.userId, rawKey);
  const ownerUserId = input.userId ?? null;

  // INSERT atomik — hanya satu dari beberapa request paralel yang menang.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.idempotencyKey.create({
        data: {
          key,
          bookingType: input.bookingType,
          userId: ownerUserId,
          payloadHash: input.payloadHash,
          status: 'processing',
          expiresAt: new Date(Date.now() + PROCESSING_TTL_MS),
        },
      });
      return { state: 'started', key };
    } catch (e) {
      if (prismaErrorCode(e) !== 'P2002') {
        // Gangguan DB pada klaim: JANGAN jalankan booking tanpa pengaman.
        // Lebih baik user mengulang daripada risiko double order.
        console.error('[Idempotency] Claim gagal:', errMessage(e));
        return { state: 'processing', key };
      }
    }

    const existing = await prisma.idempotencyKey.findUnique({ where: { key } }).catch(() => null);
    // Baris baru saja dihapus (attempt sebelumnya gagal) → coba INSERT ulang.
    if (!existing) continue;

    // Key milik user lain tidak boleh membocorkan response mereka.
    if ((existing.userId ?? null) !== ownerUserId) return { state: 'conflict', key };

    // Key yang sama tetapi isi request berbeda = intent berbeda → tolak,
    // jangan dicampur. (Frontend me-regenerate key setelah gagal, jadi kasus
    // ini hanya mungkin terjadi pada client yang tidak mematuhi kontrak.)
    if (existing.payloadHash !== input.payloadHash) return { state: 'conflict', key };

    if (existing.status === 'completed') {
      return {
        state: 'completed',
        key,
        response: (existing.response as Record<string, unknown> | null) ?? {},
      };
    }

    if (existing.expiresAt.getTime() > Date.now()) return { state: 'processing', key };

    // ── Baris `processing` kedaluwarsa → crash di tengah proses ──────────────
    // Bila orderId sempat dicatat, kemungkinan besar Booking SUDAH tersimpan
    // sebelum proses terputus. Kembalikan booking itu daripada mengeksekusi
    // ulang (yang akan menghasilkan order kedua).
    if (existing.orderId) {
      try {
        const booking = await prisma.booking.findUnique({
          where: { id: existing.orderId },
          select: { id: true },
        });
        if (booking) {
          return {
            state: 'completed',
            key,
            response:
              (existing.response as Record<string, unknown> | null) ??
              ({ success: true, orderId: existing.orderId, duplicate: true } as Record<string, unknown>),
          };
        }
      } catch {
        /* lanjut ke reclaim */
      }
    }

    // Reclaim atomik: hanya bila baris masih `processing` DAN masih kedaluwarsa
    // (WHERE status lama disertakan agar tidak menimpa request yang menang race).
    try {
      const reclaimed = await prisma.idempotencyKey.updateMany({
        where: { key, status: 'processing', expiresAt: { lte: new Date() } },
        data: { expiresAt: new Date(Date.now() + PROCESSING_TTL_MS), orderId: null },
      });
      if (reclaimed.count === 1) return { state: 'started', key };
    } catch {
      /* jatuh ke bawah */
    }
    return { state: 'processing', key };
  }

  return { state: 'processing', key };
}

// ── Penanda pemulihan ───────────────────────────────────────────────────────
// Dipanggil SEGERA setelah generateBookingId dan SEBELUM bookingStore.create,
// sehingga bila proses crash di antaranya, klaim kedua tahu harus memeriksa
// Booking mana yang mungkin sudah tersimpan.
export async function recordIdempotencyOrderId(key: string | null, orderId: string): Promise<void> {
  if (!key) return;
  try {
    await prisma.idempotencyKey.updateMany({
      where: { key, status: 'processing' },
      data: { orderId },
    });
  } catch (e) {
    console.warn('[Idempotency] Gagal mencatat orderId (non-fatal):', errMessage(e));
  }
}

// ── Finalisasi ──────────────────────────────────────────────────────────────
export async function completeIdempotency(key: string, response: Record<string, unknown>): Promise<void> {
  try {
    await prisma.idempotencyKey.updateMany({
      where: { key },
      data: {
        status: 'completed',
        response: response as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + COMPLETED_TTL_MS),
      },
    });
  } catch (e) {
    console.warn('[Idempotency] Gagal menyimpan response (non-fatal):', errMessage(e));
  }
}

// Menghapus klaim SETELAH kegagalan agar user diperbolehkan mencoba lagi.
export async function releaseIdempotency(key: string | null): Promise<void> {
  if (!key) return;
  try {
    await prisma.idempotencyKey.deleteMany({ where: { key } });
  } catch (e) {
    console.warn('[Idempotency] Gagal melepas klaim (non-fatal):', errMessage(e));
  }
}

/**
 * Menentukan nasib klaim berdasarkan hasil handler:
 *  • sukses (2xx + success:true) → `completed`, response di-cache untuk replay
 *  • lainnya (validasi/gagal/5xx) → baris dihapus supaya retry diperbolehkan
 */
export async function settleIdempotency(claim: IdempotencyClaim, res: NextResponse): Promise<void> {
  if (claim.state !== 'started') return;

  try {
    if (res.status >= 200 && res.status < 300) {
      const data = (await res.clone().json()) as Record<string, unknown> | null;
      if (data && data.success === true) {
        await completeIdempotency(claim.key, data);
        return;
      }
    }
  } catch (e) {
    console.warn('[Idempotency] Gagal membaca response untuk disimpan:', errMessage(e));
  }

  await releaseIdempotency(claim.key);
}

// ── Response baku untuk kondisi duplikat ─────────────────────────────────────
function inProgressResponse(key: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'IN_PROGRESS',
      message: 'Pesanan Anda sedang diproses. Mohon tunggu sebentar.',
    },
    { status: 409, headers: { 'Retry-After': '2', 'X-Idempotency-Key': key } },
  );
}

function conflictResponse(key: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'IDEMPOTENCY_CONFLICT',
      message: 'Permintaan duplikat dengan isi berbeda terdeteksi. Silakan muat ulang halaman lalu coba lagi.',
    },
    { status: 409, headers: { 'X-Idempotency-Key': key } },
  );
}

function completedResponse(claim: Extract<IdempotencyClaim, { state: 'completed' }>): NextResponse {
  return NextResponse.json({ success: true, duplicate: true, ...claim.response }, {
    headers: { 'X-Idempotency-Key': claim.key, 'X-Idempotency-Duplicate': '1' },
  });
}

/**
 * Pembungkus: klaim → jalankan handler → setel nasib klaim.
 *
 * `run` menerima `idempotencyKey` (null bila klaim `absent`) untuk dipakai
 * mencatat orderId di tengah flow. Body request sudah dibaca SEBELUM fungsi
 * ini dipanggil karena stream NextRequest hanya bisa dibaca sekali.
 */
export async function withIdempotency(opts: {
  rawKey: string | null | undefined;
  bookingType: BookingType;
  userId: string | null | undefined;
  payloadHash: string;
  run: (idempotencyKey: string | null) => Promise<NextResponse>;
}): Promise<NextResponse> {
  const claim = await claimIdempotency({
    rawKey: opts.rawKey,
    bookingType: opts.bookingType,
    userId: opts.userId,
    payloadHash: opts.payloadHash,
  });

  if (claim.state === 'completed') return completedResponse(claim);
  if (claim.state === 'processing') return inProgressResponse(claim.key);
  if (claim.state === 'conflict') return conflictResponse(claim.key);

  // Bila handler melempar exception, klaim tetap harus dilepas — kalau tidak,
  // baris `processing` akan mengunci user selama TTL 10 menit.
  let res: NextResponse;
  try {
    res = await opts.run(claim.key);
  } catch (e) {
    await releaseIdempotency(claim.key);
    throw e;
  }

  await settleIdempotency(claim, res);
  return res;
}
