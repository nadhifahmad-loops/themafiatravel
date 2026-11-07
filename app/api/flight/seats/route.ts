import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * GET Seat Availability — peta kursi pesawat
 *
 * Dipanggil sesudah sell_journeys (§3.10), update_contacts (§3.12) dan
 * update_passengers (§3.13) — urutan wajib §2.4.1 step 5 → 6 → 8 → 11.
 * REQ body: {} (kosong) — Orbis pakai sesi internal.
 *
 * Error codes yang BUKAN error fatal:
 *   4008 — kursi tidak tersedia / maskapai tidak expose seat map
 *   4007 — fitur tidak tersedia
 * Keduanya dikembalikan success:true + data:null agar UI tampilkan pesan ramah.
 *
 * Error codes yang berarti sesi/state belum siap:
 *   4011 — "Missing Requirements" (bukan sesi expired): sesi belum
 *          update_contacts + update_passengers.
 *   4003 / 4012 / 4024 — sesi habis / sesi ganda → minta cari ulang.
 */
export async function POST(req: NextRequest) {
  // Endpoint publik yang meneruskan ke supplier Orbisway: batasi per IP agar tidak
  // bisa dipakai menguras kuota/rate limit akun supplier.
  const rl = await checkRateLimit(`flight-seats:${getClientIp(req)}`, 'search');
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  try {
    const data = await flightAPI.getSeatAvailability();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg  = error.message || '';

    // 4011 = Missing Requirements (§4.1 Codeset): sesi belum diisi
    // update_contacts + update_passengers sehingga peta kursi ditolak.
    if (code === 4011) {
      console.warn(`[Seats] 4011 Missing Requirements — sesi belum update_contacts/update_passengers: ${msg}`);
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_REQUIREMENTS',
          message:
            'Data pesanan belum siap. Lengkapi data pemesan & penumpang, lalu muat ulang peta kursi.',
        },
        { status: 428 }
      );
    }

    // 4003 (session expired), 4012 (duplicate session), 4024 (vendor expired)
    if (code === 4003 || code === 4012 || code === 4024 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    // 4008 / 4007 → seat map tidak tersedia untuk maskapai/rute ini — BUKAN error
    if (code === 4008 || code === 4007) {
      console.log(`[Seats] Kode ${code} — peta kursi tidak tersedia (normal untuk beberapa maskapai).`);
      return NextResponse.json({
        success: true,
        data: null,
        unavailable: true,
        message: 'Peta kursi tidak tersedia untuk penerbangan ini.',
      });
    }

    console.error('[Seats API Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal memuat peta kursi' },
      { status: 500 }
    );
  }
}
