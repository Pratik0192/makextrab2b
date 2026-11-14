import api from "@/lib/axios";
import type { ApiSuccess } from "@/types/api";
import type { AdminProduct, CreateProductRequest, Product, ProductFilters, ProductListResponse, UpdateProductRequest } from "@/types/product";

function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data);
}

export function getPublicProducts(filters: ProductFilters = {}): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return unwrap(api.get<ApiSuccess<ProductListResponse>>(`/api/products?${params.toString()}`));
}

export function getAdminProducts(filters: ProductFilters = {}): Promise<{ items: AdminProduct[]; pagination: ProductListResponse["pagination"] }> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return unwrap(api.get<ApiSuccess<{ items: AdminProduct[]; pagination: ProductListResponse["pagination"] }>>(`/api/admin/products?${params.toString()}`));
}

export function getAdminProduct(id: string): Promise<AdminProduct> {
  return unwrap(api.get<ApiSuccess<AdminProduct>>(`/api/admin/products/${encodeURIComponent(id)}`));
}

export async function createProduct(data: CreateProductRequest, files: File[], primaryIndex = 0): Promise<AdminProduct> {
  const form = new FormData();
  form.append("product", JSON.stringify(data));
  if (files.length > 0) form.append("primaryIndex", String(primaryIndex));
  files.forEach((file) => form.append("images", file));
  return unwrap(api.post<ApiSuccess<AdminProduct>>("/api/admin/products", form, { headers: { "Content-Type": "multipart/form-data" } }));
}

export function updateProduct(id: string, data: UpdateProductRequest): Promise<AdminProduct> {
  return unwrap(api.patch<ApiSuccess<AdminProduct>>(`/api/admin/products/${encodeURIComponent(id)}`, data));
}

export function uploadProductImages(id: string, files: File[], primaryIndex?: number): Promise<AdminProduct["images"]> {
  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  if (primaryIndex !== undefined) form.append("primaryIndex", String(primaryIndex));
  return unwrap(api.post<ApiSuccess<AdminProduct["images"]>>(`/api/admin/products/${encodeURIComponent(id)}/images`, form, { headers: { "Content-Type": "multipart/form-data" } }));
}

export function saveProductImageOrder(id: string, images: Array<{ id: string; displayOrder: number; isPrimary: boolean }>): Promise<AdminProduct["images"]> {
  return unwrap(api.patch<ApiSuccess<AdminProduct["images"]>>(`/api/admin/products/${encodeURIComponent(id)}/images`, { images }));
}

export function deleteProductImage(id: string, imageId: string): Promise<AdminProduct["images"]> {
  return unwrap(api.delete<ApiSuccess<AdminProduct["images"]>>(`/api/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`));
}

export function deleteProduct(id: string): Promise<{ deleted: boolean; deactivated: boolean; product?: AdminProduct }> {
  return unwrap(api.delete<ApiSuccess<{ deleted: boolean; deactivated: boolean; product?: AdminProduct }>>(`/api/admin/products/${encodeURIComponent(id)}`));
}

export function getProductById(id: string): Promise<Product> {
  return unwrap(api.get<ApiSuccess<Product>>(`/api/products/${encodeURIComponent(id)}`));
}
