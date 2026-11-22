import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { canAccessOrder, reserveOrder } from "@/lib/sales-orders";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const body = await request.json().catch(() => ({})); const action = String(body.action ?? "");
  const order = await prisma.salesOrder.findUnique({ where: { id }, include: { customer: true } });
  if (!order || !canAccessOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  if (action === "SUBMIT") {
    if (!(["DRAFT", "REJECTED"].includes(order.status)) || user.role === "SALES_EXECUTIVE" && order.createdById !== user.id) return NextResponse.json({ error: "This order cannot be submitted by you." }, { status: 403 });
    const priorStatus = order.status;
    const changed = await prisma.salesOrder.updateMany({ where: { id, status: priorStatus as "DRAFT" | "REJECTED" }, data: { status: "AWAITING_APPROVAL" } });
    if (!changed.count) return NextResponse.json({ error: "Order status changed. Refresh and retry." }, { status: 409 });
    await prisma.salesOrderEvent.create({ data: { salesOrderId: id, actorId: user.id, action: priorStatus === "REJECTED" ? "RESUBMITTED_FOR_APPROVAL" : "SUBMITTED_FOR_APPROVAL" } });
    return NextResponse.json({ success: true, status: "AWAITING_APPROVAL" });
  }
  if (action === "APPROVE" || action === "RETRY_RESERVATION") {
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can approve orders or reserve stock." }, { status: 403 });
    try { const result = await reserveOrder(id, String(body.warehouseId ?? ""), user.id); return NextResponse.json({ success: true, ...result }, { status: result.status === "SHORTAGE" ? 409 : 200 }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed." }, { status: 409 }); }
  }
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super Admin access is required for this action." }, { status: 403 });
  if (action === "REJECT") {
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : ""; if (!reason) return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
    if (order.status !== "AWAITING_APPROVAL") return NextResponse.json({ error: "Only pending orders can be rejected." }, { status: 409 });
    await prisma.$transaction([prisma.salesOrder.update({ where: { id }, data: { status: "REJECTED" } }), prisma.salesOrderEvent.create({ data: { salesOrderId: id, actorId: user.id, action: "REJECTED", details: { reason } } })]);
    return NextResponse.json({ success: true, status: "REJECTED" });
  }
  if (action === "HOLD" || action === "RESUME") {
    if (action === "HOLD" && !["DRAFT", "AWAITING_APPROVAL", "CONFIRMED"].includes(order.status)) return NextResponse.json({ error: "This order cannot be put on hold." }, { status: 409 });
    if (action === "RESUME" && order.status !== "ON_HOLD") return NextResponse.json({ error: "Only held orders can be resumed." }, { status: 409 });
    const hasReservation = await prisma.salesOrderReservation.findFirst({ where: { salesOrderId: id, status: "RESERVED" }, select: { id: true } });
    const nextStatus = action === "HOLD" ? "ON_HOLD" : hasReservation ? "CONFIRMED" : "AWAITING_APPROVAL";
    await prisma.$transaction([prisma.salesOrder.update({ where: { id }, data: { status: nextStatus } }), prisma.salesOrderEvent.create({ data: { salesOrderId: id, actorId: user.id, action: action === "HOLD" ? "PLACED_ON_HOLD" : "RESUMED_TO_APPROVAL", details: { note: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null, activeReservationsRetained: true } } })]);
    return NextResponse.json({ success: true, status: nextStatus });
  }
  if (action === "CANCEL") {
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : ""; if (!reason) return NextResponse.json({ error: "A cancellation reason is required." }, { status: 400 });
    if (order.status === "CANCELLED") return NextResponse.json({ error: "Order is already cancelled." }, { status: 409 });
    try {
      await prisma.$transaction(async (tx) => {
        const confirmedDispatch = await tx.dispatch.findFirst({ where: { salesOrderId: id, status: "CONFIRMED" }, select: { id: true } });
        if (confirmedDispatch) throw new Error("An order with a confirmed dispatch cannot be cancelled. Record a delivery return workflow instead.");
        const reservations = await tx.salesOrderReservation.findMany({ where: { salesOrderId: id, status: "RESERVED" } });
        for (const reservation of reservations) {
          const remaining = reservation.quantity - reservation.consumedQuantity;
          const released = await tx.salesOrderReservation.updateMany({ where: { id: reservation.id, status: "RESERVED" }, data: { status: "RELEASED", releasedById: user.id, releasedAt: new Date(), releaseReason: reason } });
          if (released.count && remaining > 0) await tx.stockBalance.update({ where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } }, data: { quantityReserved: { decrement: remaining } } });
        }
        await tx.salesOrder.update({ where: { id }, data: { status: "CANCELLED", cancellationReason: reason } });
        await tx.salesOrderEvent.create({ data: { salesOrderId: id, actorId: user.id, action: "CANCELLED", details: { reason, releasedReservations: reservations.length } } });
      }, { isolationLevel: "Serializable" });
      return NextResponse.json({ success: true, status: "CANCELLED" });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Cancellation failed." }, { status: 409 }); }
  }
  return NextResponse.json({ error: "Unknown order action." }, { status: 400 });
}
