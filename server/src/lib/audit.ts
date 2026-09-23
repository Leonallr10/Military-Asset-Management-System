import { prisma } from '../lib/prisma.js';
import { AuthUser } from '../middleware/auth.js';

export async function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId?: string;
  details: Record<string, unknown> | string;
  user?: AuthUser | null;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details:
        typeof params.details === 'string'
          ? params.details
          : JSON.stringify(params.details),
      userId: params.user?.id,
      ipAddress: params.ipAddress,
    },
  });
}
