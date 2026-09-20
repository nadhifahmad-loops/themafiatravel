import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({ where: { id: parseInt(id) } });
  if (!coupon) {
    return NextResponse.json({ error: 'Kupon tidak ditemukan.' }, { status: 404 });
  }

  return NextResponse.json({ coupon });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const existing = await prisma.coupon.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return NextResponse.json({ error: 'Kupon tidak ditemukan.' }, { status: 404 });
  }

  const body = await req.json();
  const { code, name, description, type, value, category, minOrderAmount, maxDiscount, maxUsage, isActive, isFeatured, startDate, endDate } = body;

  if (!code || !name || !type || value === undefined || value === null) {
    return NextResponse.json({ error: 'Kode, nama, tipe, dan nilai wajib diisi.' }, { status: 400 });
  }

  if (!['percentage', 'fixed'].includes(type)) {
    return NextResponse.json({ error: 'Tipe kupon harus "percentage" atau "fixed".' }, { status: 400 });
  }

  if (value <= 0) {
    return NextResponse.json({ error: 'Nilai diskon harus lebih dari 0.' }, { status: 400 });
  }

  if (type === 'percentage' && value > 100) {
    return NextResponse.json({ error: 'Persentase diskon maksimal 100%.' }, { status: 400 });
  }

  const normalizedCode = code.toUpperCase().replace(/\s+/g, '');

  if (normalizedCode !== existing.code) {
    const codeExists = await prisma.coupon.findUnique({ where: { code: normalizedCode } });
    if (codeExists) {
      return NextResponse.json({ error: 'Kode kupon sudah digunakan.' }, { status: 409 });
    }
  }

  const updated = await prisma.coupon.update({
    where: { id: parseInt(id) },
    data: {
      code: normalizedCode,
      name,
      description: description || null,
      type,
      value,
      category: category || 'all',
      minOrderAmount: minOrderAmount || 0,
      maxDiscount: maxDiscount || null,
      maxUsage: maxUsage || null,
      isActive: isActive !== false,
      isFeatured: isFeatured === true,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'coupon.update',
    entityType: 'coupon',
    entityId: String(updated.id),
    before: existing,
    after: updated,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, coupon: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const existing = await prisma.coupon.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return NextResponse.json({ error: 'Kupon tidak ditemukan.' }, { status: 404 });
  }

  await prisma.coupon.delete({ where: { id: parseInt(id) } });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'coupon.delete',
    entityType: 'coupon',
    entityId: String(existing.id),
    before: existing,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true });
}
