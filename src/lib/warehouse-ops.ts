import { Prisma } from "@/generated/prisma";
import { recordReservedStockOut } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/types/auth";

export function canOperateOrder(user: AuthenticatedUser, order: { assignedSalesExecutiveId: string | null; createdById: string; customer: { assignedSalesExecutiveId: string | null } }) {
  return user.role === "SUPER_ADMIN" || order.assignedSalesExecutiveId === user.id || order.createdById === user.id || order.customer.assignedSalesExecutiveId === user.id;
}

async function nextCode(sequence: "picking_ref_seq" | "packing_ref_seq" | "dispatch_ref_seq", prefix: "NXT-PICK" | "NXT-PACK" | "NXT-DSP") {
  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`SELECT nextval(${sequence}::regclass) AS value`;
  return `${prefix}-${rows[0].value.toString().padStart(6, "0")}`;
}

export const nextPickingRef = () => nextCode("picking_ref_seq", "NXT-PICK");
export const nextPackingRef = () => nextCode("packing_ref_seq", "NXT-PACK");
export const nextDispatchRef = () => nextCode("dispatch_ref_seq", "NXT-DSP");

export async function createPickingList(orderId: string, actorId: string) {
  const reference = await nextPickingRef();
  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: true, reservations: { where: { status: "RESERVED" } } } });
    if (!order || order.status !== "CONFIRMED") throw new Error("Only confirmed orders can be picked.");
    if (order.reservations.length === 0) throw new Error("This order has no active stock reservations.");
    const warehouseIds = [...new Set(order.reservations.map((reservation) => reservation.warehouseId))];
    if (warehouseIds.length !== 1) throw new Error("This order has reservations in multiple warehouses; split warehouse picking is not configured.");
    if (order.items.some((item) => !order.reservations.some((reservation) => reservation.salesOrderItemId === item.id))) throw new Error("Every order item must have an active reservation before picking.");
    const list = await tx.pickingList.create({ data: { reference, salesOrderId: order.id, warehouseId: warehouseIds[0], createdById: actorId, items: { create: order.items.map((item) => {
      const reservedQuantity = order.reservations.filter((reservation) => reservation.salesOrderItemId === item.id).reduce((sum, reservation) => sum + reservation.quantity - reservation.consumedQuantity, 0);
      return { salesOrderItemId: item.id, reservedQuantity };
    }) } }, include: { items: { include: { salesOrderItem: true } }, warehouse: true } });
    await tx.salesOrderEvent.create({ data: { salesOrderId: order.id, actorId, action: "PICKING_LIST_CREATED", details: { pickingReference: list.reference, warehouseId: list.warehouseId } } });
    return list;
  }, { isolationLevel: "Serializable" });
}

export async function createPackingRecord(orderId: string, actorId: string, input: { packages: Array<{ description?: string; weightKg?: number; items: Array<{ salesOrderItemId: string; quantity: number }> }>; notes?: string }) {
  const reference = await nextPackingRef();
  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { pickingList: { include: { items: true } }, reservations: { where: { status: "RESERVED" } }, packingRecords: { include: { packages: { include: { items: true } } } } } });
    if (!order || order.status !== "CONFIRMED" || !order.pickingList || order.pickingList.status !== "COMPLETED") throw new Error("Complete picking before packing.");
    if (!input.packages.length || input.packages.length > 100) throw new Error("Add between 1 and 100 packages.");
    const warehouseId = order.pickingList.warehouseId;
    const picked = new Map(order.pickingList.items.map((item) => [item.salesOrderItemId, item.pickedQuantity]));
    const alreadyPacked = new Map<string, number>();
    for (const record of order.packingRecords) for (const pkg of record.packages) for (const item of pkg.items) alreadyPacked.set(item.salesOrderItemId, (alreadyPacked.get(item.salesOrderItemId) ?? 0) + item.packedQuantity);
    const requested = new Map<string, number>();
    for (const pkg of input.packages) {
      if (!Array.isArray(pkg.items) || pkg.items.length === 0) throw new Error("Each package must contain at least one item.");
      if (pkg.weightKg !== undefined && (!Number.isFinite(pkg.weightKg) || pkg.weightKg <= 0)) throw new Error("Package weight must be greater than zero.");
      for (const item of pkg.items) {
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("Packed quantities must be positive whole numbers.");
        requested.set(item.salesOrderItemId, (requested.get(item.salesOrderItemId) ?? 0) + item.quantity);
      }
    }
    for (const [itemId, quantity] of requested) {
      if (!picked.has(itemId)) throw new Error("Package contains an item that was not picked for this order.");
      if ((alreadyPacked.get(itemId) ?? 0) + quantity > picked.get(itemId)!) throw new Error("Packed quantities cannot exceed successfully picked quantities.");
    }
    let nextPackageNumber = order.packingRecords.reduce((max, record) => Math.max(max, record.packages.reduce((pkgMax, pkg) => Math.max(pkgMax, pkg.packageNumber), 0)), 0) + 1;
    return tx.packingRecord.create({
      data: {
        reference,
        salesOrderId: order.id,
        warehouseId,
        packedById: actorId,
        notes: input.notes?.slice(0, 1000),
        packages: {
          create: input.packages.map((pkg) => ({
            packageNumber: nextPackageNumber++,
            description: pkg.description?.slice(0, 300),
            weightKg: pkg.weightKg === undefined ? undefined : new Prisma.Decimal(pkg.weightKg),
            items: { create: pkg.items.map((item) => ({ salesOrderItemId: item.salesOrderItemId, packedQuantity: item.quantity })) },
          })),
        },
      },
      include: { packages: { include: { items: true } } },
    });
  }, { isolationLevel: "Serializable" });
}

export async function confirmDispatch(dispatchId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const dispatch = await tx.dispatch.findUnique({
      where: { id: dispatchId },
      include: {
        items: { include: { packageItem: { include: {
          package: { include: { packingRecord: true } },
          salesOrderItem: true,
          dispatchItems: { where: { dispatch: { status: "CONFIRMED" } } },
        } } } },
        salesOrder: { include: { reservations: { where: { status: "RESERVED" } } } },
      },
    });
    if (!dispatch || dispatch.status !== "DRAFT") throw new Error("Draft dispatch not found.");
    if (dispatch.salesOrder.status !== "CONFIRMED") throw new Error("Only confirmed orders can be dispatched.");
    if (!dispatch.items.length) throw new Error("Add at least one packed item to the dispatch.");
    for (const dispatchItem of dispatch.items) if (dispatchItem.packageItem.package.packingRecord.status !== "COMPLETED") throw new Error("A dispatch may only use completed packages.");
    const grouped = new Map<string, number>();
    for (const line of dispatch.items) grouped.set(line.packageItem.salesOrderItemId, (grouped.get(line.packageItem.salesOrderItemId) ?? 0) + line.quantity);
    for (const line of dispatch.items) {
      const alreadyDispatched = line.packageItem.dispatchItems.reduce((sum, prior) => sum + prior.quantity, 0);
      if (alreadyDispatched + line.quantity > line.packageItem.packedQuantity) throw new Error("Dispatch quantity exceeds the package's remaining packed quantity.");
    }
    for (const [salesOrderItemId, quantity] of grouped) {
      const reservations = dispatch.salesOrder.reservations.filter((reservation) => reservation.salesOrderItemId === salesOrderItemId);
      const reservedRemaining = reservations.reduce((sum, reservation) => sum + reservation.quantity - reservation.consumedQuantity, 0);
      if (quantity > reservedRemaining) throw new Error("Dispatch quantity exceeds the remaining reservation.");
      let remainingToConsume = quantity;
      for (const reservation of reservations) {
        if (remainingToConsume <= 0) break;
        const available = reservation.quantity - reservation.consumedQuantity;
        const consume = Math.min(available, remainingToConsume);
        if (!consume) continue;
        await recordReservedStockOut(tx, actorId, { productId: reservation.productId, warehouseId: reservation.warehouseId, quantity: consume, reference: dispatch.reference, reason: "Sales order dispatch", notes: `Sales order ${dispatch.salesOrder.orderNumber}` });
        const newConsumed = reservation.consumedQuantity + consume;
        await tx.salesOrderReservation.update({ where: { id: reservation.id }, data: { consumedQuantity: newConsumed, ...(newConsumed === reservation.quantity ? { status: "CONSUMED", releasedById: actorId, releasedAt: new Date(), releaseReason: `Consumed by dispatch ${dispatch.reference}` } : {}) } });
        remainingToConsume -= consume;
      }
    }
    await tx.dispatch.update({ where: { id: dispatch.id }, data: { status: "CONFIRMED", deliveryStatus: "DISPATCHED", confirmedById: actorId, dispatchedAt: new Date() } });
    await tx.deliveryStatusEvent.create({ data: { dispatchId: dispatch.id, previousStatus: "NOT_DISPATCHED", newStatus: "DISPATCHED", actorId, notes: dispatch.notes } });
    await tx.salesOrderEvent.create({ data: { salesOrderId: dispatch.salesOrderId, actorId, action: "DISPATCH_CONFIRMED", details: { dispatchReference: dispatch.reference, items: [...grouped].map(([salesOrderItemId, quantity]) => ({ salesOrderItemId, quantity })) } } });
    return { reference: dispatch.reference, dispatchedAt: new Date() };
  }, { isolationLevel: "Serializable" });
}
