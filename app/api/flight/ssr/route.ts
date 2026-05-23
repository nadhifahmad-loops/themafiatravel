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
 * Keduanya dikembalikan sebagai success:true + data:null agar UI bisa tampilkan fallback statis.
 */
export async function POST(req: NextRequest) {
  try {
    const data = await flightAPI.getSsrAvailability();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg  = error.message || '';

    // Sesi habis → minta user cari ulang
    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    // 4007 / 4008 → SSR memang tidak tersedia untuk penerbangan ini — BUKAN error
    // UI akan tampilkan opsi bagasi statis sebagai fallback
    if (code === 4007 || code === 4008) {
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
