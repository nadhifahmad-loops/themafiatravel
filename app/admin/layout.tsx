import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: { template: '%s | The Mafia Admin', default: 'Admin Panel — The Mafia Travel' },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/admin/dashboard&error=Unauthorized');
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, name: true, email: true, image: true },
  });

  if (!dbUser || dbUser.role !== 'admin') {
    redirect('/login?callbackUrl=/admin/dashboard&error=Unauthorized');
  }

  return (
    <AdminShell
      userName={dbUser.name ?? ''}
      userEmail={dbUser.email ?? ''}
      userImage={dbUser.image ?? ''}
    >
      {children}
    </AdminShell>
  );
}