import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { getPrivateInvoicePdfUrl } from "@/lib/cloudinary";
import { canViewInvoice } from "@/lib/invoices";
import { invoicePdfFilename, isValidInvoicePdf } from "@/lib/invoice-pdf-storage";
import { prisma } from "@/lib/prisma";

function unavailable(message = "Invoice PDF is temporarily unavailable.") {
  return NextResponse.json({ error: message }, { status: 502 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { salesOrder: { include: { customer: true } } },
  });
  if (!invoice || !canViewInvoice(user, invoice) || !["ISSUED", "CREDIT_NOTED"].includes(invoice.status)) {
    return NextResponse.json({ error: "Invoice PDF not found." }, { status: 404 });
  }

  const requestedDocumentId = request.nextUrl.searchParams.get("documentId");
  const document = requestedDocumentId
    ? await prisma.invoiceDocument.findFirst({ where: { id: requestedDocumentId, invoiceId: id } })
    : null;
  if (requestedDocumentId && !document) {
    return NextResponse.json({ error: "Invoice PDF version not found." }, { status: 404 });
  }
  const providerFileId = document?.providerFileId ?? invoice.pdfProviderFileId;
  if (!providerFileId) return NextResponse.json({ error: "Invoice PDF not found." }, { status: 404 });

  const attachment = request.nextUrl.searchParams.get("download") !== "0";
  let stored: Response;
  try {
    const url = await getPrivateInvoicePdfUrl(providerFileId, attachment);
    stored = await fetch(url, { cache: "no-store", redirect: "error" });
  } catch (error) {
    console.error("[invoice-pdf] Cloudinary retrieval failed", {
      invoiceId: id,
      documentId: document?.id ?? null,
      version: document?.version ?? invoice.pdfVersion,
      error,
    });
    return unavailable();
  }

  if (!stored.ok || !stored.body) {
    console.error("[invoice-pdf] Cloudinary returned an unsuccessful response", {
      invoiceId: id,
      documentId: document?.id ?? null,
      version: document?.version ?? invoice.pdfVersion,
      status: stored.status,
      statusText: stored.statusText,
    });
    return unavailable();
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await stored.arrayBuffer());
  } catch (error) {
    console.error("[invoice-pdf] Could not read Cloudinary response bytes", {
      invoiceId: id,
      documentId: document?.id ?? null,
      version: document?.version ?? invoice.pdfVersion,
      error,
    });
    return unavailable();
  }

  if (!isValidInvoicePdf(bytes)) {
    console.error("[invoice-pdf] Cloudinary response was not a complete PDF", {
      invoiceId: id,
      documentId: document?.id ?? null,
      version: document?.version ?? invoice.pdfVersion,
      contentType: stored.headers.get("content-type"),
      byteLength: bytes.length,
    });
    return unavailable();
  }

  try {
    await prisma.invoiceEvent.create({
      data: {
        invoiceId: id,
        actorId: user.id,
        action: "PDF_ACCESSED",
        details: {
          mode: attachment ? "download" : "view",
          documentId: document?.id ?? null,
          version: document?.version ?? invoice.pdfVersion,
        },
      },
    });
  } catch (error) {
    // Do not turn a successfully retrieved PDF into a misleading storage failure.
    console.error("[invoice-pdf] PDF access audit event could not be saved", { invoiceId: id, error });
  }

  const filename = invoicePdfFilename(invoice.invoiceNumber);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
    },
  });
}
