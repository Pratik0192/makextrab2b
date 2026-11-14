import { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, isRecord, positiveInteger, requireSuperAdmin } from "@/lib/admin-api";

const limits = { name: 120, code: 32, description: 1000, address: 300, city: 100, state: 100, pincode: 20, contactPerson: 120, contactPhone: 40 } as const;
type WarehouseData = Prisma.WarehouseUncheckedCreateInput;

function parseWarehouse(value: unknown, partial: boolean): { data: Partial<WarehouseData> | null; message?: string } {
  if (!isRecord(value)) return { data: null, message: "Warehouse details must be an object." };
  const data: Partial<WarehouseData> = {};
  for (const key of Object.keys(limits) as Array<keyof typeof limits>) {
    if (!(key in value)) {
      if (!partial && (key === "name" || key === "code")) return { data: null, message: `${key} is required.` };
      continue;
    }
    if (value[key] !== null && typeof value[key] !== "string") return { data: null, message: `${key} must be text.` };
    const text = typeof value[key] === "string" ? value[key].trim() : "";
    const required = key === "name" || key === "code";
    if (required && !text) return { data: null, message: `${key} is required.` };
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
  return { data };
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1, 1_000_000);
  const pageSize = positiveInteger(params.get("pageSize"), 50, 100);
  const search = params.get("search")?.trim().slice(0, 100);
  const active = params.get("active");
  const where = {
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { code: { contains: search, mode: "insensitive" as const } },
      { city: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
    ...(active === "true" || active === "false" ? { isActive: active === "true" } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.warehouse.findMany({ where, include: { _count: { select: { stockBalances: true, stockLedger: true } } }, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.warehouse.count({ where }),
  ]);
  return apiSuccess({ items: items.map(({ _count, ...warehouse }) => ({ ...warehouse, stockRecordCount: _count.stockBalances, movementCount: _count.stockLedger })), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Warehouse details must be valid JSON."); }
  const parsed = parseWarehouse(body, false);
  if (!parsed.data) return apiError(400, "VALIDATION_ERROR", parsed.message ?? "Warehouse details are invalid.");
  try {
    const warehouse = await prisma.warehouse.create({ data: parsed.data as Prisma.WarehouseUncheckedCreateInput, include: { _count: { select: { stockBalances: true, stockLedger: true } } } });
    return apiSuccess({ ...warehouse, stockRecordCount: warehouse._count.stockBalances, movementCount: warehouse._count.stockLedger }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return apiError(409, "DUPLICATE_WAREHOUSE_CODE", "A warehouse with this code already exists.");
    return apiFailure(error);
  }
}
