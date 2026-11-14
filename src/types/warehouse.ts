export interface Warehouse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  isActive: boolean;
  stockRecordCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseRequest {
  name: string;
  code: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  isActive?: boolean;
}

export type UpdateWarehouseRequest = Partial<CreateWarehouseRequest>;
