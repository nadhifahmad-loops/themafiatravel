import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trainAPI } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { fare_codes, provider } = body;

    if (!fare_codes || !Array.isArray(fare_codes) || fare_codes.length === 0) {
      return NextResponse.json({ success: false, error: 'fare_codes wajib diisi' }, { status: 400 });
    }

    const data = await trainAPI.getSeatAvailability({
      fare_codes,
      provider: provider || 'kai',
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('[Train Seat Availability ERROR]', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
