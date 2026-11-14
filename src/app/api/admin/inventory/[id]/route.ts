import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { inventoryRelations, withAvailableQuantity } from "@/lib/inventory-api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  const balance = await prisma.stockBalance.findUnique({ where: { id }, include: inventoryRelations });
  if (!balance) return apiError(404, "NOT_FOUND", "Stock balance was not found.");
  return apiSuccess(withAvailableQuantity(balance));
}
