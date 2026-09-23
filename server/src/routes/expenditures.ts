import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  authenticate,
  authorize,
  AuthRequest,
  assertBaseAccess,
  baseScopeFilter,
  routeParam,
} from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../lib/audit.js';

export const expendituresRouter = Router();

expendituresRouter.use(authenticate);

const createSchema = z.object({
  baseId: z.string().min(1),
  assetId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().min(1),
  expendedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

expendituresRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const { baseId } = req.query as Record<string, string | undefined>;
    if (baseId) assertBaseAccess(user, baseId);
    const scope = baseScopeFilter(user);

    const rows = await prisma.expenditure.findMany({
      where: { baseId: baseId || scope.baseId },
      include: {
        asset: true,
        base: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { expendedAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

expendituresRouter.post(
  '/',
  authorize(Role.ADMIN, Role.BASE_COMMANDER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = createSchema.parse(req.body);
      assertBaseAccess(user, body.baseId);

      const expenditure = await prisma.$transaction(async (tx) => {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: { baseId: body.baseId, assetId: body.assetId },
          },
        });
        if (!balance || balance.quantity < body.quantity) {
          throw new AppError('Insufficient inventory to expend');
        }

        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: { baseId: body.baseId, assetId: body.assetId },
          },
          data: { quantity: { decrement: body.quantity } },
        });

        return tx.expenditure.create({
          data: {
            baseId: body.baseId,
            assetId: body.assetId,
            quantity: body.quantity,
            reason: body.reason,
            expendedAt: body.expendedAt ? new Date(body.expendedAt) : new Date(),
            notes: body.notes,
            createdById: user.id,
          },
          include: { asset: true, base: true },
        });
      });

      await writeAuditLog({
        action: 'EXPENDITURE_CREATE',
        entityType: 'Expenditure',
        entityId: expenditure.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.status(201).json(expenditure);
    } catch (err) {
      next(err);
    }
  }
);

const updateSchema = createSchema.partial().extend({
  quantity: z.number().int().positive().optional(),
  reason: z.string().min(1).optional(),
});

expendituresRouter.put(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = updateSchema.parse(req.body);
      const existing = await prisma.expenditure.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) throw new AppError('Expenditure not found', 404);
      assertBaseAccess(user, existing.baseId);

      const nextBaseId = body.baseId ?? existing.baseId;
      const nextAssetId = body.assetId ?? existing.assetId;
      const nextQty = body.quantity ?? existing.quantity;
      assertBaseAccess(user, nextBaseId);

      const expenditure = await prisma.$transaction(async (tx) => {
        // Restore expended stock
        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: {
              baseId: existing.baseId,
              assetId: existing.assetId,
            },
          },
          create: {
            baseId: existing.baseId,
            assetId: existing.assetId,
            quantity: existing.quantity,
          },
          update: { quantity: { increment: existing.quantity } },
        });

        const bal = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: { baseId: nextBaseId, assetId: nextAssetId },
          },
        });
        if (!bal || bal.quantity < nextQty) {
          throw new AppError('Insufficient inventory to expend');
        }
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: { baseId: nextBaseId, assetId: nextAssetId },
          },
          data: { quantity: { decrement: nextQty } },
        });

        return tx.expenditure.update({
          where: { id: existing.id },
          data: {
            baseId: nextBaseId,
            assetId: nextAssetId,
            quantity: nextQty,
            reason: body.reason ?? existing.reason,
            notes: body.notes !== undefined ? body.notes : existing.notes,
            expendedAt: body.expendedAt
              ? new Date(body.expendedAt)
              : existing.expendedAt,
          },
          include: {
            asset: true,
            base: true,
            createdBy: { select: { id: true, name: true } },
          },
        });
      });

      await writeAuditLog({
        action: 'EXPENDITURE_UPDATE',
        entityType: 'Expenditure',
        entityId: expenditure.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.json(expenditure);
    } catch (err) {
      next(err);
    }
  }
);

expendituresRouter.delete(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const existing = await prisma.expenditure.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) throw new AppError('Expenditure not found', 404);
      assertBaseAccess(user, existing.baseId);

      await prisma.$transaction(async (tx) => {
        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: {
              baseId: existing.baseId,
              assetId: existing.assetId,
            },
          },
          create: {
            baseId: existing.baseId,
            assetId: existing.assetId,
            quantity: existing.quantity,
          },
          update: { quantity: { increment: existing.quantity } },
        });
        await tx.expenditure.delete({ where: { id: existing.id } });
      });

      await writeAuditLog({
        action: 'EXPENDITURE_DELETE',
        entityType: 'Expenditure',
        entityId: existing.id,
        details: { id: existing.id, quantity: existing.quantity },
        user,
        ipAddress: req.ip,
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
