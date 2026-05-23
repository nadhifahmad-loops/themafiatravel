import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    // Validasi wajib
    if (!body.journey_list || !Array.isArray(body.journey_list) || body.journey_list.length === 0) {
      return NextResponse.json({ error: 'journey_list tidak boleh kosong' }, { status: 400 });
    }

    const { origin, destination, departure_date } = body.journey_list[0];
    if (!origin || !destination || !departure_date) {
      return NextResponse.json({ error: 'origin, destination, dan departure_date wajib diisi' }, { status: 400 });
    }

    const payload = {
      provider: 'kai',
      direction: (body.direction || 'OW') as 'OW' | 'RT',
      journey_list: body.journey_list,
      adult: Math.max(1, Number(body.adult) || 1),
      infant: Math.max(0, Number(body.infant) || 0),
    };

    console.log('[TRAIN SEARCH] payload:', JSON.stringify(payload));

    const data = await trainAPI.search(payload);
    return NextResponse.json({ success: true, data });

  } catch (e: any) {
    console.error('[TRAIN SEARCH ERROR]', e.message);
    const status = e.orbisCode ? 422 : 500;
    return NextResponse.json({ success: false, error: e.message }, { status });
  }
}
