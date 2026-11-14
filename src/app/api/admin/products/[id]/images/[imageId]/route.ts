import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { deleteProductImageAsset } from "@/lib/cloudinary";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id: productId, imageId } = await context.params;
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.productId !== productId) return apiError(404, "NOT_FOUND", "Product image was not found.");

  if (image.publicId) {
    try { await deleteProductImageAsset(image.publicId); }
    catch { return apiError(502, "CLOUDINARY_DELETE_FAILED", "The image could not be removed from Cloudinary; its record was kept."); }
  }

  try {
    const remaining = await prisma.$transaction(async (transaction) => {
      await transaction.productImage.delete({ where: { id: imageId } });
      const nextImage = await transaction.productImage.findFirst({
        where: { productId }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      });
      if (nextImage && !nextImage.isPrimary) {
        await transaction.productImage.update({ where: { id: nextImage.id }, data: { isPrimary: true } });
      }
      return transaction.productImage.findMany({ where: { productId }, orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }] });
    });
    return apiSuccess(remaining);
  } catch (error) {
    return apiFailure(error);
  }
}
