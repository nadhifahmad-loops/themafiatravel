import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULTS = { flight: 50000, hotel: 10, train: 15000, insurance: 5 };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let setting = await prisma.markupSetting.findUnique({ where: { key: 'default' } });
    if (!setting) {
      setting = await prisma.markupSetting.create({
        data: { key: 'default', ...DEFAULTS },
      });
    }
    return NextResponse.json({
      flight: setting.flight,
      hotel: setting.hotel,
      train: setting.train,
      insurance: setting.insurance,
    });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}
