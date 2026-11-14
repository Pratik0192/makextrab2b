import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { apiError } from "@/lib/api-response";
import { consumeRateLimit, getRequestRateLimitKey } from "@/lib/auth";
import { parseLeadSubmission } from "@/lib/lead-validation";
import { prisma } from "@/lib/prisma";
import { uploadLeadDocument, deleteLeadDocumentAsset } from "@/lib/cloudinary";
import { findPossibleLeadDuplicates, saveLeadDuplicateMatches } from "@/lib/lead-duplicates";

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const SUCCESS_MESSAGE = "Your wholesale enquiry has been submitted successfully.";

class InvalidProductsError extends Error {}

function successResponse(leadId: string, referenceNumber: string, status: number) {
  return NextResponse.json({
    success: true,
    message: SUCCESS_MESSAGE,
    data: { leadId, referenceNumber },
  }, { status });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const multipart = contentType.toLowerCase().includes("multipart/form-data");
  if (!multipart && !contentType.toLowerCase().includes("application/json")) return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Submit the enquiry as JSON or multipart form data.");

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    if (multipart) return apiError(413, "DOCUMENT_TOO_LARGE", "The GST certificate exceeds the maximum upload size.", { gstCertificate: "Choose a certificate no larger than 5 MB." }, "gstCertificate");
    return apiError(413, "PAYLOAD_TOO_LARGE", "The enquiry is too large to submit.");
  }

  const limit = consumeRateLimit(getRequestRateLimitKey(request, "public-lead-create"), 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    const response = apiError(429, "RATE_LIMITED", "Too many enquiries were submitted. Please wait a few minutes and try again.");
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  let body: unknown;
  let documentFile: File | null = null;
  let documentWasSerializedInsteadOfUploaded = false;
  try {
    if (multipart) {
      const formData = await request.formData();
      const rawPayload = formData.get("payload");
      if (typeof rawPayload !== "string") return apiError(400, "INVALID_PAYLOAD", "Submit the enquiry details in the payload field.", { form: "The enquiry payload is missing." }, "form");
      body = JSON.parse(rawPayload);
      const uploadedFile = formData.get("gstCertificate");
      if (uploadedFile !== null && !(uploadedFile instanceof File)) return apiError(400, "INVALID_DOCUMENT", "The GST certificate must be uploaded as a file.", { gstCertificate: "Choose a valid file." }, "gstCertificate");
      if (uploadedFile instanceof File) documentFile = uploadedFile;
    } else {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 32 * 1024) return apiError(413, "PAYLOAD_TOO_LARGE", "The enquiry is too large to submit.");
      const jsonBody: unknown = JSON.parse(rawBody);
      if (typeof jsonBody === "object" && jsonBody !== null && !Array.isArray(jsonBody) && "payload" in jsonBody) {
        const envelope = jsonBody as { payload?: unknown; gstCertificate?: unknown };
        if (typeof envelope.payload !== "string") return apiError(400, "INVALID_PAYLOAD", "Submit a valid enquiry payload.", { form: "The enquiry payload is invalid." }, "form");
        body = JSON.parse(envelope.payload);
        documentWasSerializedInsteadOfUploaded = "gstCertificate" in envelope;
      } else body = jsonBody;
    }
  } catch { return apiError(400, "INVALID_JSON", "Submit a valid enquiry form."); }

  const parsed = parseLeadSubmission(body);
  if (!parsed.data) {
    const firstField = Object.keys(parsed.errors)[0];
    return apiError(400, "VALIDATION_ERROR", "Please check the highlighted enquiry fields.", parsed.errors, firstField);
  }
  const submission = parsed.data;
  if (documentWasSerializedInsteadOfUploaded) return apiError(400, "DOCUMENT_NOT_RECEIVED", "The GST certificate was not received as a file. Please select it again and resubmit.", { gstCertificate: "The upload did not contain a file." }, "gstCertificate");

  let uploaded: { providerFileId: string; bytes: number } | null = null;
  try {
    if (submission.idempotencyKey) {
      const existing = await prisma.lead.findUnique({ where: { idempotencyKey: submission.idempotencyKey }, select: { id: true, referenceNumber: true } });
      if (existing) return successResponse(existing.id, existing.referenceNumber, 200);
    }
    if (documentFile) uploaded = await uploadLeadDocument(documentFile);

    const lead = await prisma.$transaction(async (transaction) => {
      const productIds = submission.productInterests.map((interest) => interest.productId);
      const products = productIds.length ? await transaction.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
          category: { isActive: true },
          AND: [{ OR: [{ collectionId: null }, { collection: { isActive: true } }] }],
        },
        select: { id: true, name: true, sku: true },
      }) : [];
      if (products.length !== productIds.length) throw new InvalidProductsError();
      const duplicateMatches = await findPossibleLeadDuplicates(transaction, submission);
      const productsById = new Map(products.map((product) => [product.id, product]));
      const sequence = await transaction.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('lead_reference_number_seq'::regclass) AS value`;
      const referenceNumber = `NXT-LEAD-${sequence[0].value.toString().padStart(6, "0")}`;
      const created = await transaction.lead.create({
        data: {
          referenceNumber,
          idempotencyKey: submission.idempotencyKey,
          businessName: submission.businessName,
          businessType: submission.businessType,
          gstin: submission.gstin,
          website: submission.website,
          socialMediaUrl: submission.socialMediaUrl,
          buyerName: submission.buyerName,
          mobile: submission.mobile,
          whatsappNumber: submission.whatsappNumber,
          email: submission.email,
          preferredContactMethod: submission.preferredContactMethod,
          city: submission.city,
          state: submission.state,
          pincode: submission.pincode,
          country: submission.country,
          businessAddress: submission.businessAddress,
          estimatedTotalQuantity: submission.productInterests.length
            ? submission.productInterests.reduce((total, item) => total + item.requestedQuantity, 0)
            : null,
          estimatedOrderValue: submission.estimatedOrderValue
            ? new Prisma.Decimal(submission.estimatedOrderValue)
            : null,
          preferredPaymentMode: submission.preferredPaymentMode,
          deliveryAddress: submission.deliveryAddress,
          notes: submission.notes,
          source: "WEBSITE",
          stage: "NEW",
          priority: "MEDIUM",
          consentToContact: true,
          consentToPrivacyPolicy: true,
          informationAccuracyConfirmed: true,
          consentedAt: new Date(),
          leadProducts: submission.productInterests.length ? {
            create: submission.productInterests.map((interest) => {
              const product = productsById.get(interest.productId)!;
              return {
                productId: product.id,
                productNameSnapshot: product.name,
                skuSnapshot: product.sku,
                requestedQuantity: interest.requestedQuantity,
              };
            }),
          } : undefined,
        },
        select: { id: true, referenceNumber: true },
      });
      if (uploaded && documentFile) await transaction.leadDocument.create({ data: { leadId: created.id, documentType: "GST_CERTIFICATE", originalFileName: documentFile.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 255) || "gst-certificate", providerFileId: uploaded.providerFileId, mimeType: documentFile.type, fileSize: uploaded.bytes, uploadedByType: "VISITOR" } });
      await saveLeadDuplicateMatches(transaction, created.id, duplicateMatches);
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return successResponse(lead.id, lead.referenceNumber, 201);
  } catch (error) {
    if (uploaded) { try { await deleteLeadDocumentAsset(uploaded.providerFileId); } catch (cleanupError) { console.error("Private lead document cleanup failed", cleanupError); } }
    if (error instanceof InvalidProductsError) {
      const message = "One or more selected products are no longer available. Remove them and try again.";
      return apiError(400, "INVALID_PRODUCTS", message, { productInterests: message }, "productInterests");
    }
    if (submission.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      try {
        const existing = await prisma.lead.findUnique({ where: { idempotencyKey: submission.idempotencyKey }, select: { id: true, referenceNumber: true } });
        if (existing) return successResponse(existing.id, existing.referenceNumber, 200);
      } catch (lookupError) {
        console.error("Unable to retrieve an idempotent lead result", lookupError);
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return apiError(409, "RETRY_ENQUIRY", "Your enquiry could not be saved due to a brief update conflict. Please try submitting again.");
    if (error instanceof Error && /Use a PDF|file content|PDF certificate|JPEG certificate/.test(error.message)) return apiError(400, "INVALID_DOCUMENT", error.message, { gstCertificate: error.message }, "gstCertificate");
    if (documentFile && !uploaded) return apiError(502, "DOCUMENT_UPLOAD_FAILED", "The GST certificate could not be uploaded securely. Please retry or remove the certificate and submit the enquiry.", { gstCertificate: "Upload failed. Please try again." }, "gstCertificate");
    console.error("Public lead creation failed", error);
    return apiError(500, "LEAD_CREATE_FAILED", "We couldn't submit your enquiry right now. Please try again.");
  }
}
