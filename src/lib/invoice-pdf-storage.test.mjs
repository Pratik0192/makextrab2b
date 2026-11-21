import assert from "node:assert/strict";
import test from "node:test";
import { renderInvoicePdf } from "./invoice-pdf.ts";
import {
  invoicePdfFilename,
  isValidInvoicePdf,
  normalizeInvoicePdfPublicId,
} from "./invoice-pdf-storage.ts";

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
    companySnapshot: { legalBusinessName: "Test Co" },
    customerSnapshot: { businessName: "Buyer" },
    shippingSnapshot: { address: "Test address", city: "Surat", state: "Gujarat", pincode: "395007" },
    items: [{
      productName: "Test Saree", description: null, sku: "TEST-001", gstRateSnapshot: 0,
      hsnSacCode: "TEST-HSN", quantity: 1, uom: "Piece", unitPrice: 100,
      lineDiscount: 0, taxableValue: 100, cgstAmount: 0, sgstAmount: 0,
      igstAmount: 0, cessAmount: 0, lineTotal: 100,
    }],
    invoiceNumber: "TEST-INV-1", invoiceDate: new Date("2026-11-01T00:00:00Z"), dueDate: null,
    placeOfSupply: "Test state", stateCode: "00", salesOrder: { orderNumber: "TEST-ORDER" },
    dispatch: { reference: "TEST-DISPATCH" }, taxableSubtotal: 100, cgstTotal: 0,
    sgstTotal: 0, igstTotal: 0, cessTotal: 0, freightTotal: 0, packingTotal: 0,
    otherChargesTotal: 0, discountTotal: 0, roundOff: 0, grandTotal: 100,
    financialYear: { name: "FY TEST" }, reverseCharge: false,
  };
  const bytes = await renderInvoicePdf(invoice);
  assert.ok(bytes.length > 100);
  assert.equal(isValidInvoicePdf(bytes), true);
});
