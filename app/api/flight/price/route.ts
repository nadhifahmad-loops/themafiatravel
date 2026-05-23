import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adult, child, infant, schedules, is_combo_price } = body;

    // ─── SENSOR PELACAK UNTUK DIBACA DI TERMINAL ───
    console.log("\n=== BENTUK ASLI SCHEDULES DARI FRONTEND ===");
    console.log(JSON.stringify(schedules, null, 2));
    console.log("===========================================\n");

    // 1. Validasi field wajib
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json({ success: false, error: 'Data jadwal kosong' }, { status: 400 });
    }

    // 2. ─── AUTO-FIX & CLEAN DATA ────────────────────
    let cleanSchedules = [];

    // KASUS A: Frontend mengirimkan struktur yang sudah benar (Punya journeys)
    if (schedules[0].journeys) {
      cleanSchedules = schedules.map((s: any) => ({
        provider: s.provider || 'citilink', // Auto fallback jika kosong
        sequence: s.sequence || 1,
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
         sequence: schedules[0].sequence || 1,
         journeys: schedules.map((j: any) => ({
           segments: (j.segments || []).map((seg: any) => ({
             segment_code: seg.segment_code,
             // Cari fare_code di berbagai kemungkinan tempat
             fare_code: seg.fare_code || seg.fares?.[0]?.fare_code || j.fare?.fare_code || j.fares?.[0]?.fare_code
           }))
         }))
       }];
    } 
    // Jika tidak ada di atas, lempar error agar ditangkap CATCH
    else {
       throw new Error('Format data jadwal sama sekali tidak dikenali oleh backend.');
    }

    console.log(`[FLIGHT PRICE] adult=${adult} | schedules=${cleanSchedules.length} | combo=${!!is_combo_price}`);

    // 3. ─── Kirim ke Orbis sesuai format docs ────────────────────
    const data = await flightAPI.getPriceItinerary({
      adult: Number(adult) || 1,
      child: Number(child) || 0,
      infant: Number(infant) || 0,
      schedules: cleanSchedules,
      is_combo_price: !!is_combo_price,
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