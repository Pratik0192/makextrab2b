import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, positiveInteger, requireSuperAdmin } from "@/lib/admin-api";

const movementTypes = ["OPENING_STOCK", "STOCK_IN", "STOCK_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "TRANSFER_IN", "TRANSFER_OUT"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1, 1_000_000);
  const pageSize = positiveInteger(params.get("pageSize"), 50, 100);
  const productId = params.get("productId") || undefined;
  const warehouseId = params.get("warehouseId") || undefined;
  const movementTypeValue = params.get("movementType");
  if (movementTypeValue && !movementTypes.includes(movementTypeValue as typeof movementTypes[number])) {
    return apiError(400, "INVALID_MOVEMENT_TYPE", "Select a valid stock movement type.");
  }
  const from = params.get("from");
  const to = params.get("to");
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return apiError(400, "INVALID_DATE_RANGE", "Date filters must be valid dates.");
  }
  const where: Prisma.StockLedgerWhereInput = {
    ...(productId ? { productId } : {}),
    ...(warehouseId ? { warehouseId } : {}),
    ...(movementTypeValue ? { movementType: movementTypeValue as Prisma.EnumStockMovementTypeFilter["equals"] } : {}),
    ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.stockLedger.findMany({ where, include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.stockLedger.count({ where }),
  ]);
  return apiSuccess({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
