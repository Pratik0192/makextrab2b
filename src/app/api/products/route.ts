import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-response";
import { positiveInteger } from "@/lib/admin-api";
import { publicProductSelect } from "@/lib/product-data";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1, 1_000_000);
  const pageSize = positiveInteger(params.get("pageSize"), 12, 50);
  const search = params.get("search")?.trim().slice(0, 100);
  const categoryId = params.get("categoryId")?.trim();
  const collectionId = params.get("collectionId")?.trim();
  const featured = params.get("featured") === "true";
  const newArrival = params.get("newArrival") === "true";
  const sort = params.get("sort");
  const direction = params.get("direction") === "desc" ? "desc" : "asc";
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort === "name" ? [{ name: direction }] : sort === "createdAt" ? [{ createdAt: "desc" }] : [{ displayOrder: "asc" }, { createdAt: "desc" }];
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    category: { isActive: true },
    AND: [
      { OR: [{ collectionId: null }, { collection: { isActive: true } }] },
      ...(search ? [{ OR: [{ name: { contains: search, mode: "insensitive" as const } }, { sku: { contains: search, mode: "insensitive" as const } }] }] : []),
    ],
    ...(categoryId ? { categoryId } : {}),
    ...(collectionId ? { collectionId } : {}),
    ...(featured ? { isFeatured: true } : {}),
    ...(newArrival ? { isNewArrival: true } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, select: publicProductSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);
  return apiSuccess({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
