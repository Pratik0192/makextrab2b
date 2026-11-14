import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams; const page = Math.max(1, Number(params.get("page") || 1)); const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") || 20))); const q = params.get("q")?.trim();
  const where = { ...(params.get("status") ? { status: params.get("status") as never } : {}), AND: [ ...(user.role === "SALES_EXECUTIVE" ? [{ OR: [{ assignedSalesExecutiveId: user.id }, { createdById: user.id }, { customer: { assignedSalesExecutiveId: user.id } }] }] : []), ...(q ? [{ OR: [{ orderNumber: { contains: q, mode: "insensitive" as const } }, { customer: { businessName: { contains: q, mode: "insensitive" as const } } }, { quotation: { quotationNumber: { contains: q, mode: "insensitive" as const } } }] }] : []) ] };
  const [items, total] = await Promise.all([prisma.salesOrder.findMany({ where, include: { customer: { select: { businessName: true } }, quotation: { select: { quotationNumber: true } }, reservations: { select: { status: true } } }, orderBy: { orderDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.salesOrder.count({ where })]);
  return NextResponse.json({ items, total, page, pageSize });
}
