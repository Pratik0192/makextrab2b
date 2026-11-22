import assert from "node:assert/strict";
import test, { after } from "node:test";
import { writeFile } from "node:fs/promises";
import { renderInvoicePdf } from "./invoice-pdf.ts";
import { closeInvoicePdfBrowser } from "./pdf/puppeteer.ts";
import { renderInvoiceHtml } from "./invoice-pdf-template.ts";
import {
  invoicePdfFilename,
  isValidInvoicePdf,
  normalizeInvoicePdfPublicId,
} from "./invoice-pdf-storage.ts";

after(async () => closeInvoicePdfBrowser());

test("normalizes legacy extensionless raw PDF IDs and leaves current IDs intact", () => {
  assert.equal(
    normalizeInvoicePdfPublicId("nextra/invoices/cuid123/asset-uuid"),
    "nextra/invoices/cuid123/asset-uuid.pdf",
  );
  assert.equal(
    normalizeInvoicePdfPublicId("nextra/invoices/cuid123/asset-uuid.pdf"),
    "nextra/invoices/cuid123/asset-uuid.pdf",
  );
});

test("rejects unsafe or malformed invoice PDF provider IDs", () => {
  for (const id of [
    "nextra/other/cuid123/asset.pdf",
    "nextra/invoices/../asset.pdf",
    "nextra/invoices/cuid123/asset.exe",
    "nextra/invoices/cuid123/asset/extra.pdf",
  ]) {
    assert.throws(() => normalizeInvoicePdfPublicId(id), /Invalid invoice document identifier/);
  }
});

test("validates PDF header and terminal marker instead of accepting provider error pages", () => {
  assert.equal(isValidInvoicePdf(Buffer.from("%PDF-1.4\nbody\n%%EOF")), true);
  assert.equal(isValidInvoicePdf(Buffer.from('{"error":"not found"}')), false);
  assert.equal(isValidInvoicePdf(Buffer.from("%PDF-1.4\ntruncated")), false);
});

test("builds a safe invoice filename", () => {
  assert.equal(invoicePdfFilename("MXT/INV/FY 2026-27-KOL-001-000002"), "MXT_INV_FY_2026-27-KOL-001-000002.pdf");
  assert.equal(invoicePdfFilename(null), "invoice.pdf");
});

test("PDF renderer produces complete PDF bytes suitable for storage and retrieval", async () => {
  const invoice = {
    companySnapshot: { legalBusinessName: "Makextra Wholesale Demo (TEST ONLY)", registeredAddress: "Test Company Address", gstin: "GST-TEST-001", pan: "PAN-TEST" },
    customerSnapshot: { businessName: "Buyer" },
    shippingSnapshot: { address: "Test address", city: "Surat", state: "Gujarat", pincode: "395007" },
    items: [1, 2, 3].map(() => ({
      productName: "Test Saree", description: null, sku: "TEST-001", gstRateSnapshot: 0,
      hsnSacCode: "TEST-HSN", quantity: 1, uom: "Piece", unitPrice: 100,
      lineDiscount: 0, taxableValue: 100, cgstAmount: 0, sgstAmount: 0,
      igstAmount: 0, cessAmount: 0, lineTotal: 100,
    })).map((item, index) => ({ ...item, productName: `Test Saree ${index + 1}`, sku: `TEST-00${index + 1}` })),
    invoiceNumber: "TEST-INV-1", invoiceDate: new Date("2026-11-01T00:00:00Z"), dueDate: null,
    placeOfSupply: "Test state", stateCode: "00", salesOrder: { orderNumber: "TEST-ORDER" },
    dispatch: { reference: "TEST-DISPATCH" }, taxableSubtotal: 100, cgstTotal: 0,
    sgstTotal: 0, igstTotal: 0, cessTotal: 0, freightTotal: 0, packingTotal: 0,
    otherChargesTotal: 0, discountTotal: 0, roundOff: 0, grandTotal: 100,
    financialYear: { name: "FY TEST" }, reverseCharge: false, amountPaid: 25,
    amountCredited: 0, outstandingAmount: 75, paymentStatus: "PARTIALLY_PAID",
  };
  const coldConcurrent = await Promise.all([renderInvoicePdf(invoice), renderInvoicePdf({ ...invoice, invoiceNumber: "TEST-COLD-2" })]);
  assert.equal(coldConcurrent.every(isValidInvoicePdf), true, "concurrent cold-start renders should share a valid browser launch");
  const bytes = await renderInvoicePdf(invoice);
  assert.ok(bytes.length > 100);
  assert.equal(isValidInvoicePdf(bytes), true);
  const statusVariants = await Promise.all([
    renderInvoicePdf({ ...invoice, amountPaid: 100, outstandingAmount: 0, paymentStatus: "PAID" }),
    renderInvoicePdf({ ...invoice, amountCredited: 25, outstandingAmount: 50, paymentStatus: "PARTIALLY_PAID" }),
    renderInvoicePdf({ ...invoice, companySnapshot: {}, customerSnapshot: {}, shippingSnapshot: {} }),
  ]);
  assert.equal(statusVariants.every(isValidInvoicePdf), true, "paid, credited and sparse optional data must render valid PDFs");
  const html = renderInvoiceHtml(invoice);
  assert.match(html, /Makextra Wholesale/);
  assert.doesNotMatch(html, /Demo \(TEST ONLY\)/);
  assert.match(html, /PARTIALLY_PAID/);
  assert.match(html, /₹25\.00/);
  assert.match(html, /GST-TEST-001/);
  assert.match(html, /PAN-TEST/);
  assert.match(renderInvoiceHtml({ ...invoice, amountPaid: 100, outstandingAmount: 0, paymentStatus: "PAID" }), /PAID/);
  assert.match(renderInvoiceHtml({ ...invoice, amountCredited: 25, outstandingAmount: 50 }), /Credit notes applied<\/div><div class="payment-value">₹25\.00/);
  assert.doesNotThrow(() => renderInvoiceHtml({ ...invoice, companySnapshot: {}, customerSnapshot: {} }));
  const item = {
    productName: "Premium Banarasi Silk Saree with a deliberately long product name",
    description: "Traditional woven border and detailed pallu with matching blouse piece",
    sku: "NX-SAREE-001", gstRateSnapshot: 5, hsnSacCode: "500720",
    quantity: 3, uom: "Piece", unitPrice: 1250, lineDiscount: 50,
    taxableValue: 3700, cgstAmount: 92.5, sgstAmount: 92.5,
    igstAmount: 0, cessAmount: 0, lineTotal: 3885,
  };
  const multiPageInvoice = { ...invoice, invoiceNumber: "MXT/INV/MULTIPAGE", items: Array.from({ length: 45 }, () => ({ ...item })) };
  const multiPageBytes = await renderInvoicePdf(multiPageInvoice);
  if (process.env.INVOICE_PDF_PREVIEW_PATH) await writeFile(process.env.INVOICE_PDF_PREVIEW_PATH, multiPageBytes);
  const output = multiPageBytes.toString("latin1");
  const pageCount = (output.match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(pageCount > 1, "many product rows should produce multiple pages");
  const multiPageHtml = renderInvoiceHtml(multiPageInvoice);
  assert.match(multiPageHtml, /<thead>[\s\S]*PRODUCT \/ SKU/);
  assert.match(multiPageHtml, /display: table-header-group/);
  assert.match(multiPageHtml, /break-inside: avoid/);
  assert.equal(isValidInvoicePdf(multiPageBytes), true);
  const concurrent = await Promise.all([renderInvoicePdf(invoice), renderInvoicePdf({ ...invoice, invoiceNumber: "TEST-CONCURRENT" })]);
  assert.equal(concurrent.every(isValidInvoicePdf), true, "concurrent PDF renders should produce valid files");
});
