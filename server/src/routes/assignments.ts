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

export const assignmentsRouter = Router();

assignmentsRouter.use(authenticate);

const createSchema = z.object({
  baseId: z.string().min(1),
  assetId: z.string().min(1),
  quantity: z.number().int().positive(),
  personnelName: z.string().min(1),
  personnelId: z.string().optional(),
  assignedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

assignmentsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const { baseId, activeOnly } = req.query as Record<string, string | undefined>;
    if (baseId) assertBaseAccess(user, baseId);
    const scope = baseScopeFilter(user);

    const rows = await prisma.assignment.findMany({
      where: {
        baseId: baseId || scope.baseId,
        ...(activeOnly === 'true' ? { returnedAt: null } : {}),
      },
      include: {
        asset: true,
        base: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

assignmentsRouter.post(
  '/',
  authorize(Role.ADMIN, Role.BASE_COMMANDER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = createSchema.parse(req.body);
      assertBaseAccess(user, body.baseId);

      const assignment = await prisma.$transaction(async (tx) => {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: { baseId: body.baseId, assetId: body.assetId },
          },
        });
        if (!balance || balance.quantity < body.quantity) {
          throw new AppError('Insufficient inventory to assign');
        }

        // Assignment reserves stock from available balance
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: { baseId: body.baseId, assetId: body.assetId },
          },
          data: { quantity: { decrement: body.quantity } },
        });

        return tx.assignment.create({
          data: {
            baseId: body.baseId,
            assetId: body.assetId,
            quantity: body.quantity,
            personnelName: body.personnelName,
            personnelId: body.personnelId,
            assignedAt: body.assignedAt ? new Date(body.assignedAt) : new Date(),
            notes: body.notes,
            createdById: user.id,
          },
          include: { asset: true, base: true },
        });
      });

      await writeAuditLog({
        action: 'ASSIGNMENT_CREATE',
        entityType: 'Assignment',
        entityId: assignment.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.status(201).json(assignment);
    } catch (err) {
      next(err);
    }
  }
);

assignmentsRouter.post(
  '/:id/return',
  authorize(Role.ADMIN, Role.BASE_COMMANDER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const existing = await prisma.assignment.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) throw new AppError('Assignment not found', 404);
      if (existing.returnedAt) throw new AppError('Already returned');
      assertBaseAccess(user, existing.baseId);

      const updated = await prisma.$transaction(async (tx) => {
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

        return tx.assignment.update({
          where: { id: existing.id },
          data: { returnedAt: new Date() },
          include: { asset: true, base: true },
        });
      });

      await writeAuditLog({
        action: 'ASSIGNMENT_RETURN',
        entityType: 'Assignment',
        entityId: updated.id,
        details: { assignmentId: updated.id },
        user,
        ipAddress: req.ip,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

const updateSchema = createSchema.partial().extend({
  quantity: z.number().int().positive().optional(),
  personnelName: z.string().min(1).optional(),
});

assignmentsRouter.put(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const body = updateSchema.parse(req.body);
      const existing = await prisma.assignment.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) throw new AppError('Assignment not found', 404);
      if (existing.returnedAt) {
        throw new AppError('Cannot edit a returned assignment');
      }
      assertBaseAccess(user, existing.baseId);

      const nextBaseId = body.baseId ?? existing.baseId;
      const nextAssetId = body.assetId ?? existing.assetId;
      const nextQty = body.quantity ?? existing.quantity;
      assertBaseAccess(user, nextBaseId);

      const assignment = await prisma.$transaction(async (tx) => {
        // Restore reserved stock from original assignment
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

        // Re-reserve for new values
        const bal = await tx.inventoryBalance.findUnique({
          where: {
            baseId_assetId: { baseId: nextBaseId, assetId: nextAssetId },
          },
        });
        if (!bal || bal.quantity < nextQty) {
          throw new AppError('Insufficient inventory to assign');
        }
        await tx.inventoryBalance.update({
          where: {
            baseId_assetId: { baseId: nextBaseId, assetId: nextAssetId },
          },
          data: { quantity: { decrement: nextQty } },
        });

        return tx.assignment.update({
          where: { id: existing.id },
          data: {
            baseId: nextBaseId,
            assetId: nextAssetId,
            quantity: nextQty,
            personnelName: body.personnelName ?? existing.personnelName,
            personnelId:
              body.personnelId !== undefined
                ? body.personnelId
                : existing.personnelId,
            notes: body.notes !== undefined ? body.notes : existing.notes,
            assignedAt: body.assignedAt
              ? new Date(body.assignedAt)
              : existing.assignedAt,
          },
          include: {
            asset: true,
            base: true,
            createdBy: { select: { id: true, name: true } },
          },
        });
      });

      await writeAuditLog({
        action: 'ASSIGNMENT_UPDATE',
        entityType: 'Assignment',
        entityId: assignment.id,
        details: body,
        user,
        ipAddress: req.ip,
      });

      res.json(assignment);
    } catch (err) {
      next(err);
    }
  }
);

assignmentsRouter.delete(
  '/:id',
  authorize(Role.ADMIN, Role.BASE_COMMANDER),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const existing = await prisma.assignment.findUnique({
        where: { id: routeParam(req.params.id) },
      });
      if (!existing) throw new AppError('Assignment not found', 404);
      assertBaseAccess(user, existing.baseId);

      await prisma.$transaction(async (tx) => {
        // Active assignments still hold reserved stock — restore it
        if (!existing.returnedAt) {
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
        }
        await tx.assignment.delete({ where: { id: existing.id } });
      });

      await writeAuditLog({
        action: 'ASSIGNMENT_DELETE',
        entityType: 'Assignment',
        entityId: existing.id,
        details: { id: existing.id, returned: !!existing.returnedAt },
        user,
        ipAddress: req.ip,
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
