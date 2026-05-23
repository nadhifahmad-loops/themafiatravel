import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hotelAPI } from '@/lib/orbis';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { order_number, issued_name, provider, check_only } = await req.json();

    if (check_only) {
      const refund = await hotelAPI.checkRefund(order_number, issued_name, provider);
      return NextResponse.json({ success: true, data: refund });
    }

    const data = await hotelAPI.cancelBooking(order_number, issued_name, provider);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
