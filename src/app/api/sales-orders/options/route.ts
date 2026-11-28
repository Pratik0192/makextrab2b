import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const customerId = request.nextUrl.searchParams.get("customerId");
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { status: "ACTIVE", ...(customerId ? { id: customerId } : {}), ...(user.role === "SALES_EXECUTIVE" ? { assignedSalesExecutiveId: user.id } : {}) },
      select: { id: true, customerCode: true, businessName: true, buyerName: true, mobile: true, assignedSalesExecutiveId: true, businessAddress: true, city: true, state: true, pincode: true, deliveryAddress: true, deliveryCity: true, deliveryState: true, deliveryPincode: true, deliveryContactName: true, deliveryContactPhone: true },
      orderBy: { businessName: "asc" }, take: 500,
    }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, sku: true, minimumOrderQuantity: true, wholesalePrice: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  return NextResponse.json({ customers, products: products.map(({ wholesalePrice, ...product }) => ({ ...product, wholesalePrice: wholesalePrice?.toString() ?? null })) });
}
