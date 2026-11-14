-- Catalogue image identity and warehouse inventory support.
-- Backfill existing rows to the confirmed fixed MOQ and set the future-row default.
UPDATE "Product" SET "minimumOrderQuantity" = 10 WHERE "minimumOrderQuantity" <> 10;
ALTER TABLE "Product" ALTER COLUMN "minimumOrderQuantity" SET DEFAULT 10;
ALTER TABLE "ProductImage" ADD COLUMN "publicId" TEXT;
CREATE UNIQUE INDEX "ProductImage_publicId_key" ON "ProductImage"("publicId");
ALTER TABLE "Category" ADD COLUMN "imagePublicId" TEXT;
ALTER TABLE "Collection" ADD COLUMN "imagePublicId" TEXT;
CREATE UNIQUE INDEX "Category_imagePublicId_key" ON "Category"("imagePublicId");
CREATE UNIQUE INDEX "Collection_imagePublicId_key" ON "Collection"("imagePublicId");

CREATE TYPE "StockMovementType" AS ENUM (
  'OPENING_STOCK',
  'STOCK_IN',
  'STOCK_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT'
);

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "contactPerson" TEXT,
  "contactPhone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockBalance" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "quantityReserved" INTEGER NOT NULL DEFAULT 0,
  "quantityBlocked" INTEGER NOT NULL DEFAULT 0,
  "reorderLevel" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockBalance_quantityOnHand_check" CHECK ("quantityOnHand" >= 0),
  CONSTRAINT "StockBalance_quantityReserved_check" CHECK ("quantityReserved" >= 0),
  CONSTRAINT "StockBalance_quantityBlocked_check" CHECK ("quantityBlocked" >= 0),
  CONSTRAINT "StockBalance_available_nonnegative_check" CHECK ("quantityOnHand" >= "quantityReserved" + "quantityBlocked"),
  CONSTRAINT "StockBalance_reorderLevel_check" CHECK ("reorderLevel" IS NULL OR "reorderLevel" >= 0)
);

CREATE TABLE "StockLedger" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "movementType" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reference" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "transferGroupId" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockLedger_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_isActive_name_idx" ON "Warehouse"("isActive", "name");
CREATE UNIQUE INDEX "StockBalance_productId_warehouseId_key" ON "StockBalance"("productId", "warehouseId");
CREATE INDEX "StockBalance_warehouseId_idx" ON "StockBalance"("warehouseId");
CREATE INDEX "StockBalance_productId_idx" ON "StockBalance"("productId");
CREATE INDEX "StockLedger_productId_createdAt_idx" ON "StockLedger"("productId", "createdAt");
CREATE INDEX "StockLedger_warehouseId_createdAt_idx" ON "StockLedger"("warehouseId", "createdAt");
CREATE INDEX "StockLedger_movementType_createdAt_idx" ON "StockLedger"("movementType", "createdAt");
CREATE INDEX "StockLedger_createdById_idx" ON "StockLedger"("createdById");
CREATE INDEX "StockLedger_transferGroupId_idx" ON "StockLedger"("transferGroupId");

ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
