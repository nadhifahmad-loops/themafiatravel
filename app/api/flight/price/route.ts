import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // Endpoint publik yang meneruskan ke supplier Orbisway: batasi per IP agar tidak
  // bisa dipakai menguras kuota/rate limit akun supplier.
  const rl = await checkRateLimit(`flight-price:${getClientIp(req)}`, 'search');
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    );
  }

  try {
    const body = await req.json();
    const { adult, child, infant, schedules } = body;

    // 1. Validasi field wajib
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json({ success: false, error: 'Data jadwal kosong' }, { status: 400 });
    }

    // 2. ─── AUTO-FIX & CLEAN DATA sesuai §3.8.1 ────────────────────
    // Struktur bersih: { journeys: [{ segments: [{segment_code, fare_code}] }], provider }
    let cleanSchedules = [];

    // KASUS A: Frontend mengirimkan struktur yang sudah benar (Punya journeys)
    if (schedules[0].journeys) {
      cleanSchedules = schedules.map((s: any) => ({
        provider: s.provider || 'citilink',
        journeys: s.journeys.map((j: any) => ({
          segments: (j.segments || []).map((seg: any) => ({
            segment_code: seg.segment_code,
            fare_code: seg.fare_code || seg.fares?.[0]?.fare_code || j.fare?.fare_code
          }))
        }))
      }));
    } 
    // KASUS B: Frontend malah ngirim array of "journey" langsung (Punya segments, tanpa journeys)
    else if (schedules[0].segments) {
       cleanSchedules = [{
         provider: schedules[0].provider || body.provider || 'citilink',
         journeys: schedules.map((j: any) => ({
           segments: (j.segments || []).map((seg: any) => ({
             segment_code: seg.segment_code,
             fare_code: seg.fare_code || seg.fares?.[0]?.fare_code || j.fare?.fare_code || j.fares?.[0]?.fare_code
           }))
         }))
       }];
    } 
    // Jika tidak ada di atas, lempar error agar ditangkap CATCH
    else {
       throw new Error('Format data jadwal sama sekali tidak dikenali oleh backend.');
    }

    console.log(`[FLIGHT PRICE] adult=${adult} | schedules=${cleanSchedules.length}`);

    // 3. ─── Kirim ke Orbis sesuai format docs §3.8 ────────────────────
    const data = await flightAPI.getPriceItinerary({
      adult: Number(adult) || 1,
      child: Number(child) || 0,
      infant: Number(infant) || 0,
      schedules: cleanSchedules,
      promo_codes: [],
    });

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    const orbisCode = (error as any).orbisCode;
    const msg = error.message || 'Gagal memvalidasi harga tiket';

    console.error('[Flight Price Error]', msg);

    if (orbisCode === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED', message: 'Sesi pencarian telah berakhir.' },
        { status: 410 }
      );
    }

    if (msg.includes('sibuk') || msg.includes('503') || msg.includes('502')) {
      return NextResponse.json(
        { success: false, error: 'Sistem maskapai sedang sibuk. Coba lagi dalam beberapa saat.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: msg },
      { status: 400 } // Ubah jadi 400 agar langsung dilempar ke error frontend
    );
  }
}