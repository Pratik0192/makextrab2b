import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOperateOrder, nextDispatchRef } from "@/lib/warehouse-ops";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = body as { items?: Array<{ packageItemId: string; quantity: number }>; courierName?: string; trackingNumber?: string; notes?: string };
  const order = await prisma.salesOrder.findUnique({ where: { id }, include: { customer: true, packingRecords: { include: { packages: true } } } });
  if (!order || !canOperateOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  if (order.status !== "CONFIRMED" || !order.packingRecords.some((r) => r.status === "COMPLETED")) return NextResponse.json({ error: "Complete packing before creating a dispatch." }, { status: 409 });
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.some((i) => !i || typeof i.packageItemId !== "string" || !Number.isInteger(i.quantity) || i.quantity <= 0)) return NextResponse.json({ error: "Provide one or more packed items with positive whole quantities." }, { status: 400 });
  try {
    const ref = await nextDispatchRef();
    const created = await prisma.$transaction(async (tx) => {
      const packageIds = [...new Set(input.items!.map((i) => i.packageItemId))];
      const packageItems = await tx.packageItem.findMany({ where: { id: { in: packageIds }, package: { packingRecord: { salesOrderId: id, status: "COMPLETED" } } }, include: { package: { include: { packingRecord: true } }, dispatchItems: { where: { dispatch: { status: { in: ["DRAFT", "CONFIRMED"] } } } } } });
      if (packageItems.length !== packageIds.length) throw new Error("One or more package items are unavailable for dispatch.");
      const rows = input.items!.map((i) => { const item = packageItems.find((p) => p.id === i.packageItemId)!; const alreadyAllocated = item.dispatchItems.reduce((sum, line) => sum + line.quantity, 0); const totalRequest = input.items!.filter((line) => line.packageItemId === i.packageItemId).reduce((sum, line) => sum + line.quantity, 0); if (alreadyAllocated + totalRequest > item.packedQuantity) throw new Error("Dispatch quantity exceeds packed quantity."); return { packageItemId: i.packageItemId, quantity: i.quantity }; });
      if (new Set(rows.map((r) => r.packageItemId)).size !== rows.length) throw new Error("Do not repeat a package item in the dispatch.");
      return tx.dispatch.create({ data: { reference: ref, salesOrderId: id, warehouseId: order.packingRecords.find((r) => r.status === "COMPLETED")!.warehouseId, createdById: user.id, courierName: input.courierName?.trim().slice(0, 120) || null, trackingNumber: input.trackingNumber?.trim().slice(0, 120) || null, notes: input.notes?.trim().slice(0, 1000) || null, packageCount: new Set(packageItems.map((p) => p.packageId)).size, items: { create: rows } }, include: { items: true } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(created, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dispatch could not be created." }, { status: 409 }); }
}
