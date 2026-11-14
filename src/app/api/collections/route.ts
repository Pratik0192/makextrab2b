import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-response";
import { positiveInteger } from "@/lib/admin-api";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1, 1_000_000);
  const pageSize = positiveInteger(params.get("pageSize"), 50, 100);
  const search = params.get("search")?.trim().slice(0, 100);
  const where = { isActive: true, ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}) };
  const [items, total] = await Promise.all([
    prisma.collection.findMany({ where, select: { id: true, name: true, description: true, imageUrl: true, displayOrder: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.collection.count({ where }),
  ]);
  return apiSuccess({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
