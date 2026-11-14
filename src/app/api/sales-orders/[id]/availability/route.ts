import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { canAccessOrder } from "@/lib/sales-orders";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const warehouseId = request.nextUrl.searchParams.get("warehouseId");
  if (!warehouseId) return NextResponse.json({ error: "Select a warehouse." }, { status: 400 });
  const order = await prisma.salesOrder.findUnique({ where: { id }, include: { customer: true, items: true } });
  if (!order || !canAccessOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, isActive: true }, select: { id: true, name: true, code: true } });
  if (!warehouse) return NextResponse.json({ error: "Active warehouse not found." }, { status: 404 });
  const productIds = [...new Set(order.items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
  const balances = await prisma.stockBalance.findMany({ where: { warehouseId, productId: { in: productIds } }, include: { product: { select: { name: true, sku: true } } } });
  const byProduct = new Map(balances.map((balance) => [balance.productId, balance]));
  const items = order.items.map((item) => { const balance = item.productId ? byProduct.get(item.productId) : undefined; const available = balance ? balance.quantityOnHand - balance.quantityReserved - balance.quantityBlocked : 0; return { productId: item.productId, name: item.productNameSnapshot, sku: item.skuSnapshot, required: item.quantity, onHand: balance?.quantityOnHand ?? 0, reserved: balance?.quantityReserved ?? 0, blocked: balance?.quantityBlocked ?? 0, available, shortage: Math.max(0, item.quantity - available) }; });
  return NextResponse.json({ warehouse, items, canReserve: items.every((item) => item.shortage === 0) });
}
