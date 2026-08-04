import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`search:${ip}`, 'search');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    // FIX: Pastikan semua field wajib diteruskan sesuai doc 3.5.2.1
    // khususnya hotel_id dan search_name yang sebelumnya tidak di-forward
    const payload = {
      checkin_date: body.checkin_date,
      checkout_date: body.checkout_date,
      destination_id: body.destination_id,
      hotel_id: body.hotel_id,           // FIX: field ini wajib untuk get_details
      search_name: body.search_name ?? '', // FIX: field ini wajib ada
      adult: body.adult ?? 2,
      child: body.child ?? 0,
      child_ages: body.child_ages ?? [],
      room: body.room ?? 1,
      nationality: body.nationality ?? 'ID',
    };

    console.log('[HOTEL DETAIL] Payload ke Orbis:', payload);

    const data = await hotelAPI.getDetails(payload);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('[HOTEL DETAIL ERROR]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}