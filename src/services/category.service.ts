import api from "@/lib/axios";
import type { ApiSuccess, Pagination } from "@/types/api";
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from "@/types/category";

function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data);
}

export function listCategories(params: { page?: number; pageSize?: number; search?: string; active?: boolean } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: Category[]; pagination: Pagination }>>(`/api/admin/categories?${query}`));
}
export function createCategory(input: CreateCategoryRequest) { return unwrap(api.post<ApiSuccess<Category>>("/api/admin/categories", input)); }
export function updateCategory(id: string, input: UpdateCategoryRequest) { return unwrap(api.patch<ApiSuccess<Category>>(`/api/admin/categories/${encodeURIComponent(id)}`, input)); }
export function deleteCategory(id: string) { return unwrap(api.delete<ApiSuccess<{ deleted: boolean }>>(`/api/admin/categories/${encodeURIComponent(id)}`)); }
export function uploadCategoryImage(id: string, file: File) { const form = new FormData(); form.append("image", file); return unwrap(api.post<ApiSuccess<{ id: string; imageUrl: string | null }>>(`/api/admin/categories/${encodeURIComponent(id)}/image`, form, { headers: { "Content-Type": "multipart/form-data" } })); }
export function deleteCategoryImage(id: string) { return unwrap(api.delete<ApiSuccess<{ id: string; imageUrl: string | null }>>(`/api/admin/categories/${encodeURIComponent(id)}/image`)); }
