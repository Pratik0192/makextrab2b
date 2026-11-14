import { Prisma } from "@/generated/prisma";
import type { ApiErrorResponse } from "@/types/api";

export const publicProductSelect = {
  id: true,
  name: true,
  sku: true,
  shortDescription: true,
  description: true,
  fabric: true,
  colour: true,
  workOrDesign: true,
  length: true,
  minimumOrderQuantity: true,
  packSize: true,
  isActive: true,
  isFeatured: true,
  isNewArrival: true,
  displayOrder: true,
  categoryId: true,
  collectionId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  collection: { select: { id: true, name: true } },
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: { id: true, imageUrl: true, altText: true, isPrimary: true, displayOrder: true, createdAt: true },
  },
} satisfies Prisma.ProductSelect;

export const adminProductInclude = {
  category: { select: { id: true, name: true } },
  collection: { select: { id: true, name: true } },
  images: { orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }, { createdAt: "asc" as const }] },
} satisfies Prisma.ProductInclude;

export type ProductWriteData = {
  name?: string;
  sku?: string;
  shortDescription?: string | null;
  description?: string | null;
  fabric?: string | null;
  colour?: string | null;
  workOrDesign?: string | null;
  length?: string | null;
  wholesalePrice?: Prisma.Decimal;
  minimumOrderQuantity?: number;
  packSize?: number | null;
  isActive?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  displayOrder?: number;
  categoryId?: string;
  collectionId?: string | null;
};

export interface ProductValidationResult {
  data: ProductWriteData | null;
  error?: ApiErrorResponse["error"];
}

const textLimits: Record<string, number> = {
  name: 180,
  sku: 80,
  shortDescription: 300,
  description: 10000,
  fabric: 120,
  colour: 120,
  workOrDesign: 200,
  length: 80,
  categoryId: 64,
  collectionId: 64,
};

export function parseProductWriteData(value: unknown, partial: boolean): ProductValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { data: null, error: { code: "VALIDATION_ERROR", message: "Product details must be an object." } };
  }
  const input = value as Record<string, unknown>;
  const data: ProductWriteData = {};

  if (!partial && !("wholesalePrice" in input)) {
    return { data: null, error: { code: "VALIDATION_ERROR", message: "Enter a wholesale price per piece.", field: "wholesalePrice" } };
  }
  if ("wholesalePrice" in input) {
    const raw = input.wholesalePrice;
    const value = typeof raw === "number" || typeof raw === "string" ? String(raw).trim() : "";
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) {
      return { data: null, error: { code: "VALIDATION_ERROR", message: "Enter a valid price with up to two decimal places.", field: "wholesalePrice" } };
    }
    const price = new Prisma.Decimal(value);
    if (!price.gt(0)) {
      return { data: null, error: { code: "VALIDATION_ERROR", message: "Wholesale price must be greater than zero.", field: "wholesalePrice" } };
    }
    data.wholesalePrice = price;
  }

  for (const key of Object.keys(textLimits)) {
    const isNullable = ["shortDescription", "description", "fabric", "colour", "workOrDesign", "length", "collectionId"].includes(key);
    const required = !partial && ["name", "sku", "categoryId"].includes(key);
    if (!(key in input)) {
      if (required) return { data: null, error: { code: "VALIDATION_ERROR", message: requiredProductMessage(key), field: key } };
      continue;
    }
    const raw = input[key];
    if (raw === null && isNullable) {
      (data as Record<string, unknown>)[key] = null;
      continue;
    }
    if (typeof raw !== "string") {
      return { data: null, error: { code: "VALIDATION_ERROR", message: `${key} must be text.`, field: key } };
    }
    const trimmed = raw.trim();
    if (!trimmed && isNullable) {
      (data as Record<string, unknown>)[key] = key === "collectionId" ? null : null;
      continue;
    }
    if (!trimmed && required) {
      return { data: null, error: { code: "VALIDATION_ERROR", message: requiredProductMessage(key), field: key } };
    }
    if (trimmed.length > textLimits[key]) {
      return { data: null, error: { code: "VALIDATION_ERROR", message: `${key} is too long.`, field: key } };
    }
    if (key === "sku") (data as Record<string, unknown>)[key] = trimmed.toUpperCase();
    else (data as Record<string, unknown>)[key] = trimmed;
  }

  for (const key of ["minimumOrderQuantity", "packSize", "displayOrder"] as const) {
    if (!(key in input)) {
      if (!partial && key === "minimumOrderQuantity") data.minimumOrderQuantity = 10;
      if (!partial && key === "displayOrder") data.displayOrder = 0;
      continue;
    }
    const raw = input[key];
    if (key === "minimumOrderQuantity" && raw !== 10) {
      return { data: null, error: { code: "FIXED_MOQ", message: "Minimum order quantity is fixed at 10.", field: key } };
    }
    if (raw === null && key === "packSize") {
      data.packSize = null;
      continue;
    }
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      return { data: null, error: { code: "VALIDATION_ERROR", message: `${key} must be a whole number.`, field: key } };
    }
    const minimum = key === "displayOrder" ? 0 : 1;
    if (raw < minimum || raw > 1_000_000) {
      return { data: null, error: { code: "VALIDATION_ERROR", message: `${key} is outside the allowed range.`, field: key } };
    }
    data[key] = raw;
  }

  for (const key of ["isActive", "isFeatured", "isNewArrival"] as const) {
    if (!(key in input)) continue;
    if (typeof input[key] !== "boolean") {
      return { data: null, error: { code: "VALIDATION_ERROR", message: `${key} must be true or false.` } };
    }
    data[key] = input[key];
  }

  if (!partial && data.minimumOrderQuantity === undefined) data.minimumOrderQuantity = 10;
  return { data };
}

function requiredProductMessage(field: string): string {
  if (field === "name") return "Please enter a product name.";
  if (field === "sku") return "Please enter a product SKU.";
  if (field === "categoryId") return "Please select a category.";
  return `${field} is required.`;
}
