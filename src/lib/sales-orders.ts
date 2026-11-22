import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/types/auth";

export async function nextSalesOrderNumber() {
  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('sales_order_number_seq'::regclass) AS value`;
  return `MXT-ORD-${rows[0].value.toString().padStart(6, "0")}`;
}

export function canAccessOrder(user: AuthenticatedUser, order: { assignedSalesExecutiveId: string | null; createdById: string; customer: { assignedSalesExecutiveId: string | null } }) {
  return user.role === "SUPER_ADMIN" || order.assignedSalesExecutiveId === user.id || order.createdById === user.id || order.customer.assignedSalesExecutiveId === user.id;
}

export async function reserveOrder(orderId: string, warehouseId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: true, reservations: { where: { status: "RESERVED" } } } });
    if (!order || !["AWAITING_APPROVAL", "ON_HOLD"].includes(order.status)) throw new Error("Only pending or held orders can be approved.");
    if (order.reservations.length) throw new Error("This order already has active reservations.");
    const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, isActive: true }, select: { id: true } });
    if (!warehouse) throw new Error("Select an active warehouse.");
    const required = new Map<string, number>();
    for (const item of order.items) {
      if (!item.productId) throw new Error(`${item.productNameSnapshot} no longer has an active product reference.`);
      required.set(item.productId, (required.get(item.productId) ?? 0) + item.quantity);
    }
    const results: Array<{ productId: string; required: number; available: number; shortage: number; itemIds: string[] }> = [];
    for (const [productId, quantity] of required) {
      const balance = await tx.stockBalance.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
      const available = balance ? balance.quantityOnHand - balance.quantityReserved - balance.quantityBlocked : 0;
      results.push({ productId, required: quantity, available, shortage: Math.max(0, quantity - available), itemIds: order.items.filter((i) => i.productId === productId).map((i) => i.id) });
    }
    const shortageRows = results.filter((result) => result.shortage > 0);
    if (shortageRows.length) {
      for (const shortage of shortageRows) {
        let remainingAvailable = shortage.available;
        for (const itemId of shortage.itemIds) {
          const item = order.items.find((candidate) => candidate.id === itemId)!;
          const allocatedForReporting = Math.min(item.quantity, remainingAvailable);
          remainingAvailable -= allocatedForReporting;
          await tx.salesOrderReservation.create({ data: { salesOrderId: order.id, salesOrderItemId: item.id, productId: shortage.productId, warehouseId, quantity: item.quantity, status: "SHORTAGE", availableAtCheck: shortage.available, shortageQuantity: item.quantity - allocatedForReporting, createdById: actorId } });
        }
      }
      await tx.salesOrder.update({ where: { id: order.id }, data: { status: "ON_HOLD" } });
      await tx.salesOrderEvent.create({ data: { salesOrderId: order.id, actorId, action: "RESERVATION_SHORTAGE", details: { warehouseId, shortages: shortageRows.map(({ productId, required, available, shortage }) => ({ productId, required, available, shortage })) } } });
      return { status: "SHORTAGE" as const, shortages: shortageRows };
    }
    for (const result of results) {
      const changed = await tx.$executeRaw`UPDATE "StockBalance" SET "quantityReserved" = "quantityReserved" + ${result.required}, "updatedAt" = CURRENT_TIMESTAMP WHERE "productId" = ${result.productId} AND "warehouseId" = ${warehouseId} AND "quantityOnHand" - "quantityReserved" - "quantityBlocked" >= ${result.required}`;
      if (changed !== 1) throw new Error("Inventory changed during confirmation. Check availability and retry.");
      const items = order.items.filter((item) => item.productId === result.productId);
      for (const item of items) await tx.salesOrderReservation.create({ data: { salesOrderId: order.id, salesOrderItemId: item.id, productId: result.productId, warehouseId, quantity: item.quantity, status: "RESERVED", availableAtCheck: result.available, createdById: actorId } });
    }
    await tx.salesOrder.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    await tx.salesOrderEvent.create({ data: { salesOrderId: order.id, actorId, action: "APPROVED_AND_RESERVED", details: { warehouseId } } });
    return { status: "CONFIRMED" as const, warehouseId };
  }, { isolationLevel: "Serializable" });
}

export async function releaseOrderReservations(orderId: string, actorId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const reservations = await tx.salesOrderReservation.findMany({ where: { salesOrderId: orderId, status: "RESERVED" } });
    for (const reservation of reservations) {
      const remaining = reservation.quantity - reservation.consumedQuantity;
      const released = await tx.salesOrderReservation.updateMany({ where: { id: reservation.id, status: "RESERVED" }, data: { status: "RELEASED", releasedById: actorId, releasedAt: new Date(), releaseReason: reason } });
      if (released.count && remaining > 0) await tx.stockBalance.update({ where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } }, data: { quantityReserved: { decrement: remaining } } });
    }
  }, { isolationLevel: "Serializable" });
}
