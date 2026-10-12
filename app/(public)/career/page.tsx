import type { Metadata } from 'next';
import type { Career } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import CareerContent from './CareerContent';

export const metadata: Metadata = {
  title: 'Karier',
  description: 'Bergabunglah dengan tim The Mafia Travel dan bangun karier di industri travel tech.',
  alternates: { canonical: '/career' },
};

export default async function CareerPage() {
  let careers: Career[] = [];
  try {
    careers = await prisma.career.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  } catch {}

  return <CareerContent careers={careers} />;
}
