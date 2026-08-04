import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';
import { trainSearchSchema, validateBody } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak pencarian. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Request body tidak valid.' }, { status: 400 });
    }

    const validation = validateBody(trainSearchSchema, body);
    if (!validation.success) return validation.response;
    const v = validation.data;

    // Validasi wajib (lapisan kedua setelah skema)
    if (!Array.isArray(v.journey_list) || v.journey_list.length === 0) {
      return NextResponse.json({ error: 'journey_list tidak boleh kosong' }, { status: 400 });
    }

    const { origin, destination, departure_date } = v.journey_list[0];
    if (!origin || !destination || !departure_date) {
      return NextResponse.json({ error: 'origin, destination, dan departure_date wajib diisi' }, { status: 400 });
    }

    const payload = {
      provider: 'kai',
      direction: (v.direction || 'OW') as 'OW' | 'RT',
      journey_list: v.journey_list,
      adult: Math.max(1, Number(v.adult) || 1),
      infant: Math.max(0, Number(v.infant) || 0),
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
