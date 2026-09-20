import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const careers = await prisma.career.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      department: true,
      type: true,
      location: true,
      description: true,
      requirements: true,
    },
  });

  return NextResponse.json({ careers });
}
