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

export const transfersRouter = Router();

transfersRouter.use(authenticate);

const createSchema = z.object({
  fromBaseId: z.string().min(1),
  toBaseId: z.string().min(1),
  assetId: z.string().min(1),
  quantity: z.number().int().positive(),
  transferredAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

transfersRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const { baseId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    if (baseId) assertBaseAccess(user, baseId);
    const scope = baseScopeFilter(user);
    const scopedBase = baseId || scope.baseId;

    const rows = await prisma.transfer.findMany({
      where: {
        ...(scopedBase
          ? {
              OR: [{ fromBaseId: scopedBase }, { toBaseId: scopedBase }],
            }
          : {}),
        transferredAt: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
      },
      include: {
        asset: true,
        fromBase: true,
        toBase: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { transferredAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

transfersRouter.post(
  '/',
  authorize(Role.ADMIN, Role.BASE_COMMANDER, Role.LOGISTICS_OFFICER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = createSchema.parse(req.body);
      if (body.fromBaseId === body.toBaseId) {
        throw new AppError('Source and destination bases must differ');
      }
      // Officers/commanders may only initiate from their base (admin: any)
      assertBaseAccess(user, body.fromBaseId);

      const transfer = await prisma.$transaction(async (tx) => {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: { baseId: body.fromBaseId, assetId: body.assetId },
          },
        });
        if (!balance || balance.quantity < body.quantity) {
          throw new AppError('Insufficient inventory at source base');
        }

        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: { baseId: body.fromBaseId, assetId: body.assetId },
          },
          data: { quantity: { decrement: body.quantity } },
        });

        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: { baseId: body.toBaseId, assetId: body.assetId },
          },
          create: {
            baseId: body.toBaseId,
            assetId: body.assetId,
            quantity: body.quantity,
          },
          update: { quantity: { increment: body.quantity } },
        });

        return tx.transfer.create({
          data: {
            fromBaseId: body.fromBaseId,
            toBaseId: body.toBaseId,
            assetId: body.assetId,
            quantity: body.quantity,
            status: 'COMPLETED',
            transferredAt: body.transferredAt
              ? new Date(body.transferredAt)
              : new Date(),
            notes: body.notes,
            createdById: user.id,
          },
          include: { asset: true, fromBase: true, toBase: true },
        });
      });

      await writeAuditLog({
        action: 'TRANSFER_CREATE',
        entityType: 'Transfer',
        entityId: transfer.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.status(201).json(transfer);
    } catch (err) {
      next(err);
    }
  }
);

const updateSchema = createSchema.partial().extend({
  quantity: z.number().int().positive().optional(),
});

transfersRouter.put(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER, Role.LOGISTICS_OFFICER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = updateSchema.parse(req.body);
      const existing = await prisma.transfer.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) throw new AppError('Transfer not found', 404);
      assertBaseAccess(user, existing.fromBaseId);

      const nextFrom = body.fromBaseId ?? existing.fromBaseId;
      const nextTo = body.toBaseId ?? existing.toBaseId;
      const nextAsset = body.assetId ?? existing.assetId;
      const nextQty = body.quantity ?? existing.quantity;
      if (nextFrom === nextTo) {
        throw new AppError('Source and destination bases must differ');
      }
      assertBaseAccess(user, nextFrom);

      const transfer = await prisma.$transaction(async (tx) => {
        // Reverse original transfer
        const destBal = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: {
              baseId: existing.toBaseId,
              assetId: existing.assetId,
            },
          },
        });
        if (!destBal || destBal.quantity < existing.quantity) {
          throw new AppError('Cannot edit: destination inventory insufficient to reverse');
        }
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: {
              baseId: existing.toBaseId,
              assetId: existing.assetId,
            },
          },
          data: { quantity: { decrement: existing.quantity } },
        });
        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: {
              baseId: existing.fromBaseId,
              assetId: existing.assetId,
            },
          },
          create: {
            baseId: existing.fromBaseId,
            assetId: existing.assetId,
            quantity: existing.quantity,
          },
          update: { quantity: { increment: existing.quantity } },
        });

        // Apply new transfer
        const srcBal = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: { baseId: nextFrom, assetId: nextAsset },
          },
        });
        if (!srcBal || srcBal.quantity < nextQty) {
          throw new AppError('Insufficient inventory at source base');
        }
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: { baseId: nextFrom, assetId: nextAsset },
          },
          data: { quantity: { decrement: nextQty } },
        });
        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: { baseId: nextTo, assetId: nextAsset },
          },
          create: {
            baseId: nextTo,
            assetId: nextAsset,
            quantity: nextQty,
          },
          update: { quantity: { increment: nextQty } },
        });

        return tx.transfer.update({
          where: { id: existing.id },
          data: {
            fromBaseId: nextFrom,
            toBaseId: nextTo,
            assetId: nextAsset,
            quantity: nextQty,
            notes: body.notes !== undefined ? body.notes : existing.notes,
            transferredAt: body.transferredAt
              ? new Date(body.transferredAt)
              : existing.transferredAt,
          },
          include: {
            asset: true,
            fromBase: true,
            toBase: true,
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });
      });

      await writeAuditLog({
        action: 'TRANSFER_UPDATE',
        entityType: 'Transfer',
        entityId: transfer.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.json(transfer);
    } catch (err) {
      next(err);
    }
  }
);

transfersRouter.delete(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER, Role.LOGISTICS_OFFICER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const existing = await prisma.transfer.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) throw new AppError('Transfer not found', 404);
      assertBaseAccess(user, existing.fromBaseId);

      await prisma.$transaction(async (tx) => {
        const destBal = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: {
              baseId: existing.toBaseId,
              assetId: existing.assetId,
            },
          },
        });
        if (!destBal || destBal.quantity < existing.quantity) {
          throw new AppError(
            'Cannot delete: destination inventory insufficient to reverse'
          );
        }
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: {
              baseId: existing.toBaseId,
              assetId: existing.assetId,
            },
          },
          data: { quantity: { decrement: existing.quantity } },
        });
        await tx.inventoryBalance.upsert({
          where: {
            baseId_assetId: {
              baseId: existing.fromBaseId,
              assetId: existing.assetId,
            },
          },
          create: {
            baseId: existing.fromBaseId,
            assetId: existing.assetId,
            quantity: existing.quantity,
          },
          update: { quantity: { increment: existing.quantity } },
        });
        await tx.transfer.delete({ where: { id: existing.id } });
      });

      await writeAuditLog({
        action: 'TRANSFER_DELETE',
        entityType: 'Transfer',
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
