import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { flightAPI, OrbisSchedule } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`lock:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { adult, child, infant, schedules } = body;

    // 1. Validasi data jadwal
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Data jadwal penerbangan tidak ditemukan.' },
        { status: 400 }
      );
    }

    console.log('[Flight Lock] Memproses penguncian kursi (sell_journeys)...');

    // 2. Tembak API Orbis untuk mengunci jadwal (sell_journeys) — §3.10
    await flightAPI.sellJourneys({
      adult: Number(adult) || 1,
      child: Number(child) || 0,
      infant: Number(infant) || 0,
      schedules: schedules as OrbisSchedule[],
      promo_codes: [],
    });

    console.log('[Flight Lock] ✅ sell_journeys berhasil');
    return NextResponse.json({ success: true, message: 'Jadwal berhasil dikunci.' });

  } catch (error: any) {
    const code = (error as any).orbisCode;
    const msg = error.message || 'Gagal mengunci jadwal';
    
    console.error('[Flight Lock Error]', code, msg);

    if (code === 4014 || msg.includes('dikunci sebelumnya')) {
      console.log('[Flight Lock] 4014 — Jadwal sudah terkunci sebelumnya, lanjut aman.');
      return NextResponse.json({ success: true, message: 'Jadwal sudah terkunci sebelumnya.' });
    }
    
    if (code === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED', message: 'Sesi pencarian habis.' },
        { status: 410 }
      );
    }

    if (code === 4016 || msg.includes('Schedule is not available') || msg.includes('fare class')) {
      return NextResponse.json(
        { success: false, error: 'FARE_UNAVAILABLE', message: 'Kelas kursi tidak tersedia. Silakan pilih penerbangan lain.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}