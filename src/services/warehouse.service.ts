import api from "@/lib/axios";
import type { ApiSuccess, Pagination } from "@/types/api";
import type { CreateWarehouseRequest, UpdateWarehouseRequest, Warehouse } from "@/types/warehouse";

function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data);
}

export function listWarehouses(params: { page?: number; pageSize?: number; search?: string; active?: boolean } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: Warehouse[]; pagination: Pagination }>>(`/api/admin/warehouses?${query}`));
}
export function createWarehouse(input: CreateWarehouseRequest) { return unwrap(api.post<ApiSuccess<Warehouse>>("/api/admin/warehouses", input)); }
export function updateWarehouse(id: string, input: UpdateWarehouseRequest) { return unwrap(api.patch<ApiSuccess<Warehouse>>(`/api/admin/warehouses/${encodeURIComponent(id)}`, input)); }
export function deleteWarehouse(id: string) { return unwrap(api.delete<ApiSuccess<{ deleted: boolean }>>(`/api/admin/warehouses/${encodeURIComponent(id)}`)); }
