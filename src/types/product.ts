import type { Category } from "@/types/category";
import type { Collection } from "@/types/collection";

export interface ProductImage {
  id: string;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface AdminProductImage extends ProductImage {
  publicId: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  fabric: string | null;
  colour: string | null;
  workOrDesign: string | null;
  length: string | null;
  minimumOrderQuantity: number;
  packSize: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  displayOrder: number;
  categoryId: string;
  collectionId: string | null;
  category: Pick<Category, "id" | "name">;
  collection: Pick<Collection, "id" | "name"> | null;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminProduct extends Omit<Product, "images"> {
  images: AdminProductImage[];
  wholesalePrice: string | null;
}

export interface CreateProductRequest {
  name: string;
  sku: string;
  categoryId: string;
  collectionId?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  fabric?: string | null;
  colour?: string | null;
  workOrDesign?: string | null;
  length?: string | null;
  wholesalePrice: string;
  minimumOrderQuantity: number;
  packSize?: number | null;
  isActive?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  displayOrder?: number;
}

export type UpdateProductRequest = Partial<CreateProductRequest>;

export interface ProductFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  collectionId?: string;
  featured?: boolean;
  newArrival?: boolean;
  active?: boolean;
  sort?: "displayOrder" | "createdAt" | "name";
  direction?: "asc" | "desc";
}

export interface ProductListResponse {
  items: Product[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
