import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bookingStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;

    // Gunakan getUserBookingsByType untuk filter per tipe
    const bookings = await bookingStore.getUserBookingsByType(userId, 'flight');

    return NextResponse.json({ success: true, data: bookings });
  } catch (error: any) {
    console.error('[Flight Bookings GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}