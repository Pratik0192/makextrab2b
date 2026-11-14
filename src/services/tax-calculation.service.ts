import { Prisma } from "@/generated/prisma";
import { roundingMode } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export type SupplyTreatment = "INTRA_STATE" | "INTER_STATE";
const D = Prisma.Decimal;
const pct = (amount: Prisma.Decimal, rate: Prisma.Decimal) => amount.mul(rate).div(100);
const round = (value: Prisma.Decimal, places: number, mode: Prisma.Decimal.Rounding) => value.toDecimalPlaces(places, mode);

export async function previewOrderTax(orderId: string, treatment: SupplyTreatment, chargeInputs: Array<{ configurationId: string; amount: string | number }> = []) {
  if (treatment !== "INTRA_STATE" && treatment !== "INTER_STATE") throw new Error("An authorized operator must select the applicable intra-state or inter-state treatment.");
  const [company, order] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "main" } }),
    prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: { include: { gstRate: true, hsnSac: { include: { gstRate: true } } } } } },
      },
    }),
  ]);
  if (!company?.state) throw new Error("Company registered state must be configured before tax preview.");
  if (!order) throw new Error("Sales order not found.");
  const now = new Date(); const precision = company.roundingPrecision; const mode = roundingMode(company.roundingMethod);
  const effectiveRate = (rate: { isActive: boolean; effectiveFrom: Date; effectiveTo: Date | null } | null | undefined) => Boolean(rate && rate.isActive && rate.effectiveFrom <= now && (!rate.effectiveTo || rate.effectiveTo > now));
  const items: Array<Record<string, unknown>> = [];
  let taxableTotal = new D(0); let cgstTotal = new D(0); let sgstTotal = new D(0); let igstTotal = new D(0); let cessTotal = new D(0);
  const orderBase = order.items.reduce((sum, item) => sum.plus(item.lineTotal), new D(0));
  if (order.discountAmount.gt(orderBase)) throw new Error("Order discount exceeds its item taxable base.");
  for (const item of order.items) {
    const product = item.product; const hsn = product?.hsnSac; const rate = product?.gstRate ?? hsn?.gstRate;
    const effectiveHsn = Boolean(hsn?.isActive && (!hsn.effectiveFrom || hsn.effectiveFrom <= now) && (!hsn.effectiveTo || hsn.effectiveTo > now));
    if (!product || !hsn || !effectiveHsn || !rate || !effectiveRate(rate)) throw new Error(`Tax is not configured with an effective HSN/SAC and GST rate for ${item.productNameSnapshot}.`);
    const afterOrderDiscount = order.discountAmount.isZero() ? item.lineTotal : item.lineTotal.minus(order.discountAmount.mul(item.lineTotal).div(orderBase));
    const cgstRate = treatment === "INTRA_STATE" ? rate.cgstPercent : new D(0); const sgstRate = treatment === "INTRA_STATE" ? rate.sgstPercent : new D(0); const igstRate = treatment === "INTER_STATE" ? rate.igstPercent : new D(0); const cessRate = rate.cessPercent;
    const allRates = cgstRate.plus(sgstRate).plus(igstRate).plus(cessRate);
    const taxable = product.taxInclusive || rate.taxInclusive ? afterOrderDiscount.mul(100).div(new D(100).plus(allRates)) : afterOrderDiscount;
    const cgst = round(pct(taxable, cgstRate), precision, mode); const sgst = round(pct(taxable, sgstRate), precision, mode); const igst = round(pct(taxable, igstRate), precision, mode); const cess = round(pct(taxable, cessRate), precision, mode);
    items.push({ orderItemId: item.id, productId: product.id, sku: item.skuSnapshot, hsnSacCode: hsn.code, gstRateCode: rate.code, taxInclusive: product.taxInclusive || rate.taxInclusive, quantity: item.quantity, taxableValue: round(taxable, precision, mode).toString(), cgstRate: cgstRate.toString(), cgst: cgst.toString(), sgstRate: sgstRate.toString(), sgst: sgst.toString(), igstRate: igstRate.toString(), igst: igst.toString(), cessRate: cessRate.toString(), cess: cess.toString() });
    taxableTotal = taxableTotal.plus(taxable); cgstTotal = cgstTotal.plus(cgst); sgstTotal = sgstTotal.plus(sgst); igstTotal = igstTotal.plus(igst); cessTotal = cessTotal.plus(cess);
  }
  const chargeRows = chargeInputs.length ? await prisma.chargeConfiguration.findMany({ where: { id: { in: chargeInputs.map((item) => item.configurationId) }, isActive: true }, include: { taxRate: true } }) : [];
  if (chargeRows.length !== new Set(chargeInputs.map((item) => item.configurationId)).size) throw new Error("One or more selected charges are unavailable.");
  const chargeAmounts = chargeInputs.map((input) => { if (typeof input.amount !== "string" && typeof input.amount !== "number") throw new Error("Charge amount must be numeric."); const amount = new D(input.amount); if (!amount.isFinite() || amount.isNegative()) throw new Error("Charge amount must be non-negative."); const config = chargeRows.find((row) => row.id === input.configurationId)!; if (config.isTaxable && !effectiveRate(config.taxRate)) throw new Error(`An effective GST rate is required for charge ${config.label}.`); return { config, amount }; });
  const chargeTotal = chargeAmounts.reduce((sum, x) => sum.plus(x.amount), new D(0));
  let chargeTaxable = new D(0); let chargeNetTotal = new D(0); let chargeCgst = new D(0); let chargeSgst = new D(0); let chargeIgst = new D(0); let chargeCess = new D(0);
  const charges = chargeAmounts.map(({ config, amount }) => {
    const rate = config.taxRate; const taxable = config.isTaxable ? (config.taxInclusive || rate!.taxInclusive ? amount.mul(100).div(new D(100).plus(rate!.cgstPercent.plus(rate!.sgstPercent).plus(rate!.igstPercent).plus(rate!.cessPercent))) : amount) : amount;
    const cgstRate = config.isTaxable && treatment === "INTRA_STATE" ? rate!.cgstPercent : new D(0); const sgstRate = config.isTaxable && treatment === "INTRA_STATE" ? rate!.sgstPercent : new D(0); const igstRate = config.isTaxable && treatment === "INTER_STATE" ? rate!.igstPercent : new D(0); const cessRate = config.isTaxable ? rate!.cessPercent : new D(0);
    const cgst = round(pct(taxable, cgstRate), precision, mode); const sgst = round(pct(taxable, sgstRate), precision, mode); const igst = round(pct(taxable, igstRate), precision, mode); const cess = round(pct(taxable, cessRate), precision, mode);
    chargeNetTotal = chargeNetTotal.plus(config.isTaxable ? taxable : amount);
    if (config.isTaxable) chargeTaxable = chargeTaxable.plus(taxable); chargeCgst = chargeCgst.plus(cgst); chargeSgst = chargeSgst.plus(sgst); chargeIgst = chargeIgst.plus(igst); chargeCess = chargeCess.plus(cess);
    return { code: config.code, label: config.label, amount: round(amount, precision, mode).toString(), taxable: config.isTaxable, taxableValue: round(taxable, precision, mode).toString(), cgst: cgst.toString(), sgst: sgst.toString(), igst: igst.toString(), cess: cess.toString() };
  });
  taxableTotal = taxableTotal.plus(chargeTaxable);
  cgstTotal = cgstTotal.plus(chargeCgst); sgstTotal = sgstTotal.plus(chargeSgst); igstTotal = igstTotal.plus(chargeIgst); cessTotal = cessTotal.plus(chargeCess);
  const taxTotal = cgstTotal.plus(sgstTotal).plus(igstTotal).plus(cessTotal);
  const preRoundTotal = items.reduce((sum, item) => sum.plus(String(item.taxableValue)), new D(0)).plus(chargeNetTotal).plus(taxTotal);
  const finalTotal = round(preRoundTotal, precision, mode); const roundOff = finalTotal.minus(preRoundTotal);
  return { orderNumber: order.orderNumber, currency: order.currency, sellerState: company.state, buyerState: order.customer.state, supplyTreatment: treatment, placeOfSupplyDecisionRequired: true, roundingPrecision: precision, roundingMethod: company.roundingMethod, items, charges, totals: { taxableValue: round(taxableTotal, precision, mode).toString(), cgst: round(cgstTotal, precision, mode).toString(), sgst: round(sgstTotal, precision, mode).toString(), igst: round(igstTotal, precision, mode).toString(), cess: round(cessTotal, precision, mode).toString(), tax: round(taxTotal, precision, mode).toString(), freightAndCharges: round(chargeTotal, precision, mode).toString(), roundOff: roundOff.toString(), total: finalTotal.toString() }, disclaimer: "Preview only. The intra-state/inter-state treatment must be determined by an authorized tax professional under applicable place-of-supply rules; the application does not infer that legal determination." };
}

/** Calculates the actual confirmed dispatch quantities using the accepted Sales Order's unit prices and discounts. */
export async function calculateDispatchInvoice(dispatchId: string, treatment: SupplyTreatment, chargeInputs: Array<{ configurationId: string; amount: string | number }> = [], excludeInvoiceId?: string) {
  if (treatment !== "INTRA_STATE" && treatment !== "INTER_STATE") throw new Error("An authorized operator must select the applicable intra-state or inter-state treatment.");
  const [company, dispatch] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "main" } }),
    prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: {
        salesOrder: {
          include: {
            customer: true,
            quotation: true,
            dispatches: { where: { status: "CONFIRMED" }, include: { items: { include: { packageItem: { include: { salesOrderItem: true } } } } } },
            invoices: { include: { items: true } },
            items: { include: { product: { include: { hsnSac: { include: { gstRate: true } }, gstRate: true } } } },
          },
        },
        items: {
          include: {
            packageItem: {
              include: {
                salesOrderItem: { include: { product: { include: { hsnSac: { include: { gstRate: true } }, gstRate: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);
  if (!company?.state || !company.stateCode) throw new Error("Configure the company's registered state and state code before invoicing.");
  if (!dispatch || dispatch.status !== "CONFIRMED" || !dispatch.dispatchedAt) throw new Error("Only a confirmed dispatch can be invoiced.");
  if (dispatch.salesOrder.status !== "CONFIRMED") throw new Error("The dispatched Sales Order is not confirmed.");
  const now = new Date(); const precision = company.roundingPrecision; const mode = roundingMode(company.roundingMethod);
  const effective = (x: { isActive: boolean; effectiveFrom?: Date | null; effectiveTo?: Date | null } | null | undefined) => Boolean(x?.isActive && (!x.effectiveFrom || x.effectiveFrom <= now) && (!x.effectiveTo || x.effectiveTo > now));
  const quantities = new Map<string, number>();
  for (const row of dispatch.items) {
    const oi = row.packageItem.salesOrderItem;
    quantities.set(oi.id, (quantities.get(oi.id) ?? 0) + row.quantity);
  }
  const dispatchedTotals = new Map<string, number>();
  for (const shipment of dispatch.salesOrder.dispatches) for (const row of shipment.items) { const soItemId = row.packageItem.salesOrderItemId; dispatchedTotals.set(soItemId, (dispatchedTotals.get(soItemId) ?? 0) + row.quantity); }
  const previouslyInvoiced = new Map<string, number>();
  for (const priorInvoice of dispatch.salesOrder.invoices) if (priorInvoice.id !== excludeInvoiceId) for (const line of priorInvoice.items) if (line.salesOrderItemId) previouslyInvoiced.set(line.salesOrderItemId, (previouslyInvoiced.get(line.salesOrderItemId) ?? 0) + line.quantity);
  const orderItems = dispatch.salesOrder.items;
  const netOrderBase = orderItems.reduce((sum, item) => sum.plus(item.lineTotal), new D(0));
  if (dispatch.salesOrder.discountAmount.gt(netOrderBase)) throw new Error("Sales Order discount exceeds its item value.");
  const rows: Array<Record<string, unknown>> = [];
  let taxableTotal = new D(0), cgstTotal = new D(0), sgstTotal = new D(0), igstTotal = new D(0), cessTotal = new D(0), discountTotal = new D(0);
  for (const item of orderItems) {
    const quantity = quantities.get(item.id) ?? 0;
    if (quantity <= 0) continue;
    if (quantity > item.quantity) throw new Error(`Dispatch quantity for ${item.productNameSnapshot} exceeds the ordered quantity.`);
    const dispatchedQuantity = dispatchedTotals.get(item.id) ?? 0; const previouslyInvoicedQuantity = previouslyInvoiced.get(item.id) ?? 0;
    if (previouslyInvoicedQuantity + quantity > dispatchedQuantity) throw new Error(`Previously invoiced plus current quantities exceed confirmed dispatched quantities for ${item.productNameSnapshot}.`);
    const product = item.product; const hsn = product?.hsnSac; const rate = product?.gstRate ?? hsn?.gstRate;
    if (!product || !hsn || !effective(hsn) || !rate || !effective(rate)) throw new Error(`Effective HSN/SAC and GST rate configuration is required for ${item.productNameSnapshot}.`);
    const gross = item.unitPrice.mul(quantity);
    const allocatedLineDiscount = round(item.discount.mul(quantity).div(item.quantity), precision, mode);
    const lineAfterDiscount = gross.minus(allocatedLineDiscount);
    const orderDiscount = netOrderBase.isZero() ? new D(0) : round(dispatch.salesOrder.discountAmount.mul(item.lineTotal).div(netOrderBase).mul(quantity).div(item.quantity), precision, mode);
    const commercialValue = lineAfterDiscount.minus(orderDiscount);
    if (commercialValue.isNegative()) throw new Error(`Discounts exceed the dispatched value for ${item.productNameSnapshot}.`);
    const cgstRate = treatment === "INTRA_STATE" ? rate.cgstPercent : new D(0);
    const sgstRate = treatment === "INTRA_STATE" ? rate.sgstPercent : new D(0);
    const igstRate = treatment === "INTER_STATE" ? rate.igstPercent : new D(0);
    const cessRate = rate.cessPercent;
    const allRates = cgstRate.plus(sgstRate).plus(igstRate).plus(cessRate);
    const inclusive = product.taxInclusive || rate.taxInclusive;
    const taxable = inclusive ? commercialValue.mul(100).div(new D(100).plus(allRates)) : commercialValue;
    const cgst = round(pct(taxable, cgstRate), precision, mode), sgst = round(pct(taxable, sgstRate), precision, mode), igst = round(pct(taxable, igstRate), precision, mode), cess = round(pct(taxable, cessRate), precision, mode);
    const lineTotal = inclusive ? commercialValue : taxable.plus(cgst).plus(sgst).plus(igst).plus(cess);
    rows.push({ salesOrderItemId: item.id, productId: product.id, productName: item.productNameSnapshot, sku: item.skuSnapshot, description: product.description ?? product.shortDescription ?? null, hsnSacCode: hsn.code, uom: product.taxUom ?? hsn.unitOfMeasure ?? "PCS", quantity, orderedQuantity: item.quantity, dispatchedQuantity, previouslyInvoicedQuantity, invoiceableQuantity: quantity, remainingQuantity: item.quantity - dispatchedQuantity, unitPrice: item.unitPrice.toString(), catalogPriceSnapshot: item.catalogUnitPriceSnapshot?.toString() ?? null, quotedPriceSnapshot: item.unitPrice.toString(), lineDiscount: allocatedLineDiscount.plus(orderDiscount).toDecimalPlaces(precision, mode).toString(), taxableValue: round(taxable, precision, mode).toString(), gstRateCode: rate.code, gstRateSnapshot: treatment === "INTRA_STATE" ? rate.cgstPercent.plus(rate.sgstPercent).toString() : rate.igstPercent.toString(), cgstPercent: cgstRate.toString(), cgstAmount: cgst.toString(), sgstPercent: sgstRate.toString(), sgstAmount: sgst.toString(), igstPercent: igstRate.toString(), igstAmount: igst.toString(), cessPercent: cessRate.toString(), cessAmount: cess.toString(), taxInclusive: inclusive, lineTotal: round(lineTotal, precision, mode).toString(), taxSnapshot: { hsnSacCode: hsn.code, gstRateCode: rate.code, treatment, effectiveFrom: rate.effectiveFrom.toISOString(), taxInclusive: inclusive, orderedQuantity: item.quantity, dispatchedQuantity, previouslyInvoicedQuantity, invoiceableQuantity: quantity, remainingQuantity: item.quantity - dispatchedQuantity } });
    taxableTotal = taxableTotal.plus(taxable); cgstTotal = cgstTotal.plus(cgst); sgstTotal = sgstTotal.plus(sgst); igstTotal = igstTotal.plus(igst); cessTotal = cessTotal.plus(cess); discountTotal = discountTotal.plus(allocatedLineDiscount).plus(orderDiscount);
  }
  if (!rows.length) throw new Error("This dispatch has no invoiceable product quantities.");
  const configs = chargeInputs.length ? await prisma.chargeConfiguration.findMany({ where: { id: { in: chargeInputs.map(x => x.configurationId) }, isActive: true }, include: { taxRate: true } }) : [];
  if (configs.length !== new Set(chargeInputs.map(x => x.configurationId)).size) throw new Error("One or more configured charges are unavailable.");
  let chargeTaxable = new D(0), chargeCgst = new D(0), chargeSgst = new D(0), chargeIgst = new D(0), chargeCess = new D(0), chargeNet = new D(0), freight = new D(0), packing = new D(0), otherCharges = new D(0);
  const charges = chargeInputs.map(input => {
    const config = configs.find(x => x.id === input.configurationId)!; const amount = new D(input.amount);
    if (!amount.isFinite() || amount.isNegative()) throw new Error(`${config.label} must be a non-negative amount.`);
    if (config.isTaxable && !effective(config.taxRate)) throw new Error(`An effective GST rate is required for charge ${config.label}.`);
    const rate = config.taxRate; const taxable = config.isTaxable ? (config.taxInclusive || rate!.taxInclusive ? amount.mul(100).div(new D(100).plus(rate!.cgstPercent).plus(rate!.sgstPercent).plus(rate!.igstPercent).plus(rate!.cessPercent)) : amount) : amount;
    const cr = config.isTaxable && treatment === "INTRA_STATE" ? rate!.cgstPercent : new D(0), sr = config.isTaxable && treatment === "INTRA_STATE" ? rate!.sgstPercent : new D(0), ir = config.isTaxable && treatment === "INTER_STATE" ? rate!.igstPercent : new D(0), cer = config.isTaxable ? rate!.cessPercent : new D(0);
    const cg = round(pct(taxable, cr), precision, mode), sg = round(pct(taxable, sr), precision, mode), ig = round(pct(taxable, ir), precision, mode), ce = round(pct(taxable, cer), precision, mode);
    const net = config.isTaxable && !(config.taxInclusive || rate!.taxInclusive) ? taxable.plus(cg).plus(sg).plus(ig).plus(ce) : amount;
    chargeNet = chargeNet.plus(net); chargeTaxable = chargeTaxable.plus(config.isTaxable ? taxable : 0); chargeCgst = chargeCgst.plus(cg); chargeSgst = chargeSgst.plus(sg); chargeIgst = chargeIgst.plus(ig); chargeCess = chargeCess.plus(ce);
    if (/FREIGHT/i.test(config.code)) freight = freight.plus(amount); else if (/PACK/i.test(config.code)) packing = packing.plus(amount); else otherCharges = otherCharges.plus(amount);
    return { configurationId: config.id, code: config.code, label: config.label, amount: round(amount, precision, mode).toString(), taxableValue: round(taxable, precision, mode).toString(), cgstPercent: cr.toString(), cgstAmount: cg.toString(), sgstPercent: sr.toString(), sgstAmount: sg.toString(), igstPercent: ir.toString(), igstAmount: ig.toString(), cessPercent: cer.toString(), cessAmount: ce.toString(), total: round(net, precision, mode).toString(), taxSnapshot: rate ? { rateCode: rate.code, effectiveFrom: rate.effectiveFrom.toISOString(), inclusive: config.taxInclusive || rate.taxInclusive } : {} };
  });
  taxableTotal = taxableTotal.plus(chargeTaxable); cgstTotal = cgstTotal.plus(chargeCgst); sgstTotal = sgstTotal.plus(chargeSgst); igstTotal = igstTotal.plus(chargeIgst); cessTotal = cessTotal.plus(chargeCess);
  const preRound = rows.reduce((sum, x) => sum.plus(String(x.lineTotal)), new D(0)).plus(chargeNet);
  const grandTotal = round(preRound, precision, mode); const roundOff = grandTotal.minus(preRound);
  return { dispatch, company, treatment, rows, charges, totals: { taxableSubtotal: round(taxableTotal, precision, mode), cgstTotal: round(cgstTotal, precision, mode), sgstTotal: round(sgstTotal, precision, mode), igstTotal: round(igstTotal, precision, mode), cessTotal: round(cessTotal, precision, mode), freightTotal: round(freight, precision, mode), packingTotal: round(packing, precision, mode), otherChargesTotal: round(otherCharges, precision, mode), discountTotal: round(discountTotal, precision, mode), roundOff, grandTotal, outstandingAmount: grandTotal }, customer: dispatch.salesOrder.customer };
}
