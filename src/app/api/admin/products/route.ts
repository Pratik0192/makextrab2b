import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, positiveInteger, requireSuperAdmin } from "@/lib/admin-api";
import { uploadProductImage, validateProductImage, type UploadedProductImage } from "@/lib/cloudinary";
import { deleteProductImageAsset } from "@/lib/cloudinary";
import { adminProductInclude, parseProductWriteData } from "@/lib/product-data";

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1, 1_000_000);
  const pageSize = positiveInteger(params.get("pageSize"), 20, 100);
  const search = params.get("search")?.trim().slice(0, 100);
  const categoryId = params.get("categoryId") || undefined;
  const collectionId = params.get("collectionId") || undefined;
  const active = params.get("active");
  const featured = params.get("featured");
  const newArrival = params.get("newArrival");
  const where = {
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { sku: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(collectionId ? { collectionId } : {}),
    ...(active === "true" || active === "false" ? { isActive: active === "true" } : {}),
    ...(featured === "true" || featured === "false" ? { isFeatured: featured === "true" } : {}),
    ...(newArrival === "true" || newArrival === "false" ? { isNewArrival: newArrival === "true" } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: adminProductInclude, orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);
  return apiSuccess({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthFailure(auth)) return auth;
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send product details and images as multipart form data.");
  }

  let form: FormData;
  try { form = await request.formData(); }
  catch { return apiError(400, "INVALID_FORM_DATA", "The submitted form could not be read."); }

  let rawProduct: unknown;
  try { rawProduct = JSON.parse(String(form.get("product") ?? "")); }
  catch { return apiError(400, "VALIDATION_ERROR", "Product details must be valid JSON."); }
  const parsed = parseProductWriteData(rawProduct, false);
  if (!parsed.data) return apiError(400, parsed.error?.code ?? "VALIDATION_ERROR", parsed.error?.message ?? "Product details are invalid.", undefined, parsed.error?.field);
  const data = parsed.data;
  const entries = form.getAll("images");
  if (entries.some((entry) => !isFile(entry))) return apiError(400, "INVALID_IMAGE", "Images must be uploaded as files.");
  const files = entries.filter(isFile);
  if (files.length > 12) return apiError(400, "TOO_MANY_IMAGES", "A product can have at most 12 images per upload.");
  const primaryValue = form.get("primaryIndex");
  const primaryIndex = primaryValue === null ? 0 : Number(primaryValue);
  if (files.length > 0 && (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= files.length)) {
    return apiError(400, "INVALID_PRIMARY_IMAGE", "Select a valid primary image.");
  }
  for (const file of files) {
    const message = validateProductImage(file);
    if (message) return apiError(400, message.includes("size limit") ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE", message);
  }

  const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
  if (!category) return apiError(400, "INVALID_CATEGORY", "Select an existing category.", undefined, "categoryId");
  if (data.collectionId) {
    const collection = await prisma.collection.findUnique({ where: { id: data.collectionId }, select: { id: true } });
    if (!collection) return apiError(400, "INVALID_COLLECTION", "Select an existing collection.", undefined, "collectionId");
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
    const { categoryId, collectionId, ...productFields } = data;
    const product = await prisma.product.create({
      data: {
        ...productFields,
        priceHistory: { create: { previousPrice: null, newPrice: data.wholesalePrice!, updatedById: auth.id } },
        category: { connect: { id: categoryId! } },
        ...(collectionId ? { collection: { connect: { id: collectionId } } } : {}),
        images: uploaded.length ? { create: uploaded.map((image, index) => ({
          imageUrl: image.imageUrl,
          publicId: image.publicId,
          altText: data.name + " saree",
          isPrimary: index === primaryIndex,
          displayOrder: index,
        })) } : undefined,
      } as Prisma.ProductCreateInput,
      include: adminProductInclude,
    });
    return apiSuccess(product, 201);
  } catch (error) {
    const cleanup = await Promise.allSettled(uploaded.map((image) => deleteProductImageAsset(image.publicId)));
    cleanup.forEach((result) => { if (result.status === "rejected") console.error("Failed to clean up product image", result.reason); });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "DUPLICATE_SKU", "This SKU is already assigned to another product.", undefined, "sku");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return apiError(400, "INVALID_REFERENCE", "The selected category or collection is no longer available.");
    console.error("Product creation failed", error);
    return apiError(500, "PRODUCT_CREATE_FAILED", "The product could not be created. Please try again.");
  }
}
