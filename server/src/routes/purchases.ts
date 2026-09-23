import { Router } from 'express';
import { z } from 'zod';
import { EquipmentType, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  authenticate,
  authorize,
  AuthRequest,
  assertBaseAccess,
  baseScopeFilter,
  routeParam,
} from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';
import { AppError } from '../middleware/errorHandler.js';

export const purchasesRouter = Router();

purchasesRouter.use(authenticate);

const createSchema = z.object({
  baseId: z.string().min(1),
  assetId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative().optional(),
  purchasedAt: z.string().datetime().optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
});

purchasesRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const { baseId, equipmentType, dateFrom, dateTo } = req.query as Record<
      string,
      string | undefined
    >;
    if (baseId) assertBaseAccess(user, baseId);
    const scope = baseScopeFilter(user);

    const rows = await prisma.purchase.findMany({
      where: {
        baseId: baseId || scope.baseId,
        purchasedAt: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
        ...(equipmentType
          ? { asset: { equipmentType: equipmentType as EquipmentType } }
          : {}),
      },
      include: {
        asset: true,
        base: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { purchasedAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post(
  '/',
  authorize(Role.ADMIN, Role.BASE_COMMANDER, Role.LOGISTICS_OFFICER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = createSchema.parse(req.body);
      assertBaseAccess(user, body.baseId);

      const purchase = await prisma.$transaction(async (tx) => {
        const row = await tx.purchase.create({
          data: {
            baseId: body.baseId,
            assetId: body.assetId,
            quantity: body.quantity,
            unitCost: body.unitCost,
            purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : new Date(),
            vendor: body.vendor,
            notes: body.notes,
            createdById: user.id,
          },
          include: { asset: true, base: true },
        });

        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: { baseId: body.baseId, assetId: body.assetId },
          },
          create: {
            baseId: body.baseId,
            assetId: body.assetId,
            quantity: body.quantity,
          },
          update: { quantity: { increment: body.quantity } },
        });

        return row;
      });

      await writeAuditLog({
        action: 'PURCHASE_CREATE',
        entityType: 'Purchase',
        entityId: purchase.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.status(201).json(purchase);
    } catch (err) {
      next(err);
    }
  }
);

const updateSchema = createSchema.partial().extend({
  quantity: z.number().int().positive().optional(),
});

purchasesRouter.put(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER, Role.LOGISTICS_OFFICER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = updateSchema.parse(req.body);
      const existing = await prisma.purchase.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) {
        res.status(404).json({ error: 'Purchase not found' });
        return;
      }
      assertBaseAccess(user, existing.baseId);
      const nextBaseId = body.baseId ?? existing.baseId;
      const nextAssetId = body.assetId ?? existing.assetId;
      const nextQty = body.quantity ?? existing.quantity;
      assertBaseAccess(user, nextBaseId);

      const purchase = await prisma.$transaction(async (tx) => {
        // Reverse old inventory impact
        const oldBal = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: {
              baseId: existing.baseId,
              assetId: existing.assetId,
            },
          },
        });
        if (!oldBal || oldBal.quantity < existing.quantity) {
          throw new AppError('Cannot edit: inventory would go negative');
        }
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: {
              baseId: existing.baseId,
              assetId: existing.assetId,
            },
          },
          data: { quantity: { decrement: existing.quantity } },
        });

        // Apply new inventory impact
        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: { baseId: nextBaseId, assetId: nextAssetId },
          },
          create: {
            baseId: nextBaseId,
            assetId: nextAssetId,
            quantity: nextQty,
          },
          update: { quantity: { increment: nextQty } },
        });

        return tx.purchase.update({
          where: { id: existing.id },
          data: {
            baseId: nextBaseId,
            assetId: nextAssetId,
            quantity: nextQty,
            unitCost: body.unitCost ?? existing.unitCost,
            vendor: body.vendor !== undefined ? body.vendor : existing.vendor,
            notes: body.notes !== undefined ? body.notes : existing.notes,
            purchasedAt: body.purchasedAt
              ? new Date(body.purchasedAt)
              : existing.purchasedAt,
          },
          include: {
            asset: true,
            base: true,
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });
      });

      await writeAuditLog({
        action: 'PURCHASE_UPDATE',
        entityType: 'Purchase',
        entityId: purchase.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.json(purchase);
    } catch (err) {
      next(err);
    }
  }
);

purchasesRouter.delete(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER, Role.LOGISTICS_OFFICER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const existing = await prisma.purchase.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) {
        res.status(404).json({ error: 'Purchase not found' });
        return;
      }
      assertBaseAccess(user, existing.baseId);

      await prisma.$transaction(async (tx) => {
        const bal = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: {
              baseId: existing.baseId,
              assetId: existing.assetId,
            },
          },
        });
        if (!bal || bal.quantity < existing.quantity) {
          throw new AppError('Cannot delete: inventory would go negative');
        }
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: {
              baseId: existing.baseId,
              assetId: existing.assetId,
            },
          },
          data: { quantity: { decrement: existing.quantity } },
        });
        await tx.purchase.delete({ where: { id: existing.id } });
      });

      await writeAuditLog({
        action: 'PURCHASE_DELETE',
        entityType: 'Purchase',
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
