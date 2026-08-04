import { NextRequest, NextResponse } from 'next/server';
import { expireUnpaidBookings } from '@/lib/booking-expiry';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expired = await expireUnpaidBookings();
  return NextResponse.json({ success: true, expired });
}
