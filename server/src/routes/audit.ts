import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

export const auditRouter = Router();

auditRouter.use(authenticate);
auditRouter.use(authorize(Role.ADMIN, Role.BASE_COMMANDER));

auditRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});
