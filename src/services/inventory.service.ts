import api from "@/lib/axios";
import type { ApiSuccess, Pagination } from "@/types/api";
import type { StockAdjustmentRequest, StockBalance, StockBalanceRecord, StockInRequest, StockLedger, StockLedgerEntry, StockOperationResult, StockOutRequest, StockTransfer, StockTransferRequest } from "@/types/inventory";

function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data);
}

export function listInventory(params: { page?: number; pageSize?: number; search?: string; warehouseId?: string; lowStock?: boolean } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: StockBalance[]; pagination: Pagination }>>(`/api/admin/inventory?${query}`));
}
export function getInventoryBalance(id: string) { return unwrap(api.get<ApiSuccess<StockBalance>>(`/api/admin/inventory/${encodeURIComponent(id)}`)); }
export function stockIn(input: StockInRequest) { return unwrap(api.post<ApiSuccess<StockOperationResult>>("/api/admin/inventory/stock-in", input)); }
export function stockOut(input: StockOutRequest) { return unwrap(api.post<ApiSuccess<StockOperationResult>>("/api/admin/inventory/stock-out", input)); }
export function adjustStock(input: StockAdjustmentRequest) { return unwrap(api.post<ApiSuccess<StockOperationResult>>("/api/admin/inventory/adjustment", input)); }
export function listStockLedger(params: { page?: number; pageSize?: number; productId?: string; warehouseId?: string; movementType?: string; from?: string; to?: string } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: StockLedger[]; pagination: Pagination }>>(`/api/admin/inventory/ledger?${query}`));
}
export function createStockTransfer(input: StockTransferRequest) { return unwrap(api.post<ApiSuccess<{ transferGroupId: string; sourceBalance: StockBalanceRecord; destinationBalance: StockBalanceRecord; outgoing: StockLedgerEntry; incoming: StockLedgerEntry }>>("/api/admin/inventory/transfers", input)); }
export function listStockTransfers(params: { page?: number; pageSize?: number; productId?: string } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
  return unwrap(api.get<ApiSuccess<{ items: StockTransfer[]; pagination: Pagination }>>(`/api/admin/inventory/transfers?${query}`));
}
