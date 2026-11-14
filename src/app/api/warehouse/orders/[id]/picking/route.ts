import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOperateOrder, createPickingList } from "@/lib/warehouse-ops";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const order = await prisma.salesOrder.findUnique({ where: { id }, include: { customer: true } });
  if (!order || !canOperateOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  try { return NextResponse.json(await createPickingList(id, user.id), { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Picking list could not be created." }, { status: 409 }); }
}
