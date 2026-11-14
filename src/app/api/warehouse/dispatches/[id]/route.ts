import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOperateOrder } from "@/lib/warehouse-ops";
import { confirmDispatch } from "@/lib/warehouse-ops";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const dispatch = await prisma.dispatch.findUnique({ where: { id }, include: { salesOrder: { include: { customer: true } }, warehouse: true, createdBy: { select: { firstName: true, lastName: true } }, confirmedBy: { select: { firstName: true, lastName: true } }, items: { include: { packageItem: { include: { package: true, salesOrderItem: true } } } }, deliveryEvents: { include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!dispatch || !canOperateOrder(user, dispatch.salesOrder)) return NextResponse.json({ error: "Dispatch not found." }, { status: 404 }); return NextResponse.json(dispatch);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const body = await request.json().catch(() => ({})); const action = (body as any).action;
  const dispatch = await prisma.dispatch.findUnique({ where: { id }, include: { salesOrder: { include: { customer: true } } } });
  if (!dispatch || !canOperateOrder(user, dispatch.salesOrder)) return NextResponse.json({ error: "Dispatch not found." }, { status: 404 });
  if (action === "CONFIRM") {
    try { return NextResponse.json(await confirmDispatch(id, user.id)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dispatch confirmation failed." }, { status: 409 }); }
  }
  if (action === "CANCEL_DRAFT" && dispatch.status === "DRAFT") { const result = await prisma.dispatch.updateMany({ where: { id, status: "DRAFT" }, data: { status: "CANCELLED" } }); return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Dispatch status changed." }, { status: 409 }); }
  return NextResponse.json({ error: "Unknown or invalid dispatch action." }, { status: 409 });
}
