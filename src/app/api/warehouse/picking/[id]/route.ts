import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.pickingList.findUnique({
    where: { id },
    include: {
      salesOrder: { include: { customer: true } },
      warehouse: true,
      items: { include: { salesOrderItem: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } } } },
    },
  });
  if (!list || user.role === "SALES_EXECUTIVE" && list.salesOrder.assignedSalesExecutiveId !== user.id && list.salesOrder.createdById !== user.id && list.salesOrder.customer.assignedSalesExecutiveId !== user.id) return NextResponse.json({ error: "Picking list not found." }, { status: 404 });
  return NextResponse.json(list);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = body as { action?: string; itemId?: string; quantity?: number; discrepancyNote?: string };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const list = await tx.pickingList.findUnique({ where: { id }, include: { salesOrder: { include: { customer: true } }, items: true } });
      if (!list || user.role === "SALES_EXECUTIVE" && list.salesOrder.assignedSalesExecutiveId !== user.id && list.salesOrder.createdById !== user.id && list.salesOrder.customer.assignedSalesExecutiveId !== user.id) throw new Error("Picking list not found.");
      if (list.salesOrder.status !== "CONFIRMED") throw new Error("Picking is only allowed for confirmed orders.");
      if (list.status === "COMPLETED") throw new Error("Completed picking lists cannot be edited.");
      if (input.action === "START") {
        const updated = await tx.pickingList.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: list.startedAt ?? new Date() } });
        await tx.salesOrderEvent.create({ data: { salesOrderId: list.salesOrderId, actorId: user.id, action: "PICKING_STARTED", details: { pickingReference: list.reference } } });
        return updated;
      }
      if (input.action === "UPDATE_ITEM") {
        if (typeof input.itemId !== "string" || !Number.isInteger(input.quantity) || input.quantity! < 0) throw new Error("Provide a valid picked quantity.");
        const item = list.items.find((row) => row.id === input.itemId); if (!item) throw new Error("Picking item not found.");
        if (input.quantity! > item.reservedQuantity) throw new Error("Picked quantity cannot exceed the reserved quantity.");
        if (input.quantity! < item.reservedQuantity && !input.discrepancyNote?.trim()) throw new Error("Add a discrepancy note when picked quantity is below reserved quantity.");
        await tx.pickingListItem.update({ where: { id: item.id }, data: { pickedQuantity: input.quantity, discrepancyNote: input.discrepancyNote?.trim().slice(0, 500) || null, pickedById: user.id, pickedAt: new Date() } });
        await tx.salesOrderEvent.create({ data: { salesOrderId: list.salesOrderId, actorId: user.id, action: "PICKED_QUANTITY_UPDATED", details: { pickingReference: list.reference, salesOrderItemId: item.salesOrderItemId, previousQuantity: item.pickedQuantity, newQuantity: input.quantity, discrepancyNote: input.discrepancyNote?.trim() || null } } });
        return tx.pickingList.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: list.startedAt ?? new Date() }, include: { items: true } });
      }
      if (input.action === "COMPLETE") {
        const missing = list.items.filter((item) => item.pickedQuantity < item.reservedQuantity && !item.discrepancyNote);
        if (missing.length) throw new Error("Record a reason for each picking discrepancy before completion.");
        const completed = await tx.pickingList.update({ where: { id }, data: { status: "COMPLETED", startedAt: list.startedAt ?? new Date(), completedAt: new Date() }, include: { items: true } });
        await tx.salesOrderEvent.create({ data: { salesOrderId: list.salesOrderId, actorId: user.id, action: "PICKING_COMPLETED", details: { pickingReference: list.reference } } });
        return completed;
      }
      throw new Error("Unknown picking action.");
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Picking update failed." }, { status: 400 }); }
}
