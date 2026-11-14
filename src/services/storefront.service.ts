import api from "@/lib/axios";
import type { ApiSuccess, Pagination } from "@/types/api";
import type { PublicTaxonomyItem } from "@/types/public-catalogue";

function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data);
}

export function listPublicCategories(params: { page?: number; pageSize?: number; search?: string } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: PublicTaxonomyItem[]; pagination: Pagination }>>(`/api/categories?${query}`));
}

export function listPublicCollections(params: { page?: number; pageSize?: number; search?: string } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: PublicTaxonomyItem[]; pagination: Pagination }>>(`/api/collections?${query}`));
}
