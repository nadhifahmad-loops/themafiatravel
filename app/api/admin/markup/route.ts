import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

const DEFAULT_KEY = 'default';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let setting = await prisma.markupSetting.findUnique({ where: { key: DEFAULT_KEY } });
  if (!setting) {
    setting = await prisma.markupSetting.create({
      data: { key: DEFAULT_KEY, flight: 50000, hotel: 10, train: 15000, insurance: 5 },
    });
  }

  return NextResponse.json(setting);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  });
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { flight, hotel, train, insurance } = body;

  if (typeof flight !== 'number' || typeof hotel !== 'number' || typeof train !== 'number' || typeof insurance !== 'number') {
    return NextResponse.json({ error: 'Invalid values' }, { status: 400 });
  }

  if (flight < 0 || hotel < 0 || train < 0 || insurance < 0) {
    return NextResponse.json({ error: 'Values must be >= 0' }, { status: 400 });
  }

  const existing = await prisma.markupSetting.findUnique({ where: { key: DEFAULT_KEY } });
  const before = existing
    ? { flight: existing.flight, hotel: existing.hotel, train: existing.train, insurance: existing.insurance }
    : null;

  const updated = await prisma.markupSetting.upsert({
    where: { key: DEFAULT_KEY },
    update: { flight, hotel, train, insurance },
    create: { key: DEFAULT_KEY, flight, hotel, train, insurance },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'markup.update',
    entityType: 'markupSetting',
    entityId: DEFAULT_KEY,
    before,
    after: { flight: updated.flight, hotel: updated.hotel, train: updated.train, insurance: updated.insurance },
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, setting: updated });
}
