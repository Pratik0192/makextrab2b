import "server-only";
import { Prisma, type InvoicePaymentStatus } from "@/generated/prisma";
import { calculateDispatchInvoice, type SupplyTreatment } from "@/services/tax-calculation.service";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { uploadPrivateInvoicePdf } from "@/lib/cloudinary";
import { InvoicePdfGenerationError } from "@/lib/invoice-pdf-storage";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;
type ChargeInput = { configurationId: string; amount: string | number };
export function canViewInvoice(user: { id: string; role: string }, invoice: { salesOrder: { createdById: string; assignedSalesExecutiveId: string | null; customer: { assignedSalesExecutiveId: string | null } } }) {
  return user.role === "SUPER_ADMIN" || invoice.salesOrder.createdById === user.id || invoice.salesOrder.assignedSalesExecutiveId === user.id || invoice.salesOrder.customer.assignedSalesExecutiveId === user.id;
}
function snap(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function chargeTotals(charges: Array<{ code: string; amount: string }>) { let freight = new D(0), packing = new D(0), other = new D(0); for (const c of charges) { if (/FREIGHT/i.test(c.code)) freight = freight.plus(c.amount); else if (/PACK/i.test(c.code)) packing = packing.plus(c.amount); else other = other.plus(c.amount); } return { freight, packing, other }; }
function combineCreditLines(items: Array<{ invoiceItemId: string; quantity: number }>) { const combined = new Map<string, number>(); for (const item of items) combined.set(item.invoiceItemId, (combined.get(item.invoiceItemId) ?? 0) + item.quantity); return [...combined].map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity })); }

async function invoiceDraftData(dispatchId: string, treatment: SupplyTreatment, charges: ChargeInput[], excludeInvoiceId?: string) {
  const calc = await calculateDispatchInvoice(dispatchId, treatment, charges, excludeInvoiceId);
  const company = calc.company!; const customer = calc.customer; const order = calc.dispatch.salesOrder;
  const companySnapshot = { legalBusinessName: company.legalBusinessName, tradeName: company.tradeName, logoUrl: company.logoUrl, registeredAddress: company.registeredAddress, state: company.state, stateCode: company.stateCode, pincode: company.pincode, country: company.country, contactNumber: company.contactNumber, officialEmail: company.officialEmail, pan: company.pan, gstin: company.gstin, bankDetails: company.bankDetails, footerNotes: company.footerNotes, termsAndConditions: company.termsAndConditions, invoiceHeaderName: company.invoiceHeaderName };
  const customerSnapshot = { businessName: customer.businessName, buyerName: customer.buyerName, billingAddress: customer.businessAddress, city: customer.city, state: customer.state, pincode: customer.pincode, country: customer.country, gstin: customer.gstin, mobile: customer.mobile, email: customer.email, customerCode: customer.customerCode };
  const shippingSnapshot = { address: order.deliveryAddress ?? customer.deliveryAddress ?? customer.businessAddress, city: customer.city, state: customer.state, pincode: customer.pincode, country: customer.country };
  const totals = chargeTotals(calc.charges.map(c => ({ code: c.code, amount: c.amount })));
  return { calc, companySnapshot, customerSnapshot, shippingSnapshot, totals };
}

export async function createInvoiceDraft(input: { dispatchId: string; treatment: SupplyTreatment; placeOfSupply: string; stateCode: string; reverseCharge?: boolean; charges?: ChargeInput[]; dueDate?: string | null }, actorId: string) {
  if (!input.dispatchId || !["INTRA_STATE", "INTER_STATE"].includes(input.treatment)) throw new Error("Select a confirmed dispatch and supply treatment.");
  if (!input.placeOfSupply?.trim() || !/^\d{2}$/.test(input.stateCode)) throw new Error("Enter the professionally determined place of supply and its two-digit state code.");
  if (input.charges && (!Array.isArray(input.charges) || input.charges.length > 20)) throw new Error("Provide no more than 20 configured charges.");
  const dispatch = await prisma.dispatch.findUnique({ where: { id: input.dispatchId }, select: { id: true, status: true, dispatchedAt: true, salesOrderId: true } });
  if (!dispatch || dispatch.status !== "CONFIRMED" || !dispatch.dispatchedAt) throw new Error("Only a confirmed dispatch is eligible for invoicing.");
  if (await prisma.invoice.findUnique({ where: { dispatchId: input.dispatchId }, select: { id: true } })) throw new Error("This dispatch already has an invoice record.");
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (dueDate && !Number.isFinite(dueDate.getTime())) throw new Error("Enter a valid due date.");
  const draft = await invoiceDraftData(input.dispatchId, input.treatment, input.charges ?? []);
  const t = draft.calc.totals;
  const created = await prisma.invoice.create({
    data: {
      customerId: draft.calc.customer.id, salesOrderId: draft.calc.dispatch.salesOrderId, quotationId: draft.calc.dispatch.salesOrder.quotationId, dispatchId: input.dispatchId, createdById: actorId, supplyTreatment: input.treatment,
      placeOfSupply: input.placeOfSupply.trim().slice(0, 150), stateCode: input.stateCode, reverseCharge: input.reverseCharge === true, companySnapshot: snap(draft.companySnapshot), customerSnapshot: snap(draft.customerSnapshot), shippingSnapshot: snap(draft.shippingSnapshot), chargesSnapshot: snap(draft.calc.charges), dueDate,
      taxableSubtotal: t.taxableSubtotal, cgstTotal: t.cgstTotal, sgstTotal: t.sgstTotal, igstTotal: t.igstTotal, cessTotal: t.cessTotal,
      freightTotal: draft.totals.freight, packingTotal: draft.totals.packing, otherChargesTotal: draft.totals.other, discountTotal: t.discountTotal, roundOff: t.roundOff, grandTotal: t.grandTotal, outstandingAmount: t.grandTotal,
      items: { create: draft.calc.rows.map(row => ({ ...(row as any), taxSnapshot: snap(row.taxSnapshot) })) },
      events: { create: { actorId, action: "DRAFT_CREATED", details: snap({ dispatchId: input.dispatchId, treatment: input.treatment }) } },
    }, include: { items: true }
  });
  return created;
}

export async function updateInvoiceDraft(invoiceId: string, input: { treatment?: SupplyTreatment; placeOfSupply?: string; stateCode?: string; reverseCharge?: boolean; charges?: ChargeInput[]; dueDate?: string | null }, actorId: string) {
  const current = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, status: true, dispatchId: true, supplyTreatment: true, chargesSnapshot: true } });
  if (!current || current.status !== "DRAFT") throw new Error("Only an existing invoice draft can be edited.");
  const treatment = input.treatment ?? current.supplyTreatment as SupplyTreatment;
  if (input.stateCode !== undefined && !/^\d{2}$/.test(input.stateCode)) throw new Error("State code must be a two-digit code entered by the authorized operator.");
  const charges = input.charges ?? (current.chargesSnapshot as ChargeInput[]).map((x: any) => ({ configurationId: x.configurationId, amount: x.amount }));
  const dueDate = input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null;
  if (dueDate && !Number.isFinite(dueDate.getTime())) throw new Error("Enter a valid due date.");
  const draft = await invoiceDraftData(current.dispatchId, treatment, charges, invoiceId); const t = draft.calc.totals;
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const locked = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { status: true } }); if (!locked || locked.status !== "DRAFT") throw new Error("This invoice is no longer an editable draft.");
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    return tx.invoice.update({ where: { id: invoiceId }, data: { supplyTreatment: treatment, ...(input.placeOfSupply !== undefined ? { placeOfSupply: input.placeOfSupply.trim().slice(0, 150) || null } : {}), ...(input.stateCode !== undefined ? { stateCode: input.stateCode } : {}), ...(input.reverseCharge !== undefined ? { reverseCharge: input.reverseCharge } : {}), ...(dueDate !== undefined ? { dueDate } : {}), companySnapshot: snap(draft.companySnapshot), customerSnapshot: snap(draft.customerSnapshot), shippingSnapshot: snap(draft.shippingSnapshot), chargesSnapshot: snap(draft.calc.charges), taxableSubtotal: t.taxableSubtotal, cgstTotal: t.cgstTotal, sgstTotal: t.sgstTotal, igstTotal: t.igstTotal, cessTotal: t.cessTotal, freightTotal: draft.totals.freight, packingTotal: draft.totals.packing, otherChargesTotal: draft.totals.other, discountTotal: t.discountTotal, roundOff: t.roundOff, grandTotal: t.grandTotal, outstandingAmount: t.grandTotal, items: { create: draft.calc.rows.map(row => ({ ...(row as any), taxSnapshot: snap(row.taxSnapshot) })) }, events: { create: { actorId, action: "DRAFT_UPDATED", details: snap({ treatment, placeOfSupply: input.placeOfSupply, stateCode: input.stateCode, reverseCharge: input.reverseCharge }) } } }, include: { items: true } });
  }, { isolationLevel: "Serializable" });
}

async function allocateNumber(tx: Prisma.TransactionClient, documentType: "TAX_INVOICE" | "CREDIT_NOTE", onDate: Date, branchCode = "DEFAULT") {
  const year = await tx.financialYear.findFirst({ where: { isActive: true, startDate: { lte: onDate }, endDate: { gte: onDate } } });
  if (!year) throw new Error("Configure an active financial year covering the document date.");
  const config = await tx.documentNumberingConfig.findFirst({ where: { financialYearId: year.id, documentType, branchCode, isActive: true } }) ?? (branchCode !== "DEFAULT" ? await tx.documentNumberingConfig.findFirst({ where: { financialYearId: year.id, documentType, branchCode: "DEFAULT", isActive: true } }) : null);
  if (!config) throw new Error(`Configure active ${documentType === "TAX_INVOICE" ? "tax invoice" : "credit note"} numbering for ${year.name}.`);
  const rows = await tx.$queryRaw<Array<{ currentSequence: number }>>`UPDATE "DocumentNumberingConfig" SET "currentSequence" = GREATEST("currentSequence", "startingSequence" - 1) + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${config.id} AND "isActive" = true RETURNING "currentSequence"`;
  if (!rows[0]) throw new Error("The document numbering configuration is unavailable.");
  const sequence = String(rows[0].currentSequence).padStart(6, "0");
  return { year, config, number: `${config.prefix}${year.name}${config.branchCode ? `-${config.branchCode}` : ""}-${sequence}${config.suffix ?? ""}` };
}

function assertIssueReady(invoice: { companySnapshot: Prisma.JsonValue; customerSnapshot: Prisma.JsonValue; placeOfSupply: string | null; stateCode: string | null; supplyTreatment: string; items: Array<{ hsnSacCode: string; quantity: number }> }) {
  const company = invoice.companySnapshot as Record<string, unknown>; const customer = invoice.customerSnapshot as Record<string, unknown>;
  const missing = ["legalBusinessName", "registeredAddress", "state", "stateCode", "pincode", "country", "contactNumber", "officialEmail", "pan", "gstin"].filter(k => !company[k]);
  if (missing.length) throw new Error(`Complete Company Settings before issuing. Missing: ${missing.join(", ")}.`);
  const customerMissing = ["businessName", "billingAddress", "city", "state", "pincode", "country", "mobile"].filter(k => !customer[k]);
  if (customerMissing.length) throw new Error(`Complete customer billing details before issuing. Missing: ${customerMissing.join(", ")}.`);
  if (!invoice.placeOfSupply || !/^\d{2}$/.test(invoice.stateCode ?? "") || !["INTRA_STATE", "INTER_STATE"].includes(invoice.supplyTreatment)) throw new Error("Enter the professionally determined place of supply, state code and tax treatment before issuing.");
  if (invoice.items.some(x => !x.hsnSacCode || x.quantity <= 0)) throw new Error("Every dispatched product must have an HSN/SAC code and positive quantity.");
}

export async function issueInvoice(invoiceId: string, actorId: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true, customer: true, salesOrder: true, dispatch: { include: { warehouse: true } } } });
    if (!invoice || invoice.status !== "DRAFT") throw new Error("Only a draft invoice can be issued.");
    assertIssueReady(invoice);
    const date = new Date(); const numbering = await allocateNumber(tx, "TAX_INVOICE", date, invoice.dispatch.warehouse.code);
    const invoiceWithNumber = { ...invoice, invoiceNumber: numbering.number, invoiceDate: date, financialYear: numbering.year } as typeof invoice & { financialYear: typeof numbering.year };
    const pdf = await renderInvoicePdf(invoiceWithNumber); const providerFileId = await uploadPrivateInvoicePdf(pdf, invoiceId);
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { invoiceNumber: numbering.number, invoiceDate: date, financialYearId: numbering.year.id, numberingConfigId: numbering.config.id, status: "ISSUED", paymentStatus: invoice.dueDate && invoice.dueDate < date ? "OVERDUE" : "UNPAID", issuedById: actorId, issuedAt: date, pdfProviderFileId: providerFileId, pdfGeneratedAt: date, pdfVersion: 1, outstandingAmount: invoice.grandTotal, events: { create: [{ actorId, action: "ISSUED", details: snap({ number: numbering.number, issuedAt: date.toISOString() }) }, { actorId, action: "PDF_GENERATED", details: snap({ version: 1, generatedAt: date.toISOString() }) }] } }, include: { items: true, customer: true, salesOrder: true, dispatch: true } });
    await tx.invoiceDocument.create({ data: { invoiceId, version: 1, providerFileId, sizeBytes: pdf.length, generatedById: actorId, reason: "Original issued invoice" } });
    return updated;
  }, { isolationLevel: "Serializable", timeout: 120_000 });
}

export async function regenerateInvoicePdf(invoiceId: string, reason: string, actorId: string) {
  if (!reason.trim()) throw new Error("A reason is required to regenerate an issued invoice PDF.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true, customer: true, salesOrder: true, dispatch: true, financialYear: true } });
    if (!invoice || !["ISSUED", "CREDIT_NOTED"].includes(invoice.status) || !invoice.invoiceNumber || !invoice.invoiceDate) throw new Error("Only an issued invoice can have its PDF regenerated.");
    let pdf: Buffer;
    try {
      pdf = await renderInvoicePdf(invoice);
    } catch (error) {
      throw new InvoicePdfGenerationError("Invoice PDF generation failed.", { cause: error });
    }
    const version = invoice.pdfVersion + 1; const providerFileId = await uploadPrivateInvoicePdf(pdf, invoiceId); const generatedAt = new Date();
    const document = await tx.invoiceDocument.create({ data: { invoiceId, version, providerFileId, sizeBytes: pdf.length, generatedById: actorId, generatedAt, reason: reason.trim().slice(0, 1000) } });
    await tx.invoice.update({ where: { id: invoiceId }, data: { pdfProviderFileId: providerFileId, pdfGeneratedAt: generatedAt, pdfVersion: version } });
    await tx.invoiceEvent.create({ data: { invoiceId, actorId, action: "PDF_REGENERATED", details: snap({ version, previousVersion: invoice.pdfVersion, providerFileId, reason: reason.trim() }) } });
    return document;
  }, { isolationLevel: "Serializable", timeout: 120_000 });
}

export async function recordInvoicePayment(invoiceId: string, input: { amount: string | number; paymentDate: string; mode: string; transactionReference?: string; bankDetails?: string; remarks?: string; idempotencyKey: string }, actorId: string) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 100) throw new Error("A unique payment submission key is required.");
  const amount = new D(input.amount); const date = new Date(input.paymentDate);
  if (!amount.isFinite() || amount.lte(0)) throw new Error("Payment amount must be positive.");
  if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid payment date.");
  if (!["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"].includes(input.mode)) throw new Error("Select a supported payment mode.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, status: true, grandTotal: true, amountPaid: true, amountCredited: true, dueDate: true } });
    if (!invoice || !["ISSUED", "CREDIT_NOTED"].includes(invoice.status)) throw new Error("Payments can only be recorded against issued invoices.");
    if (await tx.invoicePayment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } })) throw new Error("This payment submission has already been recorded.");
    const paid = invoice.amountPaid.plus(amount); const outstanding = invoice.grandTotal.minus(invoice.amountCredited).minus(paid);
    if (outstanding.isNegative()) throw new Error("Payment exceeds the invoice's current outstanding amount.");
    const payment = await tx.invoicePayment.create({ data: { invoiceId, amount, paymentDate: date, mode: input.mode as never, transactionReference: input.transactionReference?.trim().slice(0, 150) || null, bankDetails: input.bankDetails?.trim().slice(0, 500) || null, remarks: input.remarks?.trim().slice(0, 1000) || null, idempotencyKey: input.idempotencyKey, recordedById: actorId, events: { create: { actorId, action: "RECORDED", details: snap({ amount: amount.toString(), paymentDate: date.toISOString() }) } } } });
    const paymentStatus: InvoicePaymentStatus = outstanding.isZero() ? "PAID" : invoice.dueDate && invoice.dueDate < new Date() ? "OVERDUE" : "PARTIALLY_PAID";
    const customerCredit = paid.minus(invoice.grandTotal.minus(invoice.amountCredited));
    await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid: paid, customerCreditBalance: customerCredit.gt(0) ? customerCredit : new D(0), outstandingAmount: outstanding, paymentStatus, events: { create: { actorId, action: "PAYMENT_RECORDED", details: snap({ paymentId: payment.id, amount: amount.toString() }) } } } });
    return payment;
  }, { isolationLevel: "Serializable" });
}

export async function reverseInvoicePayment(paymentId: string, reason: string, actorId: string) {
  if (!reason.trim()) throw new Error("A payment reversal reason is required.");
  return prisma.$transaction(async tx => {
    const payment = await tx.invoicePayment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
    if (!payment) throw new Error("Payment not found.");
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;
    const locked = await tx.invoicePayment.findUnique({ where: { id: paymentId } }); if (!locked || locked.status !== "RECORDED") throw new Error("Only a recorded payment can be reversed.");
    const currentInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
    const paid = currentInvoice.amountPaid.minus(payment.amount); const outstanding = currentInvoice.grandTotal.minus(currentInvoice.amountCredited).minus(paid);
    const now = new Date(); const paymentStatus: InvoicePaymentStatus = paid.isZero() ? (currentInvoice.dueDate && currentInvoice.dueDate < now ? "OVERDUE" : "UNPAID") : outstanding.lte(0) ? "PAID" : currentInvoice.dueDate && currentInvoice.dueDate < now ? "OVERDUE" : "PARTIALLY_PAID";
    const updated = await tx.invoicePayment.update({ where: { id: paymentId }, data: { status: "REVERSED", reversedById: actorId, reversedAt: now, reversalReason: reason.trim().slice(0, 1000), events: { create: { actorId, action: "REVERSED", reason: reason.trim().slice(0, 1000) } } } });
    const customerCredit = paid.minus(currentInvoice.grandTotal.minus(currentInvoice.amountCredited));
    await tx.invoice.update({ where: { id: payment.invoiceId }, data: { amountPaid: paid, customerCreditBalance: customerCredit.gt(0) ? customerCredit : new D(0), outstandingAmount: outstanding.gt(0) ? outstanding : new D(0), paymentStatus, events: { create: { actorId, action: "PAYMENT_REVERSED", details: snap({ paymentId, reason }) } } } });
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function cancelInvoice(invoiceId: string, reason: string, actorId: string) {
  if (!reason.trim()) throw new Error("A cancellation reason is required.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
    if (!invoice || invoice.status !== "ISSUED") throw new Error("Only an issued invoice can be cancelled.");
    if (invoice.payments.length) throw new Error("This invoice has payment history. Reverse/correct payments or issue a credit note before considering cancellation; payment records are preserved.");
    const cancelledAt = new Date();
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED", paymentStatus: "UNPAID", cancelledAt, cancelledById: actorId, cancellationReason: reason.trim().slice(0, 1000), outstandingAmount: new D(0), events: { create: [{ actorId, action: "CANCELLATION_REQUESTED", details: snap({ reason: reason.trim() }) }, { actorId, action: "CANCELLED", details: snap({ reason: reason.trim(), cancelledAt: cancelledAt.toISOString() }) }] } } });
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function createCreditNoteDraft(invoiceId: string, input: { reason: string; notes?: string; items: Array<{ invoiceItemId: string; quantity: number }> }, actorId: string) {
  if (!input.reason?.trim() || !Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw new Error("A reason and at least one invoice line are required.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true } });
    if (!invoice || !["ISSUED", "CREDIT_NOTED"].includes(invoice.status)) throw new Error("Credit notes require a currently issued invoice.");
    const entries: Array<Record<string, unknown>> = []; let subtotal = new D(0), cgst = new D(0), sgst = new D(0), igst = new D(0), cess = new D(0), total = new D(0);
    for (const req of combineCreditLines(input.items)) {
      if (!Number.isInteger(req.quantity) || req.quantity <= 0) throw new Error("Credit quantities must be positive whole numbers.");
      const item = invoice.items.find(x => x.id === req.invoiceItemId); if (!item) throw new Error("A selected invoice line was not found.");
      const prior = await tx.creditNoteItem.aggregate({ where: { invoiceItemId: item.id, creditNote: { status: "ISSUED" } }, _sum: { quantity: true } });
      if ((prior._sum.quantity ?? 0) + req.quantity > item.quantity) throw new Error(`Credit quantity exceeds the uncredited quantity for ${item.productName}.`);
      const ratio = new D(req.quantity).div(item.quantity); const lineTaxable = item.taxableValue.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const lineCgst = item.cgstAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const lineSgst = item.sgstAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const lineIgst = item.igstAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const lineCess = item.cessAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const lineTotal = lineTaxable.plus(lineCgst).plus(lineSgst).plus(lineIgst).plus(lineCess);
      entries.push({ invoiceItemId: item.id, quantity: req.quantity, taxableValue: lineTaxable, cgstAmount: lineCgst, sgstAmount: lineSgst, igstAmount: lineIgst, cessAmount: lineCess, totalAmount: lineTotal, taxSnapshot: snap(item.taxSnapshot) });
      subtotal = subtotal.plus(lineTaxable); cgst = cgst.plus(lineCgst); sgst = sgst.plus(lineSgst); igst = igst.plus(lineIgst); cess = cess.plus(lineCess); total = total.plus(lineTotal);
    }
    const note = await tx.creditNote.create({ data: { invoiceId, reason: input.reason.trim().slice(0, 500), notes: input.notes?.trim().slice(0, 1000) || null, subtotal, cgstTotal: cgst, sgstTotal: sgst, igstTotal: igst, cessTotal: cess, grandTotal: total, createdById: actorId, items: { create: entries as never }, events: { create: { actorId, action: "DRAFT_CREATED", details: snap({ reason: input.reason.trim() }) } } }, include: { items: true } });
    return note;
  }, { isolationLevel: "Serializable" });
}

export async function updateCreditNoteDraft(noteId: string, input: { reason: string; notes?: string; items: Array<{ invoiceItemId: string; quantity: number }> }, actorId: string) {
  if (!input.reason?.trim() || !Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw new Error("A reason and at least one invoice line are required.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "CreditNote" WHERE "id" = ${noteId} FOR UPDATE`;
    const note = await tx.creditNote.findUnique({ where: { id: noteId }, include: { invoice: { include: { items: true } } } });
    if (!note || note.status !== "DRAFT") throw new Error("Only a credit note draft can be edited.");
    const entries: Array<Record<string, unknown>> = []; let subtotal = new D(0), cgst = new D(0), sgst = new D(0), igst = new D(0), cess = new D(0), total = new D(0);
    for (const req of combineCreditLines(input.items)) {
      if (!Number.isInteger(req.quantity) || req.quantity <= 0) throw new Error("Credit quantities must be positive whole numbers.");
      const item = note.invoice.items.find(x => x.id === req.invoiceItemId); if (!item) throw new Error("A selected invoice line was not found.");
      const prior = await tx.creditNoteItem.aggregate({ where: { invoiceItemId: item.id, creditNoteId: { not: noteId }, creditNote: { status: "ISSUED" } }, _sum: { quantity: true } });
      if ((prior._sum.quantity ?? 0) + req.quantity > item.quantity) throw new Error(`Credit quantity exceeds the uncredited quantity for ${item.productName}.`);
      const ratio = new D(req.quantity).div(item.quantity); const txbl = item.taxableValue.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const cg = item.cgstAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const sg = item.sgstAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const ig = item.igstAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const ce = item.cessAmount.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const line = txbl.plus(cg).plus(sg).plus(ig).plus(ce);
      entries.push({ invoiceItemId: item.id, quantity: req.quantity, taxableValue: txbl, cgstAmount: cg, sgstAmount: sg, igstAmount: ig, cessAmount: ce, totalAmount: line, taxSnapshot: snap(item.taxSnapshot) }); subtotal = subtotal.plus(txbl); cgst = cgst.plus(cg); sgst = sgst.plus(sg); igst = igst.plus(ig); cess = cess.plus(ce); total = total.plus(line);
    }
    await tx.creditNoteItem.deleteMany({ where: { creditNoteId: noteId } });
    return tx.creditNote.update({ where: { id: noteId }, data: { reason: input.reason.trim().slice(0, 500), notes: input.notes?.trim().slice(0, 1000) || null, subtotal, cgstTotal: cgst, sgstTotal: sgst, igstTotal: igst, cessTotal: cess, grandTotal: total, items: { create: entries as never }, events: { create: { actorId, action: "DRAFT_UPDATED", details: snap({ reason: input.reason.trim() }) } } }, include: { items: true } });
  }, { isolationLevel: "Serializable" });
}

export async function issueCreditNote(noteId: string, actorId: string) {
  return prisma.$transaction(async tx => {
    let note = await tx.creditNote.findUnique({ where: { id: noteId }, include: { invoice: { include: { dispatch: { include: { warehouse: true } } } }, items: true } });
    if (!note || note.status !== "DRAFT") throw new Error("Only a credit note draft can be issued.");
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${note.invoiceId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "CreditNote" WHERE "id" = ${noteId} FOR UPDATE`;
    note = await tx.creditNote.findUnique({ where: { id: noteId }, include: { invoice: { include: { dispatch: { include: { warehouse: true } } } }, items: true } });
    if (!note || note.status !== "DRAFT") throw new Error("This credit note draft is no longer available for issuance.");
    const invoiceBeforeIssue = await tx.invoice.findUniqueOrThrow({ where: { id: note.invoiceId } });
    if (!["ISSUED", "CREDIT_NOTED"].includes(invoiceBeforeIssue.status)) throw new Error("Credit note issuance requires an issued invoice.");
    const date = new Date(); let subtotal = new D(0), cgstTotal = new D(0), sgstTotal = new D(0), igstTotal = new D(0), cessTotal = new D(0), creditTotal = new D(0);
    for (const entry of note.items) {
      const used = await tx.creditNoteItem.aggregate({ where: { invoiceItemId: entry.invoiceItemId, creditNote: { status: "ISSUED" } }, _sum: { quantity: true, taxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true } });
      const invoiceItem = await tx.invoiceItem.findUnique({ where: { id: entry.invoiceItemId } }); const priorQty = used._sum.quantity ?? 0;
      if (!invoiceItem || priorQty + entry.quantity > invoiceItem.quantity) throw new Error("Credit quantity has already been issued on another credit note.");
      const fullCredit = priorQty + entry.quantity === invoiceItem.quantity; const ratio = new D(entry.quantity).div(invoiceItem.quantity);
      const amount = (original: Prisma.Decimal, previous: Prisma.Decimal | null) => fullCredit ? original.minus(previous ?? 0) : original.mul(ratio).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const taxable = amount(invoiceItem.taxableValue, used._sum.taxableValue); const lineCgst = amount(invoiceItem.cgstAmount, used._sum.cgstAmount); const lineSgst = amount(invoiceItem.sgstAmount, used._sum.sgstAmount); const lineIgst = amount(invoiceItem.igstAmount, used._sum.igstAmount); const lineCess = amount(invoiceItem.cessAmount, used._sum.cessAmount); const lineTotal = taxable.plus(lineCgst).plus(lineSgst).plus(lineIgst).plus(lineCess);
      await tx.creditNoteItem.update({ where: { id: entry.id }, data: { taxableValue: taxable, cgstAmount: lineCgst, sgstAmount: lineSgst, igstAmount: lineIgst, cessAmount: lineCess, totalAmount: lineTotal, taxSnapshot: snap(invoiceItem.taxSnapshot) } });
      subtotal = subtotal.plus(taxable); cgstTotal = cgstTotal.plus(lineCgst); sgstTotal = sgstTotal.plus(lineSgst); igstTotal = igstTotal.plus(lineIgst); cessTotal = cessTotal.plus(lineCess); creditTotal = creditTotal.plus(lineTotal);
    }
    const numbering = await allocateNumber(tx, "CREDIT_NOTE", date, note.invoice.dispatch.warehouse.code);
    const updated = await tx.creditNote.update({ where: { id: noteId }, data: { status: "ISSUED", subtotal, cgstTotal, sgstTotal, igstTotal, cessTotal, grandTotal: creditTotal, issueDate: date, financialYearId: numbering.year.id, numberingConfigId: numbering.config.id, creditNoteNumber: numbering.number, issuedById: actorId, issuedAt: date, events: { create: [{ actorId, action: "ISSUED", details: snap({ creditNoteNumber: numbering.number, issuedAt: date.toISOString() }) }, { actorId, action: "APPLIED_TO_INVOICE", details: snap({ invoiceId: note.invoiceId, amount: creditTotal.toString() }) }] } } });
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: note.invoiceId } }); const credited = invoice.amountCredited.plus(creditTotal); const outstanding = invoice.grandTotal.minus(credited).minus(invoice.amountPaid); const customerCredit = invoice.amountPaid.minus(invoice.grandTotal.minus(credited));
    await tx.invoice.update({ where: { id: invoice.id }, data: { amountCredited: credited, customerCreditBalance: customerCredit.gt(0) ? customerCredit : new D(0), outstandingAmount: outstanding.gt(0) ? outstanding : new D(0), status: "CREDIT_NOTED", paymentStatus: invoice.amountPaid.gte(invoice.grandTotal.minus(credited)) ? "PAID" : outstanding.lte(0) ? "PAID" : invoice.dueDate && invoice.dueDate < date ? "OVERDUE" : invoice.amountPaid.gt(0) ? "PARTIALLY_PAID" : "UNPAID", events: { create: { actorId, action: "CREDIT_NOTE_ISSUED", details: snap({ creditNoteId: note.id, creditNoteNumber: numbering.number, amount: creditTotal.toString(), customerCreditBalance: customerCredit.gt(0) ? customerCredit.toString() : "0" }) } } } });
    return updated;
  }, { isolationLevel: "Serializable" });
}
