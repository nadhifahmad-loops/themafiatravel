import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';

/**
 * Get Fare Rules — Orbis Airline API v2.2 §3.9
 *
 * Request structure sama dengan §3.8 (Get Price Itinerary):
 * { adult, child, infant, schedules: [{ journeys: [{ segments }], provider }], promo_codes }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adult, child, infant, schedules } = body;

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json({ success: false, error: 'Data jadwal kosong' }, { status: 400 });
    }

    let cleanSchedules = [];

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
    } else if (schedules[0].segments) {
      cleanSchedules = [{
        provider: schedules[0].provider || body.provider || 'citilink',
        journeys: schedules.map((j: any) => ({
          segments: (j.segments || []).map((seg: any) => ({
            segment_code: seg.segment_code,
            fare_code: seg.fare_code || seg.fares?.[0]?.fare_code || j.fare?.fare_code || j.fares?.[0]?.fare_code
          }))
        }))
      }];
    } else {
      throw new Error('Format data jadwal sama sekali tidak dikenali oleh backend.');
    }

    console.log(`[FLIGHT FARE RULES] adult=${adult} | schedules=${cleanSchedules.length}`);

    const data = await flightAPI.getFareRules({
      adult: Number(adult) || 1,
      child: Number(child) || 0,
      infant: Number(infant) || 0,
      schedules: cleanSchedules,
      promo_codes: [],
    });

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    const orbisCode = (error as any).orbisCode;
    const msg = error.message || 'Gagal mengambil fare rules';

    console.error('[Flight Fare Rules Error]', msg);

    if (orbisCode === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'SESSION_EXPIRED', message: 'Sesi pencarian telah berakhir.' },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { success: false, error: msg },
      { status: 400 }
    );
  }
}
