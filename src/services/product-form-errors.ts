import axios from "axios";

type ProductError = { code?: string; message?: string; field?: string };

export function productSaveError(error: unknown, isEdit: boolean, sku: string): { title: string; message: string; field?: string } {
  if (!axios.isAxiosError(error)) return { title: "Product could not be saved", message: "Please review the product details and try again." };
  if (!error.response) return { title: "Connection problem", message: "We couldn't reach the server. Check your connection and try again." };
  const body = error.response.data as { error?: ProductError | string } | undefined;
  const value = body?.error;
  const apiError = typeof value === "object" && value ? value : undefined;
  const code = apiError?.code;
  const message = apiError?.message;
  if (code === "DUPLICATE_SKU") {
    return { title: "Product SKU already exists", message: `${sku || "This SKU"} is already assigned to another product. Enter a unique SKU.`, field: "sku" };
  }
  if (code === "INVALID_IMAGE" || code === "IMAGE_TOO_LARGE" || code === "TOO_MANY_IMAGES") return { title: code === "IMAGE_TOO_LARGE" ? "Image too large" : code === "TOO_MANY_IMAGES" ? "Too many images" : "Invalid image", message: message ?? "Please check the selected product images." };
  if (code === "IMAGE_UPLOAD_FAILED") return { title: "Image upload failed", message: "We couldn't upload the product image. Please try again." };
  if (code === "NOT_FOUND") return { title: "Product not found", message: "This product may have been removed. Refresh the list and try again." };
  if (apiError?.field && message) return { title: "Check product details", message, field: apiError.field };
  if (message) return { title: isEdit ? "Product update failed" : "Product creation failed", message };
  return { title: isEdit ? "Product update failed" : "Product creation failed", message: "Please try again. If the problem continues, contact your administrator." };
}
