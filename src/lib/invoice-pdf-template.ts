import type { Prisma } from "@/generated/prisma";

export type InvoicePdfRecord = Prisma.InvoiceGetPayload<{
  include: { items: true; customer: true; salesOrder: true; dispatch: true; financialYear: true };
}>;

const invoiceCss = `
  @page { size: A4 portrait; margin: 12mm 12mm 20mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; font-size: 10px; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice { width: 100%; }
  .top { display: grid; grid-template-columns: minmax(0, 1fr) 225px; gap: 18px; align-items: start; padding-bottom: 12px; border-bottom: 2px solid #7f1d3d; }
  .seller { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start; }
  .seller.no-logo { display: block; }
  .logo { width: 74px; max-height: 58px; object-fit: contain; }
  .brand { margin: 0 0 5px; color: #292c35; font-size: 19px; line-height: 1.2; font-weight: 700; }
  .seller-lines { color: #4b5563; line-height: 1.45; overflow-wrap: anywhere; }
  .seller-lines div { margin: 1px 0; }
  .invoice-meta { padding: 11px 13px; background: #f3f4f6; border-radius: 4px; }
  .invoice-meta h1 { margin: 0 0 8px; color: #7f1d3d; font-size: 15px; letter-spacing: .08em; }
  .invoice-meta div { margin-top: 4px; overflow-wrap: anywhere; }
  .meta-label { color: #6b7280; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0 10px; }
  .card { min-width: 0; padding: 9px 10px; border: 1px solid #d7dbe2; border-radius: 4px; line-height: 1.45; overflow-wrap: anywhere; }
  .card h2, .section-title { margin: 0 0 5px; color: #7f1d3d; font-size: 8px; letter-spacing: .08em; }
  .party-name { margin-bottom: 2px; font-size: 10px; font-weight: 700; }
  .refs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; padding: 8px 10px; margin-bottom: 10px; background: #f7f7f8; border-radius: 3px; }
  .ref-label { display: block; margin-bottom: 2px; color: #6b7280; font-size: 7px; text-transform: uppercase; }
  .ref-value { font-weight: 600; overflow-wrap: anywhere; }
  .table-wrap { width: 100%; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.6px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { padding: 7px 4px; color: #273244; background: #e9edf2; border-top: 1px solid #cbd2dc; border-bottom: 1px solid #cbd2dc; text-align: left; font-size: 7.8px; }
  td { padding: 6px 4px; border-bottom: 1px solid #e0e3e8; vertical-align: top; overflow-wrap: anywhere; }
  .num { text-align: right; white-space: normal; }
  .center { text-align: center; }
  .product-name { font-size: 9px; font-weight: 700; }
  .product-sub { margin-top: 2px; color: #596273; font-size: 7.8px; }
  .tax-lines div { margin: 0 0 2px; white-space: nowrap; }
  .summary-row { display: flex; justify-content: flex-end; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
  .summary { width: 275px; }
  .total-line { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px solid #eceef1; }
  .total-line span:last-child { text-align: right; white-space: nowrap; }
  .grand-total { margin-top: 5px; padding: 8px 9px; background: #f3e9ed; color: #651a32; font-size: 12px; font-weight: 700; }
  .payment { margin-top: 12px; padding: 9px 10px; border: 1px solid #d7dbe2; border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
  .payment-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .payment-label { color: #6b7280; font-size: 7px; }
  .payment-value { margin-top: 2px; font-weight: 700; }
  .footer-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
  .footer-block { line-height: 1.45; overflow-wrap: anywhere; }
  .footer-block h3 { margin: 0 0 4px; color: #7f1d3d; font-size: 7.5px; }
  .sign { margin: 14px 0 0 auto; width: 180px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .sign-line { height: 30px; border-bottom: 1px solid #707783; }
  .sign-label { margin-top: 5px; color: #4b5563; }
  .muted { color: #6b7280; }
`;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function value(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text ? escapeHtml(text) : fallback;
}

function amount(input: unknown): number {
  const result = Number(String(input ?? 0));
  return Number.isFinite(result) ? result : 0;
}

function money(input: unknown): string {
  return `₹${amount(input).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function date(input: Date | null | undefined): string {
  return input ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(input) : "—";
}

function safeLogoUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" ? url.toString() : null;
  } catch { return null; }
}

export function renderInvoiceHtml(invoice: InvoicePdfRecord): string {
  const company = (invoice.companySnapshot ?? {}) as Record<string, unknown>;
  const buyer = (invoice.customerSnapshot ?? {}) as Record<string, unknown>;
  const shipping = (invoice.shippingSnapshot ?? {}) as Record<string, unknown>;
  const address = [company.registeredAddress, company.state, company.pincode, company.country].filter(Boolean).join(", ");
  const shipAddress = [shipping.address, shipping.city, shipping.state, shipping.pincode, shipping.country].filter(Boolean).join(", ");
  const logo = safeLogoUrl(company.logoUrl);
  const text = (input: unknown, fallback = "—") => value(input, fallback);
  const totals: Array<[string, unknown]> = [
    ["Taxable subtotal", invoice.taxableSubtotal], ["Discount", invoice.discountTotal],
    ["CGST", invoice.cgstTotal], ["SGST", invoice.sgstTotal], ["IGST", invoice.igstTotal], ["Cess", invoice.cessTotal],
    ["Freight", invoice.freightTotal], ["Packing", invoice.packingTotal], ["Other charges", invoice.otherChargesTotal], ["Round-off", invoice.roundOff],
  ];
  const rows = invoice.items.map((item, index) => {
    const tax = [
      ["CGST", item.cgstAmount], ["SGST", item.sgstAmount], ["IGST", item.igstAmount], ["Cess", item.cessAmount],
    ].filter(([, taxAmount]) => amount(taxAmount) !== 0).map(([label, taxAmount]) => `<div>${label}: ${money(taxAmount)}</div>`).join("") || `<div>${money(0)}</div>`;
    return `<tr>
      <td class="center">${index + 1}</td>
      <td><div class="product-name">${text(item.productName)}</div>${item.description ? `<div class="product-sub">${text(item.description)}</div>` : ""}<div class="product-sub">SKU: ${text(item.sku)}</div></td>
      <td>${text(item.hsnSacCode)}</td>
      <td class="center">${text(item.quantity)}<div class="product-sub">${text(item.uom)}</div></td>
      <td class="num">${money(item.unitPrice)}</td><td class="num">${money(item.lineDiscount)}</td><td class="num">${money(item.taxableValue)}</td>
      <td class="center">${amount(item.gstRateSnapshot).toFixed(2)}%</td><td class="tax-lines">${tax}</td><td class="num"><strong>${money(item.lineTotal)}</strong></td>
    </tr>`;
  }).join("");
  const totalRows = totals.filter(([label, total]) => label === "Taxable subtotal" || amount(total) !== 0).map(([label, total]) => `<div class="total-line"><span>${label}</span><span>${money(total)}</span></div>`).join("");
  const companyAddress = address ? `<div>${text(address)}</div>` : "";
  const companyContact = [company.contactNumber ? `Phone: ${company.contactNumber}` : "", company.officialEmail ? `Email: ${company.officialEmail}` : ""].filter(Boolean).join(" · ");
  const companyTax = [company.gstin ? `GSTIN: ${company.gstin}` : "", company.pan ? `PAN: ${company.pan}` : ""].filter(Boolean).join(" · ");
  const billAddress = buyer.billingAddress;
  const footerInfo = [company.bankDetails ? `<section class="footer-block"><h3>BANK DETAILS</h3><div>${text(company.bankDetails)}</div></section>` : "", company.termsAndConditions ? `<section class="footer-block"><h3>TERMS &amp; CONDITIONS</h3><div>${text(company.termsAndConditions)}</div></section>` : ""].filter(Boolean).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Makextra Tax Invoice ${text(invoice.invoiceNumber, "Draft")}</title><style>${invoiceCss}</style></head><body><main class="invoice">
    <header class="top">
      <div class="seller ${logo ? "" : "no-logo"}">${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="Company logo">` : ""}<div>
        <p class="brand">Makextra Wholesale</p><div class="seller-lines">${companyAddress}${companyContact ? `<div>${text(companyContact)}</div>` : ""}${companyTax ? `<div>${text(companyTax)}</div>` : ""}</div>
      </div></div>
      <section class="invoice-meta"><h1>TAX INVOICE</h1><div><span class="meta-label">Invoice no.</span> <strong>${text(invoice.invoiceNumber)}</strong></div><div><span class="meta-label">Invoice date</span> ${date(invoice.invoiceDate)}</div><div><span class="meta-label">Due date</span> ${date(invoice.dueDate)}</div><div><span class="meta-label">Financial year</span> ${text(invoice.financialYear?.name)}</div></section>
    </header>
    <section class="parties">
      <div class="card"><h2>BILL TO</h2><div class="party-name">${text(buyer.businessName)}</div>${buyer.buyerName ? `<div>Contact: ${text(buyer.buyerName)}</div>` : ""}${billAddress ? `<div>${text(billAddress)}</div>` : ""}${[buyer.city, buyer.state, buyer.pincode].filter(Boolean).length ? `<div>${text([buyer.city, buyer.state, buyer.pincode].filter(Boolean).join(", "))}</div>` : ""}${buyer.gstin ? `<div>GSTIN: ${text(buyer.gstin)}</div>` : ""}${buyer.mobile ? `<div>Phone: ${text(buyer.mobile)}</div>` : ""}</div>
      <div class="card"><h2>SHIP TO</h2>${shipping.contactName ? `<div>Contact: ${text(shipping.contactName)}</div>` : ""}<div>${text(shipAddress)}</div>${shipping.phone ? `<div>Phone: ${text(shipping.phone)}</div>` : ""}${invoice.stateCode ? `<div>State code: ${text(invoice.stateCode)}</div>` : ""}</div>
    </section>
    <section class="refs"><div><span class="ref-label">Sales order</span><span class="ref-value">${text(invoice.salesOrder?.orderNumber)}</span></div><div><span class="ref-label">Dispatch</span><span class="ref-value">${text(invoice.dispatch?.reference)}</span></div><div><span class="ref-label">Place of supply</span><span class="ref-value">${text(invoice.placeOfSupply)}</span></div><div><span class="ref-label">State code</span><span class="ref-value">${text(invoice.stateCode)}</span></div></section>
    <div class="table-wrap"><table class="invoice-table"><colgroup><col style="width:4%"><col style="width:21%"><col style="width:7%"><col style="width:7%"><col style="width:9%"><col style="width:8%"><col style="width:10%"><col style="width:7%"><col style="width:16%"><col style="width:11%"></colgroup><thead><tr><th>#</th><th>PRODUCT / SKU</th><th>HSN</th><th class="center">QTY / UOM</th><th class="num">UNIT PRICE</th><th class="num">DISCOUNT</th><th class="num">TAXABLE</th><th class="center">GST</th><th>TAX BREAKDOWN</th><th class="num">LINE TOTAL</th></tr></thead><tbody>${rows}</tbody></table></div>
    <section class="summary-row"><div class="summary"><p class="muted">All amounts in INR</p>${totalRows}<div class="total-line grand-total"><span>GRAND TOTAL</span><span>${money(invoice.grandTotal)}</span></div></div></section>
    <section class="payment"><h2 class="section-title">PAYMENT POSITION AT DOCUMENT GENERATION</h2><div class="payment-grid"><div><div class="payment-label">Invoice amount</div><div class="payment-value">${money(invoice.grandTotal)}</div></div><div><div class="payment-label">Amount paid</div><div class="payment-value">${money(invoice.amountPaid)}</div></div><div><div class="payment-label">Credit notes applied</div><div class="payment-value">${money(invoice.amountCredited)}</div></div><div><div class="payment-label">Outstanding · ${text(invoice.paymentStatus)}</div><div class="payment-value">${money(invoice.outstandingAmount)}</div></div></div></section>
    ${footerInfo ? `<section class="footer-info">${footerInfo}</section>` : ""}
    ${company.footerNotes ? `<div class="footer-block" style="margin-top:10px">${text(company.footerNotes)}</div>` : ""}
    <div class="sign"><div class="sign-line"></div><div class="sign-label">Authorised Signatory<br>For Makextra Wholesale</div></div>
  </main></body></html>`;
}
