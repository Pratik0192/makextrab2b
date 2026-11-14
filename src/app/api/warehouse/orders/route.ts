import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.trim(); const warehouseId = request.nextUrl.searchParams.get("warehouseId") || undefined; const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1)); const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") || 20)));
  const where = { status: "CONFIRMED" as const, reservations: { some: { status: "RESERVED" as const, ...(warehouseId ? { warehouseId } : {}) } }, AND: [ ...(user.role === "SALES_EXECUTIVE" ? [{ OR: [{ assignedSalesExecutiveId: user.id }, { createdById: user.id }, { customer: { assignedSalesExecutiveId: user.id } }] }] : []), ...(q ? [{ OR: [{ orderNumber: { contains: q, mode: "insensitive" as const } }, { customer: { businessName: { contains: q, mode: "insensitive" as const } } }] }] : []) ] };
  const [items, total] = await Promise.all([prisma.salesOrder.findMany({ where, include: { customer: { select: { businessName: true } }, assignedSalesExecutive: { select: { firstName: true, lastName: true } }, reservations: { where: { status: "RESERVED" }, include: { warehouse: { select: { id: true, name: true, code: true } } } }, items: { select: { id: true, quantity: true } }, pickingList: { select: { status: true } }, packingRecords: { select: { status: true } }, dispatches: { select: { status: true, deliveryStatus: true }, orderBy: { createdAt: "asc" } } }, orderBy: { orderDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.salesOrder.count({ where })]);
  return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
