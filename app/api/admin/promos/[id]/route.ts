import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';
import { normalizePromo } from '@/lib/promos';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  });
  return admin && admin.role === 'admin' ? admin : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { id } = await params;
  const promo = await prisma.promoRoute.findUnique({ where: { id: parseInt(id, 10) } });
  if (!promo) return NextResponse.json({ error: 'Promo tidak ditemukan.' }, { status: 404 });

  return NextResponse.json({ promo });
}

/** PUT /api/admin/promos/[id] — perbarui kartu promo. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { id } = await params;
  const promoId = parseInt(id, 10);
  const existing = await prisma.promoRoute.findUnique({ where: { id: promoId } });
  if (!existing) return NextResponse.json({ error: 'Promo tidak ditemukan.' }, { status: 404 });

  const normalized = normalizePromo(await req.json());
  if ('error' in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });

  const { validUntil, ...rest } = normalized.data;
  const updated = await prisma.promoRoute.update({
    where: { id: promoId },
    data: { ...rest, validUntil: validUntil ? new Date(validUntil) : null },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'promo.update',
    entityType: 'promoRoute',
    entityId: String(updated.id),
    before: existing,
    after: updated,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, promo: updated });
}

/** DELETE /api/admin/promos/[id] */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { id } = await params;
  const promoId = parseInt(id, 10);
  const existing = await prisma.promoRoute.findUnique({ where: { id: promoId } });
  if (!existing) return NextResponse.json({ error: 'Promo tidak ditemukan.' }, { status: 404 });

  await prisma.promoRoute.delete({ where: { id: promoId } });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'promo.delete',
    entityType: 'promoRoute',
    entityId: String(existing.id),
    before: existing,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true });
}
