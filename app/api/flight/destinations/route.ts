import { NextRequest, NextResponse } from 'next/server';
import { contentAPI } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Get Destination List — Orbis Airline API v2.2 §3.4 (via /content endpoint §2.1.3)
 *
 * Mendapatkan daftar destinasi/kota yang tersedia.
 * Request: {} (kosong)
 */
export async function POST(req: NextRequest) {
  // Endpoint publik yang meneruskan ke supplier Orbisway: batasi per IP agar tidak
  // bisa dipakai menguras kuota/rate limit akun supplier.
  const rl = await checkRateLimit(`flight-destinations:${getClientIp(req)}`, 'search');
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  try {
    const data = await contentAPI.getDestinations();
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

    if (code === 4015) {
      return NextResponse.json({
        success: true,
        data: null,
        unavailable: true,
        message: 'Destinasi tidak tersedia untuk provider ini.',
      });
    }

    console.error('[Destinations API Error]', code, msg);
    return NextResponse.json(
      { success: false, error: msg || 'Gagal mengambil data destinasi' },
      { status: 500 }
    );
  }
}
