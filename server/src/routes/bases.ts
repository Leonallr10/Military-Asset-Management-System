import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const basesRouter = Router();

/** Public directory for registration (id/name/code only). */
basesRouter.get('/public', async (_req, res, next) => {
  try {
    const bases = await prisma.base.findMany({
      select: { id: true, name: true, code: true, location: true },
      orderBy: { name: 'asc' },
    });
    res.json(bases);
  } catch (err) {
    next(err);
  }
});

basesRouter.use(authenticate);

/** Base directory is readable by all authenticated roles (needed for transfer destinations).
 *  Inventory/transaction data remains base-scoped elsewhere. */
basesRouter.get('/', async (_req, res, next) => {
  try {
    const bases = await prisma.base.findMany({ orderBy: { name: 'asc' } });
    res.json(bases);
  } catch (err) {
    next(err);
  }
});
