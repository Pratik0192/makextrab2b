import "server-only";
import { Readable } from "node:stream";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

const CLOUDINARY_FOLDER = "nextra/products";
const TAXONOMY_FOLDERS = { categories: "nextra/categories", collections: "nextra/collections" } as const;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export interface UploadedProductImage {
  imageUrl: string;
  publicId: string;
  format: string;
  bytes: number;
}

function getMaximumUploadBytes(): number {
  const configured = Number(process.env.CLOUDINARY_UPLOAD_MAX_BYTES);
  if (!Number.isInteger(configured) || configured <= 0) return DEFAULT_MAX_BYTES;
  return Math.min(configured, 20 * 1024 * 1024);
}

function configureCloudinary(): void {
  const cloudName = process.env.CLOUDINARY_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_SECRET_KEY;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured.");
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

export function validateProductImage(file: File): string | null {
  if (file.size <= 0) return "The selected image is empty.";
  if (file.size > getMaximumUploadBytes()) return "Image exceeds the configured upload size limit.";
  const extension = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  const expectedType = ALLOWED_TYPES[extension];
  if (!expectedType || expectedType !== file.type.toLowerCase()) {
    return "Use a JPG, JPEG, PNG, or WEBP image with a matching file type.";
  }
  return null;
}

async function uploadImage(file: File, folder: string): Promise<UploadedProductImage> {
  const validationError = validateProductImage(file);
  if (validationError) throw new Error(validationError);
  configureCloudinary();
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      },
      (error, uploaded) => {
        if (error || !uploaded) reject(error ?? new Error("Cloudinary returned no upload result."));
        else resolve(uploaded);
      },
    );
    Readable.from(bytes).pipe(stream);
  });

  return { imageUrl: result.secure_url, publicId: result.public_id, format: result.format, bytes: result.bytes };
}

export function uploadProductImage(file: File): Promise<UploadedProductImage> {
  return uploadImage(file, CLOUDINARY_FOLDER);
}

export function uploadTaxonomyImage(file: File, kind: keyof typeof TAXONOMY_FOLDERS): Promise<UploadedProductImage> {
  return uploadImage(file, TAXONOMY_FOLDERS[kind]);
}

export async function deleteProductImageAsset(publicId: string): Promise<void> {
  await deleteImageAsset(publicId, CLOUDINARY_FOLDER);
}

export async function deleteTaxonomyImageAsset(publicId: string, kind: keyof typeof TAXONOMY_FOLDERS): Promise<void> {
  await deleteImageAsset(publicId, TAXONOMY_FOLDERS[kind]);
}

const LEAD_DOCUMENT_FOLDER = "nextra/lead-documents";
export async function uploadLeadDocument(file: File): Promise<{ providerFileId: string; bytes: number }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const allowed: Record<string, { mime: string; signature: number[] }> = {
    pdf: { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
    jpg: { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
    jpeg: { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
    png: { mime: "image/png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  };
  const spec = ext ? allowed[ext] : undefined;
  if (!spec || file.type !== spec.mime || file.size < 8 || file.size > 5 * 1024 * 1024) throw new Error("Use a PDF, JPG or PNG certificate up to 5 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!spec.signature.every((byte, index) => bytes[index] === byte)) throw new Error("The file content does not match its type.");
  if (ext === "pdf" && !bytes.subarray(Math.max(0, bytes.length - 2048)).includes(Buffer.from("%%EOF"))) throw new Error("The PDF certificate is incomplete or invalid.");
  if ((ext === "jpg" || ext === "jpeg") && !(bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9)) throw new Error("The JPEG certificate is incomplete or invalid.");
  configureCloudinary();
  const publicId = `${LEAD_DOCUMENT_FOLDER}/${crypto.randomUUID()}`;
  await new Promise<void>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "raw", type: "authenticated", overwrite: false }, (error, result) => error || !result ? reject(error ?? new Error("Upload failed.")) : resolve());
    Readable.from(bytes).pipe(stream);
  });
  return { providerFileId: publicId, bytes: bytes.length };
}

export async function getPrivateLeadDocumentUrl(providerFileId: string, extension: string): Promise<string> {
  if (!providerFileId.startsWith(`${LEAD_DOCUMENT_FOLDER}/`) || providerFileId.includes("..")) throw new Error("Invalid document identifier.");
  configureCloudinary();
  return cloudinary.utils.private_download_url(providerFileId, extension, { resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 60, attachment: true });
}

export async function deleteLeadDocumentAsset(providerFileId: string): Promise<void> {
  if (!providerFileId.startsWith(`${LEAD_DOCUMENT_FOLDER}/`) || providerFileId.includes("..")) throw new Error("Invalid document identifier.");
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(providerFileId, { resource_type: "raw", type: "authenticated", invalidate: true });
  if (result.result !== "ok" && result.result !== "not found") throw new Error("Document cleanup was not confirmed.");
}

const INVOICE_DOCUMENT_FOLDER = "nextra/invoices";
export async function uploadPrivateInvoicePdf(bytes: Buffer, invoiceId: string): Promise<string> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(invoiceId) || bytes.length < 100 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid invoice PDF.");
  configureCloudinary();
  const publicId = `${INVOICE_DOCUMENT_FOLDER}/${invoiceId}/${crypto.randomUUID()}`;
  await new Promise<void>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "raw", type: "authenticated", overwrite: false, format: "pdf" }, (error, result) => error || !result ? reject(error ?? new Error("Invoice PDF upload failed.")) : resolve());
    Readable.from(bytes).pipe(stream);
  });
  return publicId;
}

export async function getPrivateInvoicePdfUrl(providerFileId: string, attachment = false): Promise<string> {
  if (!providerFileId.startsWith(`${INVOICE_DOCUMENT_FOLDER}/`) || providerFileId.includes("..")) throw new Error("Invalid invoice document identifier.");
  configureCloudinary();
  return cloudinary.utils.private_download_url(providerFileId, "pdf", { resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 60, attachment });
}

async function deleteImageAsset(publicId: string, folder: string): Promise<void> {
  if (!publicId.startsWith(folder + "/") || publicId.includes("..")) {
    throw new Error("Invalid product image identifier.");
  }
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Cloudinary did not confirm image deletion.");
  }
}
