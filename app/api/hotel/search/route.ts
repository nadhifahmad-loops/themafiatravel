import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { hotelSearchSchema, validateBody } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak pencarian. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body tidak valid.' }, { status: 400 });
    }

    // Validasi field wajib siapa pun tidak bisa melewati
    const validation = validateBody(hotelSearchSchema, body);
    if (!validation.success) return validation.response;
    const v = validation.data;

    if (!v.destination_id) {
      return NextResponse.json({ error: 'destination_id wajib diisi' }, { status: 400 });
    }
    if (!v.checkin_date || !v.checkout_date) {
      return NextResponse.json({ error: 'Tanggal check-in dan check-out wajib diisi' }, { status: 400 });
    }

    const payload: any = {
      checkin_date: v.checkin_date,
      checkout_date: v.checkout_date,
      destination_id: v.destination_id,
      search_name: v.search_name ?? '',   // FIX: field ini wajib ada (lihat doc 3.4.2.1)
      adult: Number(v.adult) || 2,
      child: Number(v.child) || 0,
      child_ages: v.child_ages?.map((n: string | number) => Number(n)) ?? [],
      room: Number(v.room) || 1,
      nationality: v.nationality ?? 'ID',
    };

    // Opsional: jika ada hotel_id (direct search by hotel code, doc 3.4)
    if (v.hotel_id) {
      payload.hotel_id = v.hotel_id;
    }

    console.log('[HOTEL SEARCH] Payload ke Orbis:', payload);

    const data = await hotelAPI.search(payload);

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('[HOTEL SEARCH ERROR]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
