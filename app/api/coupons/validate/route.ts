import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  const body = await req.json();
  const { code, category, totalAmount } = body;

  if (!code || !category) {
    return NextResponse.json({ error: 'Kode kupon dan kategori wajib diisi.' }, { status: 400 });
  }

  const coupon = await prisma.coupon.findFirst({
    where: { code: { equals: code.toUpperCase().replace(/\s+/g, ''), mode: 'insensitive' } },
  });

  if (!coupon) {
    return NextResponse.json({ error: 'Kupon tidak ditemukan.' }, { status: 404 });
  }

  if (!coupon.isActive) {
    return NextResponse.json({ error: 'Kupon tidak aktif.' }, { status: 400 });
  }

  const now = new Date();
  if (coupon.startDate && coupon.startDate > now) {
    return NextResponse.json({ error: 'Kupon belum berlaku.' }, { status: 400 });
  }
  if (coupon.endDate && coupon.endDate < now) {
    return NextResponse.json({ error: 'Kupon sudah kedaluwarsa.' }, { status: 400 });
  }

  if (coupon.maxUsage !== null && coupon.usedCount >= coupon.maxUsage) {
    return NextResponse.json({ error: 'Kupon sudah mencapai batas pemakaian.' }, { status: 400 });
  }

  if (coupon.category !== 'all' && coupon.category !== category) {
    return NextResponse.json({ error: `Kupon ini hanya berlaku untuk kategori ${coupon.category}.` }, { status: 400 });
  }

  if (coupon.minOrderAmount > 0 && totalAmount < coupon.minOrderAmount) {
    return NextResponse.json({ error: `Minimum pesanan Rp${coupon.minOrderAmount.toLocaleString('id-ID')} untuk menggunakan kupon ini.` }, { status: 400 });
  }

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (user) {
      const usage = await prisma.couponUsage.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId: user.id } },
      });
      if (usage) {
        return NextResponse.json({ error: 'Anda sudah menggunakan kupon ini sebelumnya.' }, { status: 400 });
      }
    }
  }

  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = Math.round(totalAmount * (coupon.value / 100));
    if (coupon.maxDiscount !== null && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }
  } else {
    discountAmount = Math.min(coupon.value, totalAmount);
  }

  return NextResponse.json({
    success: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      category: coupon.category,
    },
    discountAmount,
  });
}
