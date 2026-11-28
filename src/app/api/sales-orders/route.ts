import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextSalesOrderNumber } from "@/lib/sales-orders";
import { Prisma } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams; const page = Math.max(1, Number(params.get("page") || 1)); const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") || 20))); const q = params.get("q")?.trim();
  const where = { ...(params.get("status") ? { status: params.get("status") as never } : {}), AND: [ ...(user.role === "SALES_EXECUTIVE" ? [{ OR: [{ assignedSalesExecutiveId: user.id }, { createdById: user.id }, { customer: { assignedSalesExecutiveId: user.id } }] }] : []), ...(q ? [{ OR: [{ orderNumber: { contains: q, mode: "insensitive" as const } }, { customer: { businessName: { contains: q, mode: "insensitive" as const } } }] }] : []) ] };
  const [items, total] = await Promise.all([prisma.salesOrder.findMany({ where, include: { customer: { select: { businessName: true } }, reservations: { select: { status: true } } }, orderBy: { orderDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.salesOrder.count({ where })]);
  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    if (!customerId || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) throw new Error("Select a customer and add between 1 and 100 products.");
    const customer = await prisma.customer.findFirst({ where: { id: customerId, status: "ACTIVE", ...(user.role === "SALES_EXECUTIVE" ? { assignedSalesExecutiveId: user.id } : {}) } });
    if (!customer) throw new Error("Active customer not found or not assigned to you.");
    const productIds = body.items.map((item: Record<string, unknown>) => String(item.productId ?? ""));
    if (productIds.some((id: string) => !id) || new Set(productIds).size !== productIds.length) throw new Error("Choose each product once and enter valid product selections.");
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    if (products.length !== productIds.length) throw new Error("One or more selected products are unavailable.");
    const byId = new Map(products.map((product) => [product.id, product]));
    const items: Array<{ product: (typeof products)[number]; quantity: number; unitPrice: Prisma.Decimal; gross: Prisma.Decimal; discount: Prisma.Decimal; lineTotal: Prisma.Decimal }> = body.items.map((input: Record<string, unknown>) => {
      const product = byId.get(String(input.productId));
      if (!product || !product.wholesalePrice?.gt(0)) throw new Error(`${product?.name ?? "Selected product"} has no configured wholesale price.`);
      const quantity = Number(input.quantity);
      if (!Number.isInteger(quantity) || quantity < product.minimumOrderQuantity) throw new Error(`${product.name} requires a minimum quantity of ${product.minimumOrderQuantity}.`);
      const unitPrice = user.role === "SUPER_ADMIN" && input.unitPrice !== undefined ? new Prisma.Decimal(String(input.unitPrice)) : product.wholesalePrice;
      if (!unitPrice.isFinite() || unitPrice.lte(0) || unitPrice.decimalPlaces() > 2) throw new Error(`Enter a valid unit price for ${product.name}.`);
      const gross = unitPrice.mul(quantity).toDecimalPlaces(2);
      const discount = new Prisma.Decimal(String(input.discount ?? 0));
      if (!discount.isFinite() || discount.isNegative() || discount.decimalPlaces() > 2 || discount.gt(gross)) throw new Error(`Enter a valid line discount for ${product.name}.`);
      return { product, quantity, unitPrice, gross, discount, lineTotal: gross.minus(discount) };
    });
    const subtotal = items.reduce((total, item) => total.plus(item.gross), new Prisma.Decimal(0));
    const lineDiscounts = items.reduce((total, item) => total.plus(item.discount), new Prisma.Decimal(0));
    const orderDiscount = new Prisma.Decimal(String(body.discountAmount ?? 0));
    const lineNet = subtotal.minus(lineDiscounts);
    if (!orderDiscount.isFinite() || orderDiscount.isNegative() || orderDiscount.decimalPlaces() > 2 || orderDiscount.gt(lineNet)) throw new Error("Order discount cannot exceed the value remaining after line discounts.");
    const itemNet = lineNet.minus(orderDiscount);
    const orderNumber = await nextSalesOrderNumber();
    const deliveryAddress = customer.deliveryAddress ?? customer.businessAddress;
    const deliveryCity = customer.deliveryCity ?? customer.city;
    const deliveryState = customer.deliveryState ?? customer.state;
    const deliveryPincode = customer.deliveryPincode ?? customer.pincode;
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber, customerId: customer.id, createdById: user.id, assignedSalesExecutiveId: customer.assignedSalesExecutiveId,
        deliveryAddress, deliveryCity, deliveryState, deliveryPincode,
        deliveryContactName: customer.deliveryContactName ?? customer.buyerName,
        deliveryContactPhone: customer.deliveryContactPhone ?? customer.mobile,
        subtotal, discountAmount: orderDiscount, taxableAmount: itemNet, taxAmount: new Prisma.Decimal(0), totalAmount: itemNet,
        notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null,
        items: { create: items.map(({ product, quantity, unitPrice, discount, lineTotal }) => ({ productId: product.id, productNameSnapshot: product.name, skuSnapshot: product.sku, quantity, unitPrice, catalogUnitPriceSnapshot: product.wholesalePrice, discount, taxRate: new Prisma.Decimal(0), taxAmount: new Prisma.Decimal(0), lineTotal })) },
        events: { create: { actorId: user.id, action: "DIRECT_CUSTOMER_ORDER_CREATED", details: { customerCode: customer.customerCode, lineDiscountTotal: lineDiscounts.toString() } } },
      },
      include: { customer: { select: { businessName: true } }, items: true },
    });
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create sales order." }, { status: 400 });
  }
}
