import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiFailure, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { deleteTaxonomyImageAsset, uploadTaxonomyImage, validateProductImage } from "@/lib/cloudinary";

type TaxonomyKind = "categories" | "collections";

async function findItem(kind: TaxonomyKind, id: string) {
  return kind === "categories"
    ? prisma.category.findUnique({ where: { id }, select: { id: true, imageUrl: true, imagePublicId: true } })
    : prisma.collection.findUnique({ where: { id }, select: { id: true, imageUrl: true, imagePublicId: true } });
}

async function updateImage(kind: TaxonomyKind, id: string, imageUrl: string | null, imagePublicId: string | null) {
  return kind === "categories"
    ? prisma.category.update({ where: { id }, data: { imageUrl, imagePublicId }, select: { id: true, imageUrl: true } })
    : prisma.collection.update({ where: { id }, data: { imageUrl, imagePublicId }, select: { id: true, imageUrl: true } });
}

export async function handleTaxonomyImage(request: NextRequest, kind: TaxonomyKind, id: string, remove = false) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const item = await findItem(kind, id);
  if (!item) return apiError(404, "NOT_FOUND", `${kind === "categories" ? "Category" : "Collection"} was not found.`);

  if (remove) {
    if (!item.imagePublicId) {
      await updateImage(kind, id, null, null);
      return apiSuccess({ id, imageUrl: null });
    }
    await updateImage(kind, id, null, null);
    try {
      await deleteTaxonomyImageAsset(item.imagePublicId, kind);
      return apiSuccess({ id, imageUrl: null });
    } catch {
      await updateImage(kind, id, item.imageUrl, item.imagePublicId);
      return apiError(502, "CLOUDINARY_DELETE_FAILED", "The image could not be removed from Cloudinary. The saved image was restored.");
    }
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send an image file using multipart form data.");
  let form: FormData;
  try { form = await request.formData(); } catch { return apiError(400, "INVALID_FORM_DATA", "The image upload could not be read."); }
  const entry = form.get("image");
  if (!entry || typeof entry === "string" || typeof entry.arrayBuffer !== "function") return apiError(400, "INVALID_IMAGE", "Select an image file to upload.");
  const validationError = validateProductImage(entry);
  if (validationError) return apiError(400, "INVALID_IMAGE", validationError);

  let uploaded;
  try { uploaded = await uploadTaxonomyImage(entry, kind); }
  catch { return apiError(502, "CLOUDINARY_UPLOAD_FAILED", "The image could not be uploaded. Please try again."); }
  try {
    const updated = await updateImage(kind, id, uploaded.imageUrl, uploaded.publicId);
    if (item.imagePublicId) {
      try { await deleteTaxonomyImageAsset(item.imagePublicId, kind); }
      catch {
        await updateImage(kind, id, item.imageUrl, item.imagePublicId);
        await deleteTaxonomyImageAsset(uploaded.publicId, kind).catch(() => undefined);
        return apiError(502, "CLOUDINARY_DELETE_FAILED", "The previous image could not be removed; the original image remains saved.");
      }
    }
    return apiSuccess(updated);
  } catch (error) {
    await deleteTaxonomyImageAsset(uploaded.publicId, kind).catch(() => undefined);
    return apiFailure(error);
  }
}
