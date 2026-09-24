import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  authenticate,
  authorize,
  AuthRequest,
  baseScopeFilter,
} from '../middleware/auth.js';

export const auditRouter = Router();

auditRouter.use(authenticate);
auditRouter.use(authorize(Role.ADMIN, Role.BASE_COMMANDER));

auditRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const {
      limit: limitRaw,
      action,
      dateFrom,
      dateTo,
      entityType,
    } = req.query as Record<string, string | undefined>;

    const limit = Math.min(Number(limitRaw) || 100, 500);
    const scope = baseScopeFilter(user);
    const to = dateTo ? endOfDay(new Date(dateTo)) : undefined;

    // Base commanders only see their own actions (and system actions they triggered)
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
        ...(entityType
          ? { entityType: { equals: entityType, mode: 'insensitive' } }
          : {}),
        createdAt: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: to,
        },
        ...(user.role !== Role.ADMIN && scope.baseId
          ? { userId: user.id }
          : {}),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
