import { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, isRecord, requireSuperAdmin } from "@/lib/admin-api";
import { InventoryOperationError, recordStockAdjustment, recordStockIn, recordStockOut, type StockMovementInput } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

type MovementKind = "in" | "out" | "adjustment";

function parseInput(value: unknown, kind: MovementKind): StockMovementInput | null {
  if (!isRecord(value) || typeof value.productId !== "string" || typeof value.warehouseId !== "string" ||
    typeof value.quantity !== "number" || !Number.isInteger(value.quantity)) return null;
  const optionalText = (key: string, max: number): string | null => {
    const raw = value[key];
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== "string" || raw.length > max) throw new InventoryOperationError("VALIDATION_ERROR", `${key} is invalid.`);
    return raw.trim() || null;
  };
  const input: StockMovementInput = {
    productId: value.productId,
    warehouseId: value.warehouseId,
    quantity: value.quantity,
    reference: optionalText("reference", 120),
    notes: optionalText("notes", 1000),
  };
  input.reason = optionalText("reason", 300);
  if (kind === "in" && "reorderLevel" in value) {
    if (value.reorderLevel !== null && (typeof value.reorderLevel !== "number" || !Number.isInteger(value.reorderLevel))) {
      throw new InventoryOperationError("INVALID_REORDER_LEVEL", "Reorder level must be a whole number.");
    }
    input.reorderLevel = value.reorderLevel as number | null;
  }
  return input;
}

export async function handleStockMovement(request: NextRequest, kind: MovementKind) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(400, "INVALID_JSON", "Stock movement details must be valid JSON."); }
  let input: StockMovementInput | null;
  try { input = parseInput(body, kind); }
  catch (error) {
    if (error instanceof InventoryOperationError) return apiError(error.status, error.code, error.message);
    return apiError(400, "VALIDATION_ERROR", "Stock movement details are invalid.");
  }
  if (!input) return apiError(400, "VALIDATION_ERROR", "Provide a product, warehouse, and whole-number quantity.");
  try {
    const result = kind === "in" ? await recordStockIn(auth.id, input) :
      kind === "out" ? await recordStockOut(auth.id, input) : await recordStockAdjustment(auth.id, input);
    const availableQuantity = result.balance.quantityOnHand - result.balance.quantityReserved - result.balance.quantityBlocked;
    return apiSuccess({ ...result, availableQuantity });
  } catch (error) {
    if (error instanceof InventoryOperationError) return apiError(error.status, error.code, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return apiError(409, "CONCURRENT_UPDATE", "Stock changed at the same time. Refresh and retry.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return apiError(400, "INVALID_REFERENCE", "The selected product, warehouse, or user is no longer available.");
    }
    return apiFailure(error);
  }
}

export const inventoryRelations = {
  product: {
    select: {
      id: true, name: true, sku: true,
      images: { orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }], take: 1, select: { id: true, imageUrl: true, altText: true, isPrimary: true, displayOrder: true, createdAt: true } },
    },
  },
  warehouse: { select: { id: true, name: true, code: true } },
} satisfies Prisma.StockBalanceInclude;

export function withAvailableQuantity<T extends { quantityOnHand: number; quantityReserved: number; quantityBlocked: number; reorderLevel: number | null }>(balance: T) {
  const availableQuantity = balance.quantityOnHand - balance.quantityReserved - balance.quantityBlocked;
  const stockStatus = availableQuantity <= 0 ? "OUT_OF_STOCK" : balance.reorderLevel !== null && availableQuantity <= balance.reorderLevel ? "LOW_STOCK" : "IN_STOCK";
  return { ...balance, availableQuantity, stockStatus };
}

export async function getLowStockIds(page: number, pageSize: number, search: string | null, warehouseId: string | null) {
  const offset = (page - 1) * pageSize;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT b."id"
    FROM "StockBalance" b
    JOIN "Product" p ON p."id" = b."productId"
    WHERE (b."quantityOnHand" - b."quantityReserved" - b."quantityBlocked") <= COALESCE(b."reorderLevel", 0)
      AND (CAST(${warehouseId} AS text) IS NULL OR b."warehouseId" = ${warehouseId})
      AND (CAST(${search} AS text) IS NULL OR p."name" ILIKE ('%' || ${search} || '%') OR p."sku" ILIKE ('%' || ${search} || '%'))
    ORDER BY b."updatedAt" DESC, b."id" ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const counts = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total
    FROM "StockBalance" b
    JOIN "Product" p ON p."id" = b."productId"
    WHERE (b."quantityOnHand" - b."quantityReserved" - b."quantityBlocked") <= COALESCE(b."reorderLevel", 0)
      AND (CAST(${warehouseId} AS text) IS NULL OR b."warehouseId" = ${warehouseId})
      AND (CAST(${search} AS text) IS NULL OR p."name" ILIKE ('%' || ${search} || '%') OR p."sku" ILIKE ('%' || ${search} || '%'))
  `;
  return { ids: rows.map((row) => row.id), total: Number(counts[0]?.total ?? 0) };
}
