import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';
import { normalizePromo, isPromoService } from '@/lib/promos';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  });
  return admin && admin.role === 'admin' ? admin : null;
}

/** GET /api/admin/promos?service=flight&status=active&q=yoga — semua promo (termasuk nonaktif/kedaluwarsa). */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const service = searchParams.get('service') || '';
  const status = searchParams.get('status') || '';
  const q = (searchParams.get('q') || '').trim();

  const where: Record<string, unknown> = {};
  if (isPromoService(service)) where.service = service;
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (status === 'expired') where.validUntil = { lt: new Date() };
  if (q) {
    where.OR = [
      { titleId: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { origin: { contains: q, mode: 'insensitive' } },
      { destination: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
    ];
  }

  const promos = await prisma.promoRoute.findMany({
    where,
    orderBy: [{ service: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  });

  return NextResponse.json({ promos, total: promos.length });
}

/** POST /api/admin/promos — buat kartu promo baru. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const normalized = normalizePromo(await req.json());
  if ('error' in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });

  const { validUntil, ...rest } = normalized.data;
  const promo = await prisma.promoRoute.create({
    data: { ...rest, validUntil: validUntil ? new Date(validUntil) : null },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'promo.create',
    entityType: 'promoRoute',
    entityId: String(promo.id),
    after: promo,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, promo });
}
