const INVOICE_DOCUMENT_FOLDER = "nextra/invoices";

/**
 * Cloudinary raw assets include their extension in the public ID. Earlier
 * invoice uploads stored an extensionless ID, so normalize those IDs when
 * generating a download URL as well as when handling newly returned IDs.
 */
export function normalizeInvoicePdfPublicId(providerFileId: string): string {
  if (
    !providerFileId.startsWith(`${INVOICE_DOCUMENT_FOLDER}/`) ||
    providerFileId.includes("..")
  ) {
    throw new Error("Invalid invoice document identifier.");
  }

  const assetPath = providerFileId.slice(INVOICE_DOCUMENT_FOLDER.length + 1);
  if (!/^[a-zA-Z0-9_-]{1,100}\/[a-zA-Z0-9_-]{1,100}(?:\.pdf)?$/i.test(assetPath)) {
    throw new Error("Invalid invoice document identifier.");
  }

  return providerFileId.toLowerCase().endsWith(".pdf")
    ? providerFileId
    : `${providerFileId}.pdf`;
}

export function isValidInvoicePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 10) return false;
  const header = Buffer.from(bytes.subarray(0, 5)).toString("ascii");
  if (header !== "%PDF-") return false;
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 2048))).toString("latin1");
  return tail.includes("%%EOF");
}

export function invoicePdfFilename(invoiceNumber: string | null): string {
  const safe = (invoiceNumber ?? "invoice").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safe || "invoice"}.pdf`;
}

export class InvoicePdfStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvoicePdfStorageError";
  }
}

export class InvoicePdfGenerationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvoicePdfGenerationError";
  }
}
