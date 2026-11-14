import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, isRecord, requireSuperAdmin } from "@/lib/admin-api";
import { uploadProductImage, validateProductImage, deleteProductImageAsset, type UploadedProductImage } from "@/lib/cloudinary";

type RouteContext = { params: Promise<{ id: string }> };
function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id: productId } = await context.params;
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, _count: { select: { images: true } } } });
  if (!product) return apiError(404, "NOT_FOUND", "Product was not found.");
  let form: FormData;
  try { form = await request.formData(); }
  catch { return apiError(400, "INVALID_FORM_DATA", "The image form could not be read."); }
  const entries = form.getAll("images");
  if (entries.length === 0 || entries.some((entry) => !isFile(entry))) return apiError(400, "INVALID_IMAGE", "Choose one or more image files.");
  const files = entries.filter(isFile);
  if (files.length > 12) return apiError(400, "TOO_MANY_IMAGES", "Upload no more than 12 images at a time.");
  if (product._count.images + files.length > 12) return apiError(400, "TOO_MANY_IMAGES", "A product can have at most 12 images.");
  for (const file of files) {
    const validationError = validateProductImage(file);
    if (validationError) return apiError(400, validationError.includes("size limit") ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE", validationError);
  }
  const primaryIndex = Number(form.get("primaryIndex"));
  if (form.has("primaryIndex") && (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= files.length)) {
    return apiError(400, "INVALID_PRIMARY_IMAGE", "Select a valid primary image.");
  }

  const uploaded: UploadedProductImage[] = [];
  try {
    for (const file of files) uploaded.push(await uploadProductImage(file));
  } catch (error) {
    console.error("Product image upload failed", error);
    const cleanup = await Promise.allSettled(uploaded.map((image) => deleteProductImageAsset(image.publicId)));
    cleanup.forEach((result) => { if (result.status === "rejected") console.error("Failed to clean up product image", result.reason); });
    return apiError(502, "IMAGE_UPLOAD_FAILED", "One or more product images could not be uploaded.");
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.productImage.findMany({ where: { productId }, select: { id: true, isPrimary: true, displayOrder: true } });
      const hasPrimary = current.some((image) => image.isPrimary);
      const choosePrimary = form.has("primaryIndex") ? primaryIndex : (hasPrimary ? -1 : 0);
      if (choosePrimary >= 0) await transaction.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      await transaction.productImage.createMany({ data: uploaded.map((image, index) => ({
        productId,
        imageUrl: image.imageUrl,
        publicId: image.publicId,
        altText: product.name + " saree",
        isPrimary: index === choosePrimary,
        displayOrder: current.length + index,
      })) });
    });
  } catch (error) {
    console.error("Product image save failed", error);
    const cleanup = await Promise.allSettled(uploaded.map((image) => deleteProductImageAsset(image.publicId)));
    cleanup.forEach((result) => { if (result.status === "rejected") console.error("Failed to clean up product image", result.reason); });
    return apiError(500, "IMAGE_SAVE_FAILED", "Images were uploaded but could not be attached to the product.");
  }
  const images = await prisma.productImage.findMany({ where: { productId }, orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }] });
  return apiSuccess(images, 201);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const { id: productId } = await context.params;
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(400, "INVALID_JSON", "Image order must be valid JSON."); }
  if (!isRecord(body) || !Array.isArray(body.images) || body.images.length === 0) {
    return apiError(400, "VALIDATION_ERROR", "Provide the product images and their new order.");
  }
  const entries = body.images;
  const normalized: Array<{ id: string; displayOrder: number; isPrimary: boolean }> = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id || seen.has(entry.id) ||
      typeof entry.displayOrder !== "number" || !Number.isInteger(entry.displayOrder) || entry.displayOrder < 0 ||
      typeof entry.isPrimary !== "boolean") {
      return apiError(400, "VALIDATION_ERROR", "Image IDs, order values and primary selection are invalid.");
    }
    seen.add(entry.id);
    normalized.push({ id: entry.id, displayOrder: entry.displayOrder, isPrimary: entry.isPrimary });
  }
  if (normalized.filter((image) => image.isPrimary).length !== 1) return apiError(400, "INVALID_PRIMARY_IMAGE", "Choose exactly one primary image.");
  try {
    const current = await prisma.productImage.findMany({ where: { productId }, select: { id: true } });
    if (current.length !== normalized.length || current.some((image) => !seen.has(image.id))) {
      return apiError(400, "IMAGE_SET_CHANGED", "Reload the product images before changing their order.");
    }
    await prisma.$transaction(normalized.map((image) => prisma.productImage.update({
      where: { id: image.id }, data: { displayOrder: image.displayOrder, isPrimary: image.isPrimary },
    })));
    const images = await prisma.productImage.findMany({ where: { productId }, orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }] });
    return apiSuccess(images);
  } catch (error) {
    return apiFailure(error);
  }
}
