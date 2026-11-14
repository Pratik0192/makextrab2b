import { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, isRecord, positiveInteger, requireSuperAdmin } from "@/lib/admin-api";

function parseCollection(value: unknown, partial: boolean): { data: Record<string, unknown> | null; message?: string } {
  if (!isRecord(value)) return { data: null, message: "Collection details must be an object." };
  const data: Record<string, unknown> = {};
  if ("imageUrl" in value) return { data: null, message: "Upload collection images as files using the image endpoint." };
  if ("name" in value || !partial) {
    if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 120) return { data: null, message: "Enter a collection name up to 120 characters." };
    data.name = value.name.trim();
  }
  for (const key of ["description"] as const) {
    if (!(key in value)) continue;
    const raw = value[key];
    if (raw !== null && typeof raw !== "string") return { data: null, message: `${key} must be text.` };
    const text = typeof raw === "string" ? raw.trim() : "";
    if (key === "description" && text.length > 1000) return { data: null, message: "Description is too long." };
    data[key] = text || null;
  }
  if ("isActive" in value) {
    if (typeof value.isActive !== "boolean") return { data: null, message: "isActive must be true or false." };
    data.isActive = value.isActive;
  }
  if ("displayOrder" in value) {
    if (typeof value.displayOrder !== "number" || !Number.isInteger(value.displayOrder) || value.displayOrder < 0 || value.displayOrder > 1_000_000) return { data: null, message: "Display order must be a non-negative whole number." };
    data.displayOrder = value.displayOrder;
  }
  if (partial && Object.keys(data).length === 0) return { data: null, message: "Provide at least one collection field to update." };
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
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    ...(active === "true" || active === "false" ? { isActive: active === "true" } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.collection.findMany({ where, include: { _count: { select: { products: true } } }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.collection.count({ where }),
  ]);
  return apiSuccess({ items: items.map(({ _count, ...collection }) => ({ ...collection, productCount: _count.products })), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Collection details must be valid JSON."); }
  const parsed = parseCollection(body, false);
  if (!parsed.data) return apiError(400, "VALIDATION_ERROR", parsed.message ?? "Collection details are invalid.");
  const name = parsed.data.name as string;
  const duplicate = await prisma.collection.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (duplicate) return apiError(409, "DUPLICATE_COLLECTION", "A collection with this name already exists.");
  try {
    const collection = await prisma.collection.create({ data: parsed.data as Prisma.CollectionUncheckedCreateInput, include: { _count: { select: { products: true } } } });
    return apiSuccess({ ...collection, productCount: collection._count.products }, 201);
  } catch (error) { return apiFailure(error); }
}
