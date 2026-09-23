import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const basesRouter = Router();

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
