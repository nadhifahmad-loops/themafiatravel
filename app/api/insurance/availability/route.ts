import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insuranceAPI } from '@/lib/orbis';
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
    const data = await insuranceAPI.getAvailability(body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
