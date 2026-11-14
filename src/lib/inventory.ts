import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { StockMovementType } from "@/types/inventory";

export class InventoryOperationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "InventoryOperationError";
  }
}

export interface StockMovementInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reference?: string | null;
  reason?: string | null;
  notes?: string | null;
  reorderLevel?: number | null;
}

export interface StockTransferInput {
  productId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
}

function validateMovement(input: StockMovementInput, adjustment: boolean, outbound: boolean): void {
  if (!input.productId || input.productId.length > 64 || !input.warehouseId || input.warehouseId.length > 64) {
    throw new InventoryOperationError("VALIDATION_ERROR", "Select a valid product and warehouse.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 1_000_000) {
    throw new InventoryOperationError("INVALID_QUANTITY", "Quantity must be a non-zero whole number within the allowed range.");
  }
  if (!adjustment && input.quantity < 1) {
    throw new InventoryOperationError("INVALID_QUANTITY", "Quantity must be a positive whole number.");
  }
  if ((adjustment || outbound) && (!input.reason || input.reason.trim().length < 2 || input.reason.trim().length > 300)) {
    throw new InventoryOperationError("REASON_REQUIRED", adjustment ? "A reason is required for stock adjustments." : "A reason is required for stock-out.");
  }
  if (input.reference && input.reference.length > 120) throw new InventoryOperationError("VALIDATION_ERROR", "Reference is too long.");
  if (input.notes && input.notes.length > 1000) throw new InventoryOperationError("VALIDATION_ERROR", "Notes are too long.");
  if (input.reorderLevel !== undefined && input.reorderLevel !== null && (!Number.isInteger(input.reorderLevel) || input.reorderLevel < 0 || input.reorderLevel > 1_000_000)) {
    throw new InventoryOperationError("INVALID_REORDER_LEVEL", "Reorder level must be a non-negative whole number.");
  }
}

export async function recordStockIn(userId: string, input: StockMovementInput) {
  validateMovement(input, false, false);
  return prisma.$transaction(async (transaction) => {
    const [product, warehouse] = await Promise.all([
      transaction.product.findUnique({ where: { id: input.productId }, select: { id: true } }),
      transaction.warehouse.findUnique({ where: { id: input.warehouseId }, select: { id: true, isActive: true } }),
    ]);
    if (!product) throw new InventoryOperationError("PRODUCT_NOT_FOUND", "Product was not found.", 404);
    if (!warehouse) throw new InventoryOperationError("WAREHOUSE_NOT_FOUND", "Warehouse was not found.", 404);
    if (!warehouse.isActive) throw new InventoryOperationError("WAREHOUSE_INACTIVE", "Stock cannot be received into an inactive warehouse.", 409);

    const balance = await transaction.stockBalance.upsert({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
      create: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantityOnHand: input.quantity,
        reorderLevel: input.reorderLevel ?? null,
      },
      update: {
        quantityOnHand: { increment: input.quantity },
        ...(input.reorderLevel !== undefined ? { reorderLevel: input.reorderLevel } : {}),
      },
    });
    const ledger = await transaction.stockLedger.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        movementType: "STOCK_IN",
        quantity: input.quantity,
        reference: input.reference?.trim() || null,
        reason: input.reason?.trim() || null,
        notes: input.notes?.trim() || null,
        createdById: userId,
      },
    });
    return { balance, ledger };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function lockBalance(transaction: Prisma.TransactionClient, productId: string, warehouseId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "StockBalance"
    WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
    FOR UPDATE
  `;
  if (rows.length === 0) return null;
  return transaction.stockBalance.findUnique({ where: { id: rows[0].id } });
}

async function ensureMovementReferences(transaction: Prisma.TransactionClient, productId: string, warehouseId: string) {
  const [product, warehouse] = await Promise.all([
    transaction.product.findUnique({ where: { id: productId }, select: { id: true } }),
    transaction.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true } }),
  ]);
  if (!product) throw new InventoryOperationError("PRODUCT_NOT_FOUND", "Product was not found.", 404);
  if (!warehouse) throw new InventoryOperationError("WAREHOUSE_NOT_FOUND", "Warehouse was not found.", 404);
}

async function decrementAvailable(
  transaction: Prisma.TransactionClient,
  input: StockMovementInput,
  quantity: number,
  movementType: StockMovementType,
  userId: string,
) {
  const balance = await lockBalance(transaction, input.productId, input.warehouseId);
  if (!balance) throw new InventoryOperationError("INSUFFICIENT_STOCK", "There is no stock balance for this product in that warehouse.", 409);
  const available = balance.quantityOnHand - balance.quantityReserved - balance.quantityBlocked;
  if (quantity > available) throw new InventoryOperationError("INSUFFICIENT_STOCK", "Requested quantity exceeds available stock.", 409);
  const updated = await transaction.stockBalance.update({ where: { id: balance.id }, data: { quantityOnHand: { decrement: quantity } } });
  const ledger = await transaction.stockLedger.create({
    data: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      movementType,
      quantity,
      reference: input.reference?.trim() || null,
      reason: input.reason?.trim() || null,
      notes: input.notes?.trim() || null,
      createdById: userId,
    },
  });
  return { balance: updated, ledger };
}

export async function recordStockOut(userId: string, input: StockMovementInput) {
  validateMovement(input, false, true);
  return prisma.$transaction(async (transaction) => {
    await ensureMovementReferences(transaction, input.productId, input.warehouseId);
    return decrementAvailable(transaction, input, input.quantity, "STOCK_OUT", userId);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/** Consume a reservation during dispatch without counting that reserved stock as available again. */
export async function recordReservedStockOut(transaction: Prisma.TransactionClient, userId: string, input: StockMovementInput) {
  validateMovement(input, false, true);
  await ensureMovementReferences(transaction, input.productId, input.warehouseId);
  const balance = await lockBalance(transaction, input.productId, input.warehouseId);
  if (!balance || input.quantity > balance.quantityOnHand || input.quantity > balance.quantityReserved) {
    throw new InventoryOperationError("RESERVATION_STOCK_MISMATCH", "Dispatch quantity exceeds on-hand stock or its active reservation.", 409);
  }
  const updated = await transaction.stockBalance.update({ where: { id: balance.id }, data: { quantityOnHand: { decrement: input.quantity }, quantityReserved: { decrement: input.quantity } } });
  const ledger = await transaction.stockLedger.create({ data: { productId: input.productId, warehouseId: input.warehouseId, movementType: "STOCK_OUT", quantity: input.quantity, reference: input.reference?.trim() || null, reason: input.reason?.trim() || null, notes: input.notes?.trim() || null, createdById: userId } });
  return { balance: updated, ledger };
}

export async function recordStockAdjustment(userId: string, input: StockMovementInput) {
  validateMovement(input, true, input.quantity < 0);
  if (!input.reason || input.reason.trim().length < 2) throw new InventoryOperationError("REASON_REQUIRED", "A reason is required for stock adjustments.");
  return prisma.$transaction(async (transaction) => {
    await ensureMovementReferences(transaction, input.productId, input.warehouseId);
    if (input.quantity < 0) {
      return decrementAvailable(transaction, input, Math.abs(input.quantity), "ADJUSTMENT_OUT", userId);
    }
    const balance = await lockBalance(transaction, input.productId, input.warehouseId);
    if (!balance) throw new InventoryOperationError("BALANCE_NOT_FOUND", "Receive opening stock before adjusting this balance.", 404);
    const reason = input.reason?.trim();
    if (!reason) throw new InventoryOperationError("REASON_REQUIRED", "A reason is required for stock adjustments.");
    const updated = await transaction.stockBalance.update({ where: { id: balance.id }, data: { quantityOnHand: { increment: input.quantity } } });
    const ledger = await transaction.stockLedger.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        movementType: "ADJUSTMENT_IN",
        quantity: input.quantity,
        reference: input.reference?.trim() || null,
        reason,
        notes: input.notes?.trim() || null,
        createdById: userId,
      },
    });
    return { balance: updated, ledger };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordStockTransfer(userId: string, input: StockTransferInput) {
  if (!input.productId || input.productId.length > 64 || !input.sourceWarehouseId || !input.destinationWarehouseId || input.sourceWarehouseId.length > 64 || input.destinationWarehouseId.length > 64) {
    throw new InventoryOperationError("VALIDATION_ERROR", "Select a valid product and both warehouses.");
  }
  if (input.sourceWarehouseId === input.destinationWarehouseId) {
    throw new InventoryOperationError("SAME_WAREHOUSE", "Source and destination warehouses must be different.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 1_000_000) {
    throw new InventoryOperationError("INVALID_QUANTITY", "Transfer quantity must be a positive whole number.");
  }
  if (input.reference && input.reference.length > 120) throw new InventoryOperationError("VALIDATION_ERROR", "Reference is too long.");
  if (input.notes && input.notes.length > 1000) throw new InventoryOperationError("VALIDATION_ERROR", "Notes are too long.");

  const { randomUUID } = await import("node:crypto");
  const transferGroupId = randomUUID();
  return prisma.$transaction(async (transaction) => {
    const [product, source, destination] = await Promise.all([
      transaction.product.findUnique({ where: { id: input.productId }, select: { id: true, isActive: true } }),
      transaction.warehouse.findUnique({ where: { id: input.sourceWarehouseId }, select: { id: true, isActive: true } }),
      transaction.warehouse.findUnique({ where: { id: input.destinationWarehouseId }, select: { id: true, isActive: true } }),
    ]);
    if (!product || !product.isActive) throw new InventoryOperationError("PRODUCT_NOT_FOUND", "An active product is required for transfer.", 404);
    if (!source || !destination) throw new InventoryOperationError("WAREHOUSE_NOT_FOUND", "Both warehouses must exist.", 404);
    if (!source.isActive || !destination.isActive) throw new InventoryOperationError("WAREHOUSE_INACTIVE", "Both warehouses must be active.", 409);

    // Lock the existing stock rows in a stable order to avoid transfer deadlocks.
    const warehouseIds = [input.sourceWarehouseId, input.destinationWarehouseId].sort();
    for (const warehouseId of warehouseIds) {
      await transaction.$queryRaw`SELECT "id" FROM "StockBalance" WHERE "productId" = ${input.productId} AND "warehouseId" = ${warehouseId} FOR UPDATE`;
    }
    const sourceBalance = await transaction.stockBalance.findUnique({ where: { productId_warehouseId: { productId: input.productId, warehouseId: input.sourceWarehouseId } } });
    if (!sourceBalance) throw new InventoryOperationError("INSUFFICIENT_STOCK", "The source warehouse has no stock balance for this product.", 409);
    const available = sourceBalance.quantityOnHand - sourceBalance.quantityReserved - sourceBalance.quantityBlocked;
    if (input.quantity > available) throw new InventoryOperationError("INSUFFICIENT_STOCK", "Transfer quantity exceeds available stock at the source warehouse.", 409);

    const updatedSource = await transaction.stockBalance.update({ where: { id: sourceBalance.id }, data: { quantityOnHand: { decrement: input.quantity } } });
    const updatedDestination = await transaction.stockBalance.upsert({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.destinationWarehouseId } },
      create: { productId: input.productId, warehouseId: input.destinationWarehouseId, quantityOnHand: input.quantity },
      update: { quantityOnHand: { increment: input.quantity } },
    });
    const shared = { productId: input.productId, transferGroupId, quantity: input.quantity, reference: input.reference?.trim() || null, notes: input.notes?.trim() || null, createdById: userId };
    const [outgoing, incoming] = await Promise.all([
      transaction.stockLedger.create({ data: { ...shared, warehouseId: input.sourceWarehouseId, movementType: "TRANSFER_OUT" } }),
      transaction.stockLedger.create({ data: { ...shared, warehouseId: input.destinationWarehouseId, movementType: "TRANSFER_IN" } }),
    ]);
    return { transferGroupId, sourceBalance: updatedSource, destinationBalance: updatedDestination, outgoing, incoming };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
