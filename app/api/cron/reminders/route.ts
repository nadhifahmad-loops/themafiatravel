import { NextRequest, NextResponse } from 'next/server';
import { sendTripReminders } from '@/lib/reminders';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reminders = await sendTripReminders();
  return NextResponse.json({ success: true, reminders });
}
