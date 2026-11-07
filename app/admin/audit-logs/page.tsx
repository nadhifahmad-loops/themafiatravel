import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AuditLogClient from './AuditLogClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Audit Log',
};

export default async function AuditLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/admin/login?callbackUrl=/admin/audit-logs&error=Unauthorized');
  }

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!admin || admin.role !== 'admin') {
    redirect('/admin/login?callbackUrl=/admin/audit-logs&error=Unauthorized');
  }

  const [logs, actions] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
    }),
  ]);

  const initialLogs = logs.map((log) => ({
    id: log.id,
    adminId: log.adminId,
    adminEmail: log.adminEmail,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    before: log.before,
    after: log.after,
    metadata: log.metadata,
    ip: log.ip,
    createdAt: log.createdAt.toISOString(),
  }));

  const actionOptions = actions.map((row) => row.action);

  return <AuditLogClient initialLogs={initialLogs} actionOptions={actionOptions} />;
}
