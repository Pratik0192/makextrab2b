import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-response";
import { isAuthFailure, positiveInteger, requireSuperAdmin } from "@/lib/admin-api";
import { getLowStockIds, inventoryRelations, withAvailableQuantity } from "@/lib/inventory-api";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1, 1_000_000);
  const pageSize = positiveInteger(params.get("pageSize"), 50, 100);
  const search = params.get("search")?.trim().slice(0, 100) || null;
  const warehouseId = params.get("warehouseId")?.trim() || null;
  const lowStock = params.get("lowStock") === "true";

  if (lowStock) {
    const { ids, total } = await getLowStockIds(page, pageSize, search, warehouseId);
    const records = ids.length ? await prisma.stockBalance.findMany({ where: { id: { in: ids } }, include: inventoryRelations }) : [];
    const byId = new Map(records.map((record) => [record.id, record]));
    const items = ids.map((id) => byId.get(id)).filter((record) => record !== undefined).map(withAvailableQuantity);
    return apiSuccess({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }

  const where = {
    ...(warehouseId ? { warehouseId } : {}),
    ...(search ? { product: { is: { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { sku: { contains: search, mode: "insensitive" as const } },
    ] } } } : {}),
  };
  const [records, total] = await Promise.all([
    prisma.stockBalance.findMany({ where, include: inventoryRelations, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.stockBalance.count({ where }),
  ]);
  return apiSuccess({ items: records.map(withAvailableQuantity), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
