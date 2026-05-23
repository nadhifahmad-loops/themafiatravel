import { NextRequest, NextResponse } from 'next/server';
import { insuranceAPI } from '@/lib/orbis';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await insuranceAPI.getBooking((await params).id);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}