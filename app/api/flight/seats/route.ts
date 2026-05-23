import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';

/**
 * GET Seat Availability — peta kursi pesawat
 *
 * Dipanggil SEBELUM commit_booking (setelah sell_journeys).
 * REQ body: {} (kosong) — Orbis pakai sesi internal.
 *
 * Error codes yang BUKAN error fatal:
 *   4008 — kursi tidak tersedia / maskapai tidak expose seat map
 *   4007 — fitur tidak tersedia
 * Keduanya dikembalikan success:true + data:null agar UI tampilkan pesan ramah.
 */
export async function POST(req: NextRequest) {
  try {
    const data = await flightAPI.getSeatAvailability();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg  = error.message || '';

    // Sesi habis
    if (code === 4011 || msg.includes('kedaluwarsa')) {
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
