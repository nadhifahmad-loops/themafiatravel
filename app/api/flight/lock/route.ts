import { NextRequest, NextResponse } from 'next/server';
import { flightAPI, OrbisSchedule } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adult, child, infant, schedules, is_combo_price } = body;

    // 1. Validasi data jadwal
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Data jadwal penerbangan tidak ditemukan.' },
        { status: 400 }
      );
    }

    console.log('[Flight Lock] Memproses penguncian kursi (sell_journeys)...');

    // 2. Tembak API Orbis untuk mengunci jadwal (sell_journeys)
    await flightAPI.sellJourneys({
      adult: Number(adult) || 1,
      child: Number(child) || 0,
      infant: Number(infant) || 0,
      schedules: schedules as OrbisSchedule[],
      is_combo_price: !!is_combo_price,
      promo_codes: [],
    });

    console.log('[Flight Lock] ✅ sell_journeys berhasil');
    return NextResponse.json({ success: true, message: 'Jadwal berhasil dikunci.' });

  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg = error.message || 'Gagal mengunci jadwal';
    
    console.error('[Flight Lock Error]', code, msg);

    // Jika error 4014 (Sudah dikunci sebelumnya), kita abaikan dan anggap SUKSES
    if (code === 4014 || msg.includes('dikunci sebelumnya')) {
      console.log('[Flight Lock] 4014 — Jadwal sudah terkunci sebelumnya, lanjut aman.');
      return NextResponse.json({ success: true, message: 'Jadwal sudah terkunci sebelumnya.' });
    }
    
    // Jika sesi habis (4011)
    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED', message: 'Sesi pencarian habis.' },
        { status: 410 }
      );
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}