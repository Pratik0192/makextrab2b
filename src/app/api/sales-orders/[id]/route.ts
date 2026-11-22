import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { canAccessOrder } from "@/lib/sales-orders";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { customerCode: true, businessName: true, buyerName: true, mobile: true, email: true, assignedSalesExecutiveId: true, businessAddress: true, city: true, state: true, pincode: true, country: true, deliveryAddress: true, deliveryCity: true, deliveryState: true, deliveryPincode: true, deliveryContactName: true, deliveryContactPhone: true } },
      quotation: { select: { quotationNumber: true, acceptedAt: true } },
      assignedSalesExecutive: { select: { firstName: true, lastName: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      reservations: { include: { warehouse: { select: { name: true, code: true } }, product: { select: { name: true, sku: true } } }, orderBy: { createdAt: "desc" } },
      pickingList: { include: { items: true } },
      packingRecords: { include: { packages: { include: { items: { include: { salesOrderItem: true } } } } } },
      dispatches: { include: { items: true, ...(user.role === "SUPER_ADMIN" ? { invoice: { select: { id: true, invoiceNumber: true, status: true } } } : {}), deliveryEvents: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } },
      events: { include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!order || !canAccessOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const order = await prisma.salesOrder.findUnique({ where: { id }, select: { id: true, status: true, createdById: true, assignedSalesExecutiveId: true, customer: { select: { assignedSalesExecutiveId: true, country: true } } } });
  if (!order || !canAccessOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  if (!["DRAFT", "REJECTED"].includes(order.status)) return NextResponse.json({ error: "Only draft or rejected orders can be edited." }, { status: 409 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Submit valid delivery details." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const fields = ["deliveryAddress", "deliveryCity", "deliveryState", "deliveryPincode"] as const;
  const clean: Record<string, string | null> = {};
  for (const field of [...fields, "deliveryContactName", "deliveryContactPhone"] as const) {
    if (!(field in input)) continue;
    if (typeof input[field] !== "string") return NextResponse.json({ error: `Enter valid ${field}.` }, { status: 400 });
    const value = input[field].trim().replace(/\s+/g, " ");
    if (fields.includes(field as (typeof fields)[number]) && !value) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    if (value.length > (field === "deliveryAddress" ? 1000 : 200)) return NextResponse.json({ error: `${field} is too long.` }, { status: 400 });
    clean[field] = value || null;
  }
  if (!fields.every((field) => clean[field])) return NextResponse.json({ error: "Complete shipping address, city, state and postal code are required." }, { status: 400 });
  const postal = clean.deliveryPincode!.replace(/[\s-]/g, "").toUpperCase();
  const validPostal = order.customer.country.toLowerCase() === "india" ? /^[1-9][0-9]{5}$/.test(postal) : /^[A-Z0-9][A-Z0-9 -]{1,13}[A-Z0-9]$/.test(postal);
  if (!validPostal) return NextResponse.json({ error: "Enter a valid shipping postal code." }, { status: 400 });
  clean.deliveryPincode = postal;
  if (clean.deliveryContactPhone && !/^\+?[0-9\s()-]{7,20}$/.test(clean.deliveryContactPhone)) return NextResponse.json({ error: "Enter a valid shipping contact phone number." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.salesOrder.update({ where: { id }, data: clean });
      await tx.salesOrderEvent.create({ data: { salesOrderId: id, actorId: user.id, action: order.status === "REJECTED" ? "REJECTED_ORDER_UPDATED" : "ORDER_DELIVERY_UPDATED", details: { changedFields: Object.keys(clean) } } });
      return result;
    });
    return NextResponse.json({ order: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delivery details could not be updated." }, { status: 400 });
  }
}
