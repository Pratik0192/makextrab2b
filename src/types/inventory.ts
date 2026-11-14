import type { Product } from "@/types/product";
import type { Warehouse } from "@/types/warehouse";

export type StockMovementType =
  | "OPENING_STOCK"
  | "STOCK_IN"
  | "STOCK_OUT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export interface StockBalance {
  id: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityBlocked: number;
  reorderLevel: number | null;
  availableQuantity: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  product: Pick<Product, "id" | "name" | "sku" | "images">;
  warehouse: Pick<Warehouse, "id" | "name" | "code">;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: StockMovementType;
  quantity: number;
  reference: string | null;
  reason: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  transferGroupId?: string | null;
}

export interface StockLedger extends StockLedgerEntry {
  product: Pick<Product, "id" | "name" | "sku">;
  warehouse: Pick<Warehouse, "id" | "name" | "code">;
  createdBy: { id: string; firstName: string; lastName: string; email: string };
}

export type StockBalanceRecord = Pick<StockBalance, "id" | "productId" | "warehouseId" | "quantityOnHand" | "quantityReserved" | "quantityBlocked" | "reorderLevel" | "updatedAt"> & { createdAt: string };

export interface StockOperationResult {
  balance: StockBalanceRecord;
  ledger: StockLedgerEntry;
  availableQuantity: number;
}

export interface StockTransfer {
  id: string;
  transferGroupId: string;
  product: Pick<Product, "id" | "name" | "sku">;
  sourceWarehouse: Pick<Warehouse, "id" | "name" | "code">;
  destinationWarehouse: Pick<Warehouse, "id" | "name" | "code"> | null;
  quantity: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string; email: string };
}

export interface StockTransferRequest {
  productId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  quantity: number;
  reference?: string;
  notes?: string;
}

export interface StockInRequest {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason?: string;
  reference?: string;
  notes?: string;
  reorderLevel?: number | null;
}

export interface StockOutRequest extends StockInRequest {
  reason: string;
}

export interface StockAdjustmentRequest extends StockInRequest {
  reason: string;
}
