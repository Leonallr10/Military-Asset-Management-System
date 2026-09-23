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
 * Metrics for a date window:
 * Opening = inventory at start of period (approx via reverse of movements in window)
 * Closing = current inventory (or inventory after movements up to end date)
 * Net Movement = Purchases + Transfer In - Transfer Out (within window)
 * Assigned / Expended = sums within window
 */
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

    const from = dateFrom ? new Date(dateFrom) : startOfMonth(new Date());
    const to = dateTo ? endOfDay(new Date(dateTo)) : endOfDay(new Date());

    const assetFilter: Prisma.AssetWhereInput = equipmentType
      ? { equipmentType: equipmentType as EquipmentType }
      : {};

    const assets = await prisma.asset.findMany({ where: assetFilter });
    const assetIds = assets.map((a) => a.id);

    const baseWhere = effectiveBaseId ? { baseId: effectiveBaseId } : {};
    const assetIn = assetIds.length ? { assetId: { in: assetIds } } : {};

    const [purchases, transfersIn, transfersOut, assignments, expenditures, balances] =
      await Promise.all([
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
            toBaseId: effectiveBaseId,
            ...(effectiveBaseId ? {} : {}),
            ...assetIn,
            status: 'COMPLETED',
            transferredAt: { gte: from, lte: to },
            ...(effectiveBaseId ? { toBaseId: effectiveBaseId } : {}),
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
        prisma.inventoryBalance.findMany({
          where: {
            ...(effectiveBaseId ? { baseId: effectiveBaseId } : {}),
            ...(assetIds.length ? { assetId: { in: assetIds } } : {}),
          },
        }),
      ]);

    // When no base filter (admin), transfers in/out without base are global sums which cancel;
    // for admin overview we still report global purchase/assignment/expenditure and closing stock.
    const purchaseQty = purchases._sum.quantity ?? 0;
    const transferInQty = transfersIn._sum.quantity ?? 0;
    const transferOutQty = transfersOut._sum.quantity ?? 0;
    const netMovement = purchaseQty + transferInQty - transferOutQty;
    const assigned = assignments._sum.quantity ?? 0;
    const expended = expenditures._sum.quantity ?? 0;
    const closingBalance = balances.reduce((s, b) => s + b.quantity, 0);
    // Opening ≈ Closing - Net + Expended + Assigned (assigned still on books if not expended)
    // Simpler ops model: Opening = Closing - Purchases - TransferIn + TransferOut + Expended
    const openingBalance =
      closingBalance - purchaseQty - transferInQty + transferOutQty + expended;

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

    const from = dateFrom ? new Date(dateFrom) : startOfMonth(new Date());
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
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
