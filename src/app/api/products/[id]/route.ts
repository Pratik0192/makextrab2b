import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { publicProductSelect } from "@/lib/product-data";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await prisma.product.findFirst({ where: { id, isActive: true, category: { isActive: true }, OR: [{ collectionId: null }, { collection: { isActive: true } }] }, select: publicProductSelect });
  if (!product) return apiError(404, "NOT_FOUND", "Product was not found.");
  return apiSuccess(product);
}
