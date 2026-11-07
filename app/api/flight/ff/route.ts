import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Get FF (Frequent Flyer) Availability — Orbis Airline API v2.2 §3.11
 *
 * Mendapatkan daftar frequent flyer program yang tersedia.
 * Dipanggil SEBELUM update_passengers jika ingin menyertakan FF pax.
 * Request body: {} (kosong — Orbis pakai sesi internal dari sell_journeys).
 */
export async function POST(req: NextRequest) {
  // Endpoint publik yang meneruskan ke supplier Orbisway: batasi per IP agar tidak
  // bisa dipakai menguras kuota/rate limit akun supplier.
  const rl = await checkRateLimit(`flight-ff:${getClientIp(req)}`, 'search');
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  try {
    const data = await flightAPI.getFfAvailability();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg = error.message || '';

    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED' },
        { status: 410 }
      );
    }

    if (code === 4037) {
      return NextResponse.json({
        success: true,
        data: null,
        unavailable: true,
        message: 'Frequent flyer tidak tersedia untuk penerbangan ini.',
      });
    }

    console.error('[FF API Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil data frequent flyer' },
      { status: 500 }
    );
  }
}
