import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: { template: '%s | The Mafia Admin', default: 'Admin Panel — The Mafia Travel' },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';

  // Halaman login admin punya layout sendiri (tanpa shell admin & tanpa guard).
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const session = await getServerSession(authOptions);

  const callbackTarget = pathname || '/admin/dashboard';
  const adminLoginHref = `/admin/login?callbackUrl=${encodeURIComponent(callbackTarget)}&error=Unauthorized`;

  if (!session?.user?.email) {
    redirect(adminLoginHref);
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, name: true, email: true, image: true },
  });

  if (!dbUser || dbUser.role !== 'admin') {
    redirect(adminLoginHref);
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