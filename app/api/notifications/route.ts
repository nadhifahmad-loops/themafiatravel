import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCustomerNotifications, markCustomerNotificationsRead } from '@/lib/customer-notifications';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const data = await getCustomerNotifications(user.id);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('[Customer Notifications]', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, message: 'Gagal memuat notifikasi' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const keys = Array.isArray(body?.keys) ? body.keys.filter((k: unknown): k is string => typeof k === 'string') : [];
    const result = await markCustomerNotificationsRead(user.id, keys);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('[Customer Notifications]', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, message: 'Gagal menandai notifikasi' }, { status: 500 });
  }
}
