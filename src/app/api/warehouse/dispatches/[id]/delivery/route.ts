import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOperateOrder } from "@/lib/warehouse-ops";
import type { DeliveryStatus } from "@/generated/prisma";

const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  NOT_DISPATCHED: [], DISPATCHED: ["IN_TRANSIT", "DELIVERY_FAILED", "RETURNED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "RETURNED"],
  DELIVERED: [], DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNED"], RETURNED: [],
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = body as { status?: DeliveryStatus; notes?: string; failureReason?: string };
  const dispatch = await prisma.dispatch.findUnique({ where: { id }, include: { salesOrder: { include: { customer: true } } } });
  if (!dispatch || !canOperateOrder(user, dispatch.salesOrder)) return NextResponse.json({ error: "Dispatch not found." }, { status: 404 });
  if (dispatch.status !== "CONFIRMED" || !input.status || !transitions[dispatch.deliveryStatus]?.includes(input.status)) return NextResponse.json({ error: "Invalid delivery status transition." }, { status: 409 });
  if (input.status === "DELIVERY_FAILED" && !input.failureReason?.trim()) return NextResponse.json({ error: "Provide a delivery failure reason." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.dispatch.updateMany({ where: { id, status: "CONFIRMED", deliveryStatus: dispatch.deliveryStatus }, data: { deliveryStatus: input.status } });
      if (!changed.count) throw new Error("Delivery status changed. Refresh and retry.");
      await tx.deliveryStatusEvent.create({ data: { dispatchId: id, previousStatus: dispatch.deliveryStatus, newStatus: input.status!, actorId: user.id, notes: input.notes?.trim().slice(0, 1000), failureReason: input.failureReason?.trim().slice(0, 500) } });
      await tx.salesOrderEvent.create({ data: { salesOrderId: dispatch.salesOrderId, actorId: user.id, action: "DELIVERY_STATUS_UPDATED", details: { dispatchReference: dispatch.reference, previousStatus: dispatch.deliveryStatus, newStatus: input.status, notes: input.notes ?? null } } });
      return tx.dispatch.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Delivery update failed." }, { status: 409 }); }
}
