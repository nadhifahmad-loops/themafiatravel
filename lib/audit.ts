import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getRequestIp } from '@/lib/security';

export interface AuditEntry {
  adminId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ip?: string;
}

function toJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

export async function recordAudit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId,
        adminEmail: entry.adminEmail,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
        metadata: toJson(entry.metadata),
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Gagal mencatat aksi admin:', error instanceof Error ? error.message : error);
  }
}

export function auditIpFromRequest(request: Request): string {
  return getRequestIp(request.headers);
}
