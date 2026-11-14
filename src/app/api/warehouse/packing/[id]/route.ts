import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getRecord(id: string) { return prisma.packingRecord.findUnique({ where: { id }, include: { salesOrder: { include: { customer: true } }, warehouse: true, packages: { include: { items: { include: { salesOrderItem: true, dispatchItems: { include: { dispatch: true } } } } } } } }); }
function hasAccess(user: { id: string; role: string }, record: NonNullable<Awaited<ReturnType<typeof getRecord>>>) { return user.role === "SUPER_ADMIN" || record.salesOrder.createdById === user.id || record.salesOrder.assignedSalesExecutiveId === user.id || record.salesOrder.customer.assignedSalesExecutiveId === user.id; }

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(_request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const record = await getRecord(id); if (!record || !hasAccess(user, record)) return NextResponse.json({ error: "Packing record not found." }, { status: 404 }); return NextResponse.json(record);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const body = await request.json().catch(() => ({})); const record = await getRecord(id);
  if (!record || !hasAccess(user, record)) return NextResponse.json({ error: "Packing record not found." }, { status: 404 });
  if (record.salesOrder.status !== "CONFIRMED") return NextResponse.json({ error: "Packing is only allowed for confirmed orders." }, { status: 409 });
  if ((body as any).action !== "COMPLETE") return NextResponse.json({ error: "Unknown packing action." }, { status: 400 });
  if (record.status === "COMPLETED" || record.packages.length === 0 || record.packages.some((pkg) => pkg.items.length === 0)) return NextResponse.json({ error: "This packing record cannot be completed." }, { status: 409 });
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.packingRecord.updateMany({ where: { id, status: "IN_PROGRESS" }, data: { status: "COMPLETED", packedAt: new Date() } });
    if (!changed.count) throw new Error("Packing record has already changed.");
    await tx.salesOrderEvent.create({ data: { salesOrderId: record.salesOrderId, actorId: user.id, action: "PACKING_COMPLETED", details: { packingReference: record.reference } } });
    return tx.packingRecord.findUniqueOrThrow({ where: { id }, include: { packages: { include: { items: true } } } });
  }, { isolationLevel: "Serializable" });
  return NextResponse.json(updated);
}
