import type { Prisma } from "@/generated/prisma";
import { InvoicePdfGenerationError, isValidInvoicePdf } from "./invoice-pdf-storage.ts";
import { renderHtmlPdf } from "./pdf/puppeteer.ts";
import { renderInvoiceHtml } from "./invoice-pdf-template.ts";

type InvoiceForPdf = Prisma.InvoiceGetPayload<{
  include: { items: true; customer: true; salesOrder: true; dispatch: true; financialYear: true };
}>;

/** Render the saved invoice snapshot into an A4 PDF without recalculating any invoice values. */
export async function renderInvoicePdf(invoice: InvoiceForPdf): Promise<Buffer> {
  try {
    const bytes = await renderHtmlPdf(renderInvoiceHtml(invoice));
    if (!isValidInvoicePdf(bytes)) throw new Error("Chromium returned an incomplete PDF document.");
    return bytes;
  } catch (error) {
    if (error instanceof InvoicePdfGenerationError) throw error;
    throw new InvoicePdfGenerationError("Invoice PDF generation failed.", { cause: error });
  }
}
