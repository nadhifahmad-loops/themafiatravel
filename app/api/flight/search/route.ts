import { NextRequest, NextResponse } from 'next/server';
import { flightAPI } from '@/lib/orbis';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Hapus sesi yang sudah lebih dari 15 menit
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.orbisSession.deleteMany({
      where: { createdAt: { lt: fifteenMinsAgo } },
    });

    const body = await req.json();
    const isRT    = body.direction === 'RT';
    const isMulti = body.direction === 'Multi';
    const providerToSearch = body.provider || 'citilink';

    // ─── Bangun journey_list ────────────────────────────────────────────────
    let journey_list: { origin: string; destination: string; departure_date: string }[] = [];

    if (isMulti && Array.isArray(body.routes) && body.routes.length > 0) {
      // Multi-kota: gunakan routes array langsung
      journey_list = body.routes.map((r: any) => ({
        origin:         r.origin,
        destination:    r.destination,
        departure_date: r.departure_date,
      }));
    } else if (Array.isArray(body.journey_list) && body.journey_list.length > 0) {
      journey_list = body.journey_list;
    } else {
      journey_list.push({
        origin:         body.origin,
        destination:    body.destination,
        departure_date: body.departure_date,
      });
      if (isRT && body.return_date) {
        journey_list.push({
          origin:         body.destination,
          destination:    body.origin,
          departure_date: body.return_date,
        });
      }
    }

    // Validasi
    for (const j of journey_list) {
      if (!j.origin || !j.destination || !j.departure_date) {
        return NextResponse.json(
          { success: false, error: 'Data rute tidak lengkap (origin/destination/departure_date).' },
          { status: 400 }
        );
      }
    }

    console.log(
      `[FLIGHT SEARCH] Provider: ${providerToSearch} | ${journey_list.map(j => `${j.origin}→${j.destination}`).join(', ')} | dir: ${body.direction || 'OW'}`
    );

    const data = await flightAPI.search({
      provider:       providerToSearch,
      journey_list,
      adult:          Number(body.adult)  || 1,
      child:          Number(body.child)  || 0,
      infant:         Number(body.infant) || 0,
      cabin_class:    body.cabin_class    || 'Y',
      carrier_codes:  body.carrier_codes  || [],
      is_combo_price: body.is_combo_price ?? isRT,
      promo_codes:    [],
    });

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    const orbisCode = (error as any).orbisCode;
    const msg       = error.message || 'Gagal mencari penerbangan';
    console.error('[Flight Search Error]', msg);

    if (orbisCode === 4011 || msg.includes('kedaluwarsa')) {
      return NextResponse.json(
        { success: false, error: 'Sesi kedaluwarsa. Silakan cari ulang.' },
        { status: 410 }
      );
    }
    if (msg.includes('sibuk') || msg.includes('503') || msg.includes('502')) {
      return NextResponse.json(
        { success: false, error: 'Sistem maskapai sedang sibuk.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
