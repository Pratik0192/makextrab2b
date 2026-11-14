import { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, isRecord, positiveInteger, requireSuperAdmin } from "@/lib/admin-api";
import { InventoryOperationError, recordStockTransfer } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Transfer details must be valid JSON."); }
  if (!isRecord(body) || typeof body.productId !== "string" || typeof body.sourceWarehouseId !== "string" || typeof body.destinationWarehouseId !== "string" || typeof body.quantity !== "number" || !Number.isInteger(body.quantity)) {
    return apiError(400, "VALIDATION_ERROR", "Provide a product, source and destination warehouse, and whole-number quantity.");
  }
  for (const key of ["reference", "notes"] as const) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") return apiError(400, "VALIDATION_ERROR", `${key} must be text.`);
  }
  try {
    const result = await recordStockTransfer(auth.id, {
      productId: body.productId,
      sourceWarehouseId: body.sourceWarehouseId,
      destinationWarehouseId: body.destinationWarehouseId,
      quantity: body.quantity,
      reference: typeof body.reference === "string" ? body.reference.trim() : null,
      notes: typeof body.notes === "string" ? body.notes.trim() : null,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof InventoryOperationError) return apiError(error.status, error.code, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return apiError(409, "CONCURRENT_UPDATE", "Stock changed at the same time. Refresh and retry the transfer.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return apiError(400, "INVALID_REFERENCE", "A selected product or warehouse is no longer available.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return apiError(409, "CONCURRENT_UPDATE", "A stock balance changed at the same time. Refresh and retry the transfer.");
    return apiFailure(error);
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const page = positiveInteger(request.nextUrl.searchParams.get("page"), 1, 1_000_000);
  const pageSize = positiveInteger(request.nextUrl.searchParams.get("pageSize"), 20, 100);
  const where: Prisma.StockLedgerWhereInput = {
    movementType: "TRANSFER_OUT",
    transferGroupId: { not: null },
    ...(request.nextUrl.searchParams.get("productId") ? { productId: request.nextUrl.searchParams.get("productId")! } : {}),
  };
  const [outgoing, total] = await Promise.all([
    prisma.stockLedger.findMany({ where, include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.stockLedger.count({ where }),
  ]);
  const groupIds = outgoing.map((row) => row.transferGroupId).filter((value): value is string => Boolean(value));
  const incoming = groupIds.length ? await prisma.stockLedger.findMany({ where: { transferGroupId: { in: groupIds }, movementType: "TRANSFER_IN" }, include: { warehouse: { select: { id: true, name: true, code: true } } } }) : [];
  const incomingByGroup = new Map(incoming.map((row) => [row.transferGroupId, row]));
  const items = outgoing.map((row) => ({
    id: row.transferGroupId!, transferGroupId: row.transferGroupId!, product: row.product,
    sourceWarehouse: row.warehouse, destinationWarehouse: incomingByGroup.get(row.transferGroupId!)?.warehouse ?? null,
    quantity: row.quantity, reference: row.reference, notes: row.notes, createdAt: row.createdAt, createdBy: row.createdBy,
  }));
  return apiSuccess({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
