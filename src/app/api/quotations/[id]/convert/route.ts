import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { nextSalesOrderNumber } from "@/lib/sales-orders";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const prior = await prisma.salesOrder.findUnique({ where: { quotationId: id }, select: { id: true, orderNumber: true, status: true } });
    if (prior) return NextResponse.json({ success: true, alreadyConverted: true, order: prior });
    const quotation = await prisma.quotation.findFirst({ where: { id, ...(user.role === "SALES_EXECUTIVE" ? { OR: [{ assignedSalesExecutiveId: user.id }, { createdById: user.id }, { customer: { assignedSalesExecutiveId: user.id } }] } : {}) }, include: { customer: true, items: true } });
    if (!quotation) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
    if (quotation.status !== "ACCEPTED") return NextResponse.json({ error: "Only accepted quotations can be converted." }, { status: 409 });
    const orderNumber = await nextSalesOrderNumber();
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({ data: {
        orderNumber, quotationId: quotation.id, customerId: quotation.customerId, createdById: user.id,
        assignedSalesExecutiveId: quotation.assignedSalesExecutiveId, deliveryAddress: quotation.customer.deliveryAddress ?? quotation.customer.businessAddress,
        deliveryInstructions: quotation.deliveryTerms, notes: quotation.customerNotes ?? quotation.notes, subtotal: quotation.subtotal,
        discountAmount: quotation.discountAmount, taxableAmount: quotation.taxableAmount, taxAmount: quotation.taxAmount,
        totalAmount: quotation.totalAmount, currency: quotation.currency,
        items: { create: quotation.items.map((item) => ({ productId: item.productId, productNameSnapshot: item.productNameSnapshot, skuSnapshot: item.skuSnapshot, quantity: item.quantity, unitPrice: item.unitPrice, catalogUnitPriceSnapshot: item.catalogUnitPriceSnapshot, discount: item.discount, taxRate: item.taxRate, taxAmount: item.taxAmount, lineTotal: item.lineTotal })) },
        events: { create: { actorId: user.id, action: "CONVERTED_FROM_QUOTATION", details: { quotationNumber: quotation.quotationNumber, acceptedAt: quotation.acceptedAt?.toISOString() ?? null } } },
      }, include: { items: true } });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    const existing = await prisma.salesOrder.findUnique({ where: { quotationId: id }, select: { id: true, orderNumber: true, status: true } }).catch(() => null);
    if (existing) return NextResponse.json({ success: true, alreadyConverted: true, order: existing });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Quotation conversion failed." }, { status: 400 });
  }
}
