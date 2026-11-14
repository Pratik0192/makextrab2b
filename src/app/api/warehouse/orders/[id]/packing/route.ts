import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOperateOrder, createPackingRecord } from "@/lib/warehouse-ops";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const order = await prisma.salesOrder.findUnique({ where: { id }, include: { customer: true } });
  if (!order || !canOperateOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  const body = await request.json().catch(() => null); if (!body || typeof body !== "object" || !Array.isArray((body as any).packages)) return NextResponse.json({ error: "Provide package details." }, { status: 400 });
  try { const record = await createPackingRecord(id, user.id, body as any); await prisma.salesOrderEvent.create({ data: { salesOrderId: id, actorId: user.id, action: "PACKAGES_CREATED", details: { packingReference: record.reference, packageCount: record.packages.length } } }); return NextResponse.json(record, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Packing could not be created." }, { status: 400 }); }
}
