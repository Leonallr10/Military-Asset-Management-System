import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const assetsRouter = Router();

assetsRouter.use(authenticate);

assetsRouter.get('/', async (_req, res, next) => {
  try {
    const assets = await prisma.asset.findMany({ orderBy: { name: 'asc' } });
    res.json(assets);
  } catch (err) {
    next(err);
  }
});
