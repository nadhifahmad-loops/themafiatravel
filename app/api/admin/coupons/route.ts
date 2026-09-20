import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';

  const where: any = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category && category !== 'all') {
    where.category = category;
  }
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (status === 'expired') where.endDate = { lt: new Date() };
  if (status === 'exhausted') {
    where.maxUsage = { not: null };
    where.usedCount = { gte: 1 };
  }

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coupon.count({ where }),
  ]);

  return NextResponse.json({ coupons, total, page, limit, totalPages: Math.ceil(total / limit) });
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

  const existing = await prisma.coupon.findUnique({ where: { code: normalizedCode } });
  if (existing) {
    return NextResponse.json({ error: 'Kode kupon sudah digunakan.' }, { status: 409 });
  }

  const coupon = await prisma.coupon.create({
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
    action: 'coupon.create',
    entityType: 'coupon',
    entityId: String(coupon.id),
    after: coupon,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, coupon });
}
