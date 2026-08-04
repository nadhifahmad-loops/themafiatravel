import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAdminNotifications, markNotificationsRead } from '@/lib/admin-notifications';

async function getAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const admin = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!admin || admin.role !== 'admin') return null;
  return admin;
}

export async function GET() {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Bukan admin' }, { status: 403 });
    }

    const data = await getAdminNotifications(admin.id);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('[Admin Notifications]', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, message: 'Gagal memuat notifikasi' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Bukan admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const keys = Array.isArray(body?.keys) ? body.keys.filter((k: unknown): k is string => typeof k === 'string') : [];
    const result = await markNotificationsRead(admin.id, keys);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('[Admin Notifications]', e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, message: 'Gagal menandai notifikasi' }, { status: 500 });
  }
}
