import { NextRequest, NextResponse } from 'next/server';
import { contentAPI } from '@/lib/orbis';

/**
 * Get Destination List — Orbis Airline API v2.2 §3.4 (via /content endpoint §2.1.3)
 *
 * Mendapatkan daftar destinasi/kota yang tersedia.
 * Request: {} (kosong)
 */
export async function POST(_req: NextRequest) {
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
