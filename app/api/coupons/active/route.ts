import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));

  const now = new Date();

  const allCoupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
      ...(category && category !== 'all' ? { category: { in: [category, 'all'] } } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      type: true,
      value: true,
      category: true,
      minOrderAmount: true,
      maxDiscount: true,
      maxUsage: true,
      usedCount: true,
      startDate: true,
      endDate: true,
      isFeatured: true,
    },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: limit * 2,
  });

  const coupons = allCoupons
    .filter(c => c.maxUsage === null || c.usedCount < c.maxUsage)
    .slice(0, limit);

  return NextResponse.json({ coupons });
}
