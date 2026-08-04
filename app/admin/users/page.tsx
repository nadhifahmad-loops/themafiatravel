import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import UsersClient from './UsersClient';

export const metadata: Metadata = { title: 'Manajemen User' };

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, image: true },
  });
  return <UsersClient initialUsers={users} />;
}