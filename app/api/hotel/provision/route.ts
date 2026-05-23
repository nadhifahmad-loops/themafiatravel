import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { hotel_code, price_code } = await req.json();
    const data = await hotelAPI.provision(hotel_code, price_code);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    // error_code 4006 = price changed — still return data
    return NextResponse.json({ error: e.message, priceChanged: true }, { status: 200 });
  }
}
