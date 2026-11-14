import { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, isRecord, requireSuperAdmin } from "@/lib/admin-api";

type Context = { params: Promise<{ id: string }> };
const limits = { name: 120, code: 32, description: 1000, address: 300, city: 100, state: 100, pincode: 20, contactPerson: 120, contactPhone: 40 } as const;
type WarehouseData = Prisma.WarehouseUncheckedUpdateInput;

function parsePatch(value: unknown): { data: WarehouseData | null; message?: string } {
  if (!isRecord(value)) return { data: null, message: "Warehouse details must be an object." };
  const data: WarehouseData = {};
  for (const key of Object.keys(limits) as Array<keyof typeof limits>) {
    if (!(key in value)) continue;
    if (value[key] !== null && typeof value[key] !== "string") return { data: null, message: `${key} must be text.` };
    const text = typeof value[key] === "string" ? value[key].trim() : "";
    const required = key === "name" || key === "code";
    if (required && !text) return { data: null, message: `${key} cannot be empty.` };
    if (text.length > limits[key]) return { data: null, message: `${key} is too long.` };
    if (key === "code") {
      if (!/^[a-z0-9][a-z0-9_-]{1,31}$/i.test(text)) return { data: null, message: "Code may use letters, numbers, hyphens and underscores." };
      data.code = text.toUpperCase();
    } else data[key] = (text || null) as never;
  }
  if ("isActive" in value) {
    if (typeof value.isActive !== "boolean") return { data: null, message: "isActive must be true or false." };
    data.isActive = value.isActive;
  }
  if (Object.keys(data).length === 0) return { data: null, message: "Provide at least one warehouse field to update." };
  return { data };
}

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  const warehouse = await prisma.warehouse.findUnique({ where: { id }, include: { _count: { select: { stockBalances: true, stockLedger: true } } } });
  if (!warehouse) return apiError(404, "NOT_FOUND", "Warehouse was not found.");
  return apiSuccess({ ...warehouse, stockRecordCount: warehouse._count.stockBalances, movementCount: warehouse._count.stockLedger });
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Warehouse details must be valid JSON."); }
  const parsed = parsePatch(body);
  if (!parsed.data) return apiError(400, "VALIDATION_ERROR", parsed.message ?? "Warehouse details are invalid.");
  try {
    const warehouse = await prisma.warehouse.update({ where: { id }, data: parsed.data, include: { _count: { select: { stockBalances: true, stockLedger: true } } } });
    return apiSuccess({ ...warehouse, stockRecordCount: warehouse._count.stockBalances, movementCount: warehouse._count.stockLedger });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return apiError(409, "DUPLICATE_WAREHOUSE_CODE", "A warehouse with this code already exists.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return apiError(404, "NOT_FOUND", "Warehouse was not found.");
    return apiFailure(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  const warehouse = await prisma.warehouse.findUnique({ where: { id }, include: { _count: { select: { stockBalances: true, stockLedger: true } } } });
  if (!warehouse) return apiError(404, "NOT_FOUND", "Warehouse was not found.");
  if (warehouse._count.stockBalances > 0 || warehouse._count.stockLedger > 0) {
    return apiError(409, "WAREHOUSE_HAS_HISTORY", "This warehouse has stock or movement history. Deactivate it instead of deleting it.");
  }
  await prisma.warehouse.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
