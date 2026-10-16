import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';

/**
 * GET SSR Availability (bagasi tambahan, makanan, dll.)
 *
 * Dipanggil SEBELUM commit_booking — menggunakan sesi sell_journeys yang aktif.
 * REQ body: {} (kosong) — Orbis pakai sesi internal
 *
 * Error codes yang BUKAN error fatal:
 *   4007 — SSR tidak tersedia untuk penerbangan ini (maskapai tidak support)
 *   4008 — tidak ada SSR yang dijual
 *   4011 — "Missing Requirements": sesi belum update_passengers (§2.4.1
 *          step 8 sebelum step 9). SSR opsional → jatuh ke fallback statis.
 * Ketiganya dikembalikan sebagai success:true + data:null agar UI bisa tampilkan fallback statis.
 */
export async function POST(req: NextRequest) {
  try {
    const data = await flightAPI.getSsrAvailability();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg  = error.message || '';

    // 4003 / 4012 / 4024 → sesi habis / sesi ganda → minta user cari ulang
    if (code === 4003 || code === 4012 || code === 4024 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    // 4007 / 4008 / 4011 → SSR memang tidak bisa diambil untuk sesi ini — BUKAN error
    // UI akan tampilkan opsi bagasi statis sebagai fallback
    if (code === 4007 || code === 4008 || code === 4011) {
      console.log(`[SSR] Kode ${code} — SSR tidak tersedia untuk penerbangan ini (normal).`);
      return NextResponse.json({
        success: true,
        data: null,
        unavailable: true,
        message: 'SSR tidak tersedia untuk penerbangan ini.',
      });
    }

    console.error('[SSR API Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil data SSR' },
      { status: 500 }
    );
  }
}
