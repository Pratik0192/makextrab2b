import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = request.nextUrl.searchParams; const page = Math.max(1, Number(p.get("page") || 1)); const pageSize = [10,20,50,100].includes(Number(p.get("pageSize"))) ? Number(p.get("pageSize")) : 20;
  const q = p.get("q")?.trim(); const status = p.get("status");
  const where = { ...(user.role === "SALES_EXECUTIVE" ? { assignedSalesExecutiveId: user.id } : {}), ...(status && ["ACTIVE","INACTIVE","BLOCKED"].includes(status) ? { status: status as "ACTIVE"|"INACTIVE"|"BLOCKED" } : {}), ...(p.get("businessType") ? { businessType: p.get("businessType") as never } : {}), ...(p.get("city") ? { city: { contains: p.get("city")!, mode: "insensitive" as const } } : {}), ...(p.get("state") ? { state: { contains: p.get("state")!, mode: "insensitive" as const } } : {}), ...(p.get("assignedTo") && user.role === "SUPER_ADMIN" ? { assignedSalesExecutiveId: p.get("assignedTo")! } : {}), ...(p.get("from") || p.get("to") ? { convertedAt: { ...(p.get("from") ? { gte: new Date(p.get("from")!) } : {}), ...(p.get("to") ? { lte: new Date(`${p.get("to")}T23:59:59.999Z`) } : {}) } } : {}), ...(q ? { OR: ["customerCode","businessName","buyerName","mobile","email","gstin"].map(field => ({ [field]: { contains: q, mode: "insensitive" as const } })) } : {}) };
  const [items,total] = await Promise.all([prisma.customer.findMany({ where, include: { assignedSalesExecutive: { select: { firstName:true,lastName:true } }, convertedFromLead: { select: { referenceNumber:true } } }, orderBy: p.get("sort") === "oldest" ? { convertedAt:"asc" } : p.get("sort") === "business" ? { businessName:"asc" } : p.get("sort") === "code" ? { customerCode:"asc" } : { convertedAt:"desc" }, skip:(page-1)*pageSize,take:pageSize }), prisma.customer.count({where})]);
  return NextResponse.json({ items, total, page, pageSize });
}
