import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { decimal } from "@/lib/customer-quotation";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const input = await request.json();
    const validUntil = new Date(input.validUntil);
    if (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date()) throw new Error("Validity date must be in the future.");
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw new Error("Add at least one product.");
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quotation.findFirst({
        where: { id, status: "DRAFT", ...(user.role === "SALES_EXECUTIVE" ? { createdById: user.id, customer: { assignedSalesExecutiveId: user.id } } : {}) },
        include: { items: true },
      });
      if (!quote) throw new Error("Draft not found or you are not authorised to edit it.");
      const products = await tx.product.findMany({
        where: { id: { in: input.items.map((item: Record<string, unknown>) => String(item.productId)) }, isActive: true },
      });
      if (products.length !== new Set(input.items.map((item: Record<string, unknown>) => String(item.productId))).size) throw new Error("One or more products are unavailable.");
      const productById = new Map(products.map((product) => [product.id, product]));
      const overrides: Array<{ productId: string; cataloguePrice: string; quotedPrice: string }> = [];
      const items = input.items.map((item: Record<string, unknown>) => {
        const productId = String(item.productId);
        const product = productById.get(productId);
        if (!product) throw new Error("Product unavailable.");
        const priorItem = typeof item.quotationItemId === "string" ? quote.items.find((row) => row.id === item.quotationItemId) : undefined;
        const priorSameProduct = priorItem?.productId === productId ? priorItem : undefined;
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < product.minimumOrderQuantity) throw new Error(`${product.name} requires at least ${product.minimumOrderQuantity}.`);
        if (!product.wholesalePrice?.gt(0) && !priorSameProduct) throw new Error(`${product.name} has no configured wholesale price. Ask a Super Admin to update the product.`);
        const cataloguePrice = product.wholesalePrice ?? priorSameProduct!.catalogUnitPriceSnapshot ?? priorSameProduct!.unitPrice;
        const unitPrice = user.role === "SUPER_ADMIN"
          ? decimal(item.unitPrice, "Unit price")
          : priorSameProduct?.unitPrice ?? cataloguePrice;
        if (user.role === "SUPER_ADMIN" && !unitPrice.equals(cataloguePrice)) overrides.push({ productId, cataloguePrice: cataloguePrice.toString(), quotedPrice: unitPrice.toString() });
        const discount = decimal(item.discount ?? 0, "Line discount");
        const gross = unitPrice.mul(quantity).toDecimalPlaces(2);
        if (discount.gt(gross)) throw new Error("Line discount cannot exceed line gross.");
        return { productId, productNameSnapshot: product.name, skuSnapshot: product.sku, quantity, unitPrice, catalogUnitPriceSnapshot: cataloguePrice, discount, taxRate: new Prisma.Decimal(0), taxAmount: new Prisma.Decimal(0), lineTotal: gross.minus(discount) };
      });
      const subtotal = items.reduce((sum: Prisma.Decimal, item: { unitPrice: Prisma.Decimal; quantity: number }) => sum.plus(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0));
      const lineDiscount = items.reduce((sum: Prisma.Decimal, item: { discount: Prisma.Decimal }) => sum.plus(item.discount), new Prisma.Decimal(0));
      const discountValue = decimal(input.discountValue ?? 0, "Quotation discount");
      const discountType = input.discountType === "PERCENT" ? "PERCENT" : "FIXED";
      const base = subtotal.minus(lineDiscount);
      const discountAmount = discountType === "PERCENT" ? base.mul(discountValue).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : discountValue;
      if (discountAmount.gt(base)) throw new Error("Quotation discount cannot exceed the remaining amount.");
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      const totalAmount = base.minus(discountAmount);
      const updated = await tx.quotation.update({ where: { id }, data: {
        validUntil, subtotal, discountType, discountValue, discountAmount, taxableAmount: totalAmount, taxAmount: 0, totalAmount,
        paymentTerms: typeof input.paymentTerms === "string" ? input.paymentTerms.slice(0, 2000) : null,
        deliveryTerms: typeof input.deliveryTerms === "string" ? input.deliveryTerms.slice(0, 2000) : null,
        customerNotes: typeof input.customerNotes === "string" ? input.customerNotes.slice(0, 2000) : null,
        internalNotes: typeof input.internalNotes === "string" ? input.internalNotes.slice(0, 2000) : null,
        items: { create: items },
      } });
      await tx.quotationEvent.create({ data: { quotationId: id, actorId: user.id, action: "DRAFT_UPDATED", details: { priceOverrides: overrides } } });
      return updated;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ success: true, quotation: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft could not be updated." }, { status: 400 });
  }
}
