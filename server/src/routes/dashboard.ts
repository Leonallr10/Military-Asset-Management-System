import { Router } from 'express';
import { EquipmentType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  authenticate,
  AuthRequest,
  assertBaseAccess,
  baseScopeFilter,
} from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/**
 * Reconstruct on-hand inventory as of a point in time by reversing
 * all ledger movements that occurred after that instant.
 *
 * Current model effects on InventoryBalance:
 *  + Purchase, Transfer In, Assignment return
 *  − Transfer Out, Assignment create, Expenditure
 */
async function inventoryAt(
  asOf: Date,
  effectiveBaseId: string | undefined,
  assetIds: string[]
) {
  const assetIn = assetIds.length ? { assetId: { in: assetIds } } : {};
  const after = { gt: asOf };

  const [
    balances,
    purchasesAfter,
    transfersInAfter,
    transfersOutAfter,
    expendituresAfter,
    assignmentsAfter,
    returnsAfter,
  ] = await Promise.all([
    prisma.inventoryBalance.findMany({
      where: {
        ...(effectiveBaseId ? { baseId: effectiveBaseId } : {}),
        ...(assetIds.length ? { assetId: { in: assetIds } } : {}),
      },
    }),
    prisma.purchase.aggregate({
      where: {
        ...(effectiveBaseId ? { baseId: effectiveBaseId } : {}),
        ...assetIn,
        purchasedAt: after,
      },
      _sum: { quantity: true },
    }),
    prisma.transfer.aggregate({
      where: {
        ...(effectiveBaseId ? { toBaseId: effectiveBaseId } : {}),
        ...assetIn,
        status: 'COMPLETED',
        transferredAt: after,
      },
      _sum: { quantity: true },
    }),
    prisma.transfer.aggregate({
      where: {
        ...(effectiveBaseId ? { fromBaseId: effectiveBaseId } : {}),
        ...assetIn,
        status: 'COMPLETED',
        transferredAt: after,
      },
      _sum: { quantity: true },
    }),
    prisma.expenditure.aggregate({
      where: {
        ...(effectiveBaseId ? { baseId: effectiveBaseId } : {}),
        ...assetIn,
        expendedAt: after,
      },
      _sum: { quantity: true },
    }),
    prisma.assignment.aggregate({
      where: {
        ...(effectiveBaseId ? { baseId: effectiveBaseId } : {}),
        ...assetIn,
        assignedAt: after,
      },
      _sum: { quantity: true },
    }),
    prisma.assignment.aggregate({
      where: {
        ...(effectiveBaseId ? { baseId: effectiveBaseId } : {}),
        ...assetIn,
        returnedAt: after,
      },
      _sum: { quantity: true },
    }),
  ]);

  const current = balances.reduce((s, b) => s + b.quantity, 0);
  return (
    current -
    (purchasesAfter._sum.quantity ?? 0) -
    (transfersInAfter._sum.quantity ?? 0) +
    (transfersOutAfter._sum.quantity ?? 0) +
    (expendituresAfter._sum.quantity ?? 0) +
    (assignmentsAfter._sum.quantity ?? 0) -
    (returnsAfter._sum.quantity ?? 0)
  );
}

dashboardRouter.get('/metrics', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const { baseId, equipmentType, dateFrom, dateTo } = req.query as Record<
      string,
      string | undefined
    >;

    if (baseId) assertBaseAccess(user, baseId);
    const scope = baseScopeFilter(user);
    const effectiveBaseId = baseId || scope.baseId;

    const from = dateFrom ? startOfDay(new Date(dateFrom)) : startOfMonth(new Date());
    const to = dateTo ? endOfDay(new Date(dateTo)) : endOfDay(new Date());
    // Instant just before the period starts
    const openingAsOf = new Date(from.getTime() - 1);

    const assetFilter: Prisma.AssetWhereInput = equipmentType
      ? { equipmentType: equipmentType as EquipmentType }
      : {};

    const assets = await prisma.asset.findMany({ where: assetFilter });
    const assetIds = assets.map((a) => a.id);

    const baseWhere = effectiveBaseId ? { baseId: effectiveBaseId } : {};
    const assetIn = assetIds.length ? { assetId: { in: assetIds } } : {};

    const [
      purchases,
      transfersIn,
      transfersOut,
      assignments,
      expenditures,
      openingBalance,
      closingBalance,
    ] = await Promise.all([
      prisma.purchase.aggregate({
        where: {
          ...baseWhere,
          ...assetIn,
          purchasedAt: { gte: from, lte: to },
        },
        _sum: { quantity: true },
      }),
      prisma.transfer.aggregate({
        where: {
          ...(effectiveBaseId ? { toBaseId: effectiveBaseId } : {}),
          ...assetIn,
          status: 'COMPLETED',
          transferredAt: { gte: from, lte: to },
        },
        _sum: { quantity: true },
      }),
      prisma.transfer.aggregate({
        where: {
          ...(effectiveBaseId ? { fromBaseId: effectiveBaseId } : {}),
          ...assetIn,
          status: 'COMPLETED',
          transferredAt: { gte: from, lte: to },
        },
        _sum: { quantity: true },
      }),
      prisma.assignment.aggregate({
        where: {
          ...baseWhere,
          ...assetIn,
          assignedAt: { gte: from, lte: to },
          returnedAt: null,
        },
        _sum: { quantity: true },
      }),
      prisma.expenditure.aggregate({
        where: {
          ...baseWhere,
          ...assetIn,
          expendedAt: { gte: from, lte: to },
        },
        _sum: { quantity: true },
      }),
      inventoryAt(openingAsOf, effectiveBaseId, assetIds),
      inventoryAt(to, effectiveBaseId, assetIds),
    ]);

    const purchaseQty = purchases._sum.quantity ?? 0;
    const transferInQty = transfersIn._sum.quantity ?? 0;
    const transferOutQty = transfersOut._sum.quantity ?? 0;
    const netMovement = purchaseQty + transferInQty - transferOutQty;
    const assigned = assignments._sum.quantity ?? 0;
    const expended = expenditures._sum.quantity ?? 0;

    res.json({
      filters: {
        baseId: effectiveBaseId ?? null,
        equipmentType: equipmentType ?? null,
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
      },
      metrics: {
        openingBalance,
        closingBalance,
        netMovement,
        purchases: purchaseQty,
        transferIn: transferInQty,
        transferOut: transferOutQty,
        assigned,
        expended,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Bonus: detailed breakdown for Net Movement popup */
dashboardRouter.get('/net-movement-detail', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const { baseId, equipmentType, dateFrom, dateTo } = req.query as Record<
      string,
      string | undefined
    >;

    if (baseId) assertBaseAccess(user, baseId);
    const scope = baseScopeFilter(user);
    const effectiveBaseId = baseId || scope.baseId;

    const from = dateFrom ? startOfDay(new Date(dateFrom)) : startOfMonth(new Date());
    const to = dateTo ? endOfDay(new Date(dateTo)) : endOfDay(new Date());

    const assetFilter = equipmentType
      ? { asset: { equipmentType: equipmentType as EquipmentType } }
      : {};

    const [purchaseRows, transferInRows, transferOutRows] = await Promise.all([
      prisma.purchase.findMany({
        where: {
          ...(effectiveBaseId ? { baseId: effectiveBaseId } : {}),
          purchasedAt: { gte: from, lte: to },
          ...assetFilter,
        },
        include: { asset: true, base: true, createdBy: { select: { name: true } } },
        orderBy: { purchasedAt: 'desc' },
      }),
      prisma.transfer.findMany({
        where: {
          ...(effectiveBaseId ? { toBaseId: effectiveBaseId } : {}),
          status: 'COMPLETED',
          transferredAt: { gte: from, lte: to },
          ...assetFilter,
        },
        include: {
          asset: true,
          fromBase: true,
          toBase: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { transferredAt: 'desc' },
      }),
      prisma.transfer.findMany({
        where: {
          ...(effectiveBaseId ? { fromBaseId: effectiveBaseId } : {}),
          status: 'COMPLETED',
          transferredAt: { gte: from, lte: to },
          ...assetFilter,
        },
        include: {
          asset: true,
          fromBase: true,
          toBase: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { transferredAt: 'desc' },
      }),
    ]);

    res.json({
      purchases: purchaseRows,
      transferIn: transferInRows,
      transferOut: transferOutRows,
    });
  } catch (err) {
    next(err);
  }
});

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
