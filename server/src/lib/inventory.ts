import { prisma } from './prisma.js';

/** Ensure inventory row exists and adjust quantity (can go negative only if allowNegative). */
export async function adjustInventory(
  baseId: string,
  assetId: string,
  delta: number,
  allowNegative = false
) {
  const existing = await prisma.inventoryBalance.findUnique({
    where: { baseId_assetId: { baseId, assetId } },
  });

  const nextQty = (existing?.quantity ?? 0) + delta;
  if (!allowNegative && nextQty < 0) {
    throw new Error('Insufficient inventory for this operation');
  }

  return prisma.inventoryBalance.upsert({
    where: { baseId_assetId: { baseId, assetId } },
    create: { baseId, assetId, quantity: Math.max(0, nextQty) },
    update: { quantity: nextQty },
  });
}
