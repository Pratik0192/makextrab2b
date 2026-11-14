import { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { deleteProductImageAsset } from "@/lib/cloudinary";
import { adminProductInclude, parseProductWriteData } from "@/lib/product-data";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  const product = await prisma.product.findUnique({ where: { id }, include: adminProductInclude });
  if (!product) return apiError(404, "NOT_FOUND", "Product was not found.");
  return apiSuccess(product);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(400, "INVALID_JSON", "Product details must be valid JSON."); }
  const parsed = parseProductWriteData(body, true);
  if (!parsed.data) return apiError(400, parsed.error?.code ?? "VALIDATION_ERROR", parsed.error?.message ?? "Product details are invalid.", undefined, parsed.error?.field);
  const productData = parsed.data;
  if (Object.keys(parsed.data).length === 0) return apiError(400, "EMPTY_UPDATE", "Provide at least one product field to update.");
  if (parsed.data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true } });
    if (!category) return apiError(400, "INVALID_CATEGORY", "Select an existing category.", undefined, "categoryId");
  }
  if (parsed.data.collectionId) {
    const collection = await prisma.collection.findUnique({ where: { id: parsed.data.collectionId }, select: { id: true } });
    if (!collection) return apiError(400, "INVALID_COLLECTION", "Select an existing collection.", undefined, "collectionId");
  }
  try {
    const product = await prisma.$transaction(async (tx) => {
      const previous = await tx.product.findUnique({ where: { id }, select: { wholesalePrice: true } });
      if (!previous) throw new Error("PRODUCT_NOT_FOUND");
      const updated = await tx.product.update({ where: { id }, data: productData, include: adminProductInclude });
      const nextPrice = productData.wholesalePrice;
      if (nextPrice && (!previous.wholesalePrice || !previous.wholesalePrice.equals(nextPrice))) {
        await tx.productPriceHistory.create({ data: { productId: id, previousPrice: previous.wholesalePrice, newPrice: nextPrice, updatedById: auth.id } });
      }
      return updated;
    });
    return apiSuccess(product);
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return apiError(404, "NOT_FOUND", "Product was not found.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return apiError(409, "DUPLICATE_SKU", "This SKU is already assigned to another product.", undefined, "sku");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return apiError(404, "NOT_FOUND", "Product was not found.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return apiError(400, "INVALID_REFERENCE", "The selected category or collection is no longer available.");
    console.error("Product update failed", error);
    return apiError(500, "PRODUCT_UPDATE_FAILED", "The product could not be updated. Please try again.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: true, stockBalances: true, _count: { select: { stockLedger: true } } },
  });
  if (!product) return apiError(404, "NOT_FOUND", "Product was not found.");

  const hasMovementHistory = product._count.stockLedger > 0;
  const hasStock = product.stockBalances.some((balance) =>
    balance.quantityOnHand > 0 || balance.quantityReserved > 0 || balance.quantityBlocked > 0,
  );
  if (hasMovementHistory || hasStock) {
    const deactivated = await prisma.product.update({ where: { id }, data: { isActive: false }, include: adminProductInclude });
    return apiSuccess({ deleted: false, deactivated: true, product: deactivated });
  }

  try {
    for (const image of product.images) {
      if (image.publicId) await deleteProductImageAsset(image.publicId);
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.stockBalance.deleteMany({ where: { productId: id } });
      await transaction.product.delete({ where: { id } });
    });
    return apiSuccess({ deleted: true, deactivated: false });
  } catch (error) {
    return apiFailure(error);
  }
}
