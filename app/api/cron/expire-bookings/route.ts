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

// Vercel Cron memanggil endpoint dengan HTTP GET (bukan POST). Otorisasi tetap
// diperiksa di handler POST lewat CRON_SECRET.
export async function GET(req: NextRequest) {
  return POST(req);
}
