import { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, isRecord, requireSuperAdmin } from "@/lib/admin-api";

type Context = { params: Promise<{ id: string }> };

function parsePatch(value: unknown): { data: Prisma.CategoryUpdateInput | null; message?: string } {
  if (!isRecord(value)) return { data: null, message: "Category details must be an object." };
  if ("imageUrl" in value) return { data: null, message: "Upload category images as files using the image endpoint." };
  const data: Prisma.CategoryUpdateInput = {};
  if ("name" in value) {
    if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 120) return { data: null, message: "Enter a category name up to 120 characters." };
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
  if (Object.keys(data).length === 0) return { data: null, message: "Provide at least one category field to update." };
  return { data };
}

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!category) return apiError(404, "NOT_FOUND", "Category was not found.");
  return apiSuccess({ ...category, productCount: category._count.products });
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "Category details must be valid JSON."); }
  const parsed = parsePatch(body);
  if (!parsed.data) return apiError(400, "VALIDATION_ERROR", parsed.message ?? "Category details are invalid.");
  if (typeof parsed.data.name === "string") {
    const duplicate = await prisma.category.findFirst({ where: { id: { not: id }, name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) return apiError(409, "DUPLICATE_CATEGORY", "A category with this name already exists.");
  }
  try {
    const category = await prisma.category.update({ where: { id }, data: parsed.data, include: { _count: { select: { products: true } } } });
    return apiSuccess({ ...category, productCount: category._count.products });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return apiError(404, "NOT_FOUND", "Category was not found.");
    return apiFailure(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!category) return apiError(404, "NOT_FOUND", "Category was not found.");
  if (category._count.products > 0) return apiError(409, "CATEGORY_IN_USE", "Reassign or deactivate this category before deleting it.");
  await prisma.category.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
