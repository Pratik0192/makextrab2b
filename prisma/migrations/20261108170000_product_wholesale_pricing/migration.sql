ALTER TABLE "Product" ADD COLUMN "wholesalePrice" DECIMAL(12,2);

ALTER TABLE "QuotationItem" ADD COLUMN "catalogUnitPriceSnapshot" DECIMAL(12,2);

CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "previousPrice" DECIMAL(12,2),
    "newPrice" DECIMAL(12,2) NOT NULL,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductPriceHistory_productId_updatedAt_idx" ON "ProductPriceHistory"("productId", "updatedAt");
CREATE INDEX "ProductPriceHistory_updatedById_updatedAt_idx" ON "ProductPriceHistory"("updatedById", "updatedAt");

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
