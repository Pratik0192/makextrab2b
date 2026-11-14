import api from "@/lib/axios";
import type { ApiSuccess, Pagination } from "@/types/api";
import type { Collection, CreateCollectionRequest, UpdateCollectionRequest } from "@/types/collection";

function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data);
}

export function listCollections(params: { page?: number; pageSize?: number; search?: string; active?: boolean } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: Collection[]; pagination: Pagination }>>(`/api/admin/collections?${query}`));
}
export function createCollection(input: CreateCollectionRequest) { return unwrap(api.post<ApiSuccess<Collection>>("/api/admin/collections", input)); }
export function updateCollection(id: string, input: UpdateCollectionRequest) { return unwrap(api.patch<ApiSuccess<Collection>>(`/api/admin/collections/${encodeURIComponent(id)}`, input)); }
export function deleteCollection(id: string) { return unwrap(api.delete<ApiSuccess<{ deleted: boolean; preservedProductCount: number }>>(`/api/admin/collections/${encodeURIComponent(id)}`)); }
export function uploadCollectionImage(id: string, file: File) { const form = new FormData(); form.append("image", file); return unwrap(api.post<ApiSuccess<{ id: string; imageUrl: string | null }>>(`/api/admin/collections/${encodeURIComponent(id)}/image`, form, { headers: { "Content-Type": "multipart/form-data" } })); }
export function deleteCollectionImage(id: string) { return unwrap(api.delete<ApiSuccess<{ id: string; imageUrl: string | null }>>(`/api/admin/collections/${encodeURIComponent(id)}/image`)); }
