ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'CONSUMED';
CREATE TYPE "PickingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "PackingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "DispatchStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_DISPATCHED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED');
CREATE TYPE "BillingAuditEntity" AS ENUM ('COMPANY_SETTINGS', 'GST_RATE', 'HSN_SAC', 'PRODUCT_TAX', 'FINANCIAL_YEAR', 'NUMBERING_CONFIG', 'CHARGE_CONFIG');
CREATE TYPE "RoundingMethod" AS ENUM ('HALF_UP', 'HALF_EVEN', 'DOWN', 'UP');
CREATE TYPE "DocumentType" AS ENUM ('TAX_INVOICE', 'PROFORMA_INVOICE', 'DELIVERY_CHALLAN', 'CREDIT_NOTE', 'DEBIT_NOTE');

ALTER TABLE "Product" ADD COLUMN "hsnSacId" TEXT, ADD COLUMN "gstRateId" TEXT, ADD COLUMN "taxInclusive" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "taxUom" TEXT;
ALTER TABLE "SalesOrderReservation" ADD COLUMN "consumedQuantity" INTEGER NOT NULL DEFAULT 0;

CREATE SEQUENCE picking_ref_seq START 1;
CREATE SEQUENCE packing_ref_seq START 1;
CREATE SEQUENCE dispatch_ref_seq START 1;

CREATE TABLE "PickingList" (
  "id" TEXT NOT NULL, "reference" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL,
  "status" "PickingStatus" NOT NULL DEFAULT 'NOT_STARTED', "createdById" UUID NOT NULL, "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PickingList_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PickingList_reference_key" ON "PickingList"("reference");
CREATE UNIQUE INDEX "PickingList_salesOrderId_key" ON "PickingList"("salesOrderId");
CREATE INDEX "PickingList_warehouseId_status_createdAt_idx" ON "PickingList"("warehouseId", "status", "createdAt");
ALTER TABLE "PickingList" ADD CONSTRAINT "PickingList_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PickingList" ADD CONSTRAINT "PickingList_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PickingList" ADD CONSTRAINT "PickingList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PickingListItem" (
  "id" TEXT NOT NULL, "pickingListId" TEXT NOT NULL, "salesOrderItemId" TEXT NOT NULL, "reservedQuantity" INTEGER NOT NULL,
  "pickedQuantity" INTEGER NOT NULL DEFAULT 0, "discrepancyNote" TEXT, "pickedById" UUID, "pickedAt" TIMESTAMP(3),
  CONSTRAINT "PickingListItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PickingListItem_salesOrderItemId_key" ON "PickingListItem"("salesOrderItemId");
CREATE INDEX "PickingListItem_pickingListId_idx" ON "PickingListItem"("pickingListId");
ALTER TABLE "PickingListItem" ADD CONSTRAINT "PickingListItem_pickingListId_fkey" FOREIGN KEY ("pickingListId") REFERENCES "PickingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PickingListItem" ADD CONSTRAINT "PickingListItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PickingListItem" ADD CONSTRAINT "PickingListItem_pickedById_fkey" FOREIGN KEY ("pickedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PackingRecord" (
  "id" TEXT NOT NULL, "reference" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL,
  "status" "PackingStatus" NOT NULL DEFAULT 'IN_PROGRESS', "notes" TEXT, "packedById" UUID NOT NULL, "packedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackingRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PackingRecord_reference_key" ON "PackingRecord"("reference");
CREATE INDEX "PackingRecord_salesOrderId_status_createdAt_idx" ON "PackingRecord"("salesOrderId", "status", "createdAt");
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_packedById_fkey" FOREIGN KEY ("packedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Package" (
  "id" TEXT NOT NULL, "packingRecordId" TEXT NOT NULL, "packageNumber" INTEGER NOT NULL, "description" TEXT, "weightKg" DECIMAL(10,3),
  CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Package_packingRecordId_packageNumber_key" ON "Package"("packingRecordId", "packageNumber");
CREATE INDEX "Package_packingRecordId_idx" ON "Package"("packingRecordId");
ALTER TABLE "Package" ADD CONSTRAINT "Package_packingRecordId_fkey" FOREIGN KEY ("packingRecordId") REFERENCES "PackingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PackageItem" (
  "id" TEXT NOT NULL, "packageId" TEXT NOT NULL, "salesOrderItemId" TEXT NOT NULL, "packedQuantity" INTEGER NOT NULL,
  CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PackageItem_packageId_idx" ON "PackageItem"("packageId");
CREATE INDEX "PackageItem_salesOrderItemId_idx" ON "PackageItem"("salesOrderItemId");
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Dispatch" (
  "id" TEXT NOT NULL, "reference" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL,
  "status" "DispatchStatus" NOT NULL DEFAULT 'DRAFT', "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NOT_DISPATCHED',
  "courierName" TEXT, "trackingNumber" TEXT, "packageCount" INTEGER NOT NULL, "notes" TEXT, "createdById" UUID NOT NULL,
  "confirmedById" UUID, "dispatchedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Dispatch_reference_key" ON "Dispatch"("reference");
CREATE INDEX "Dispatch_salesOrderId_status_createdAt_idx" ON "Dispatch"("salesOrderId", "status", "createdAt");
CREATE INDEX "Dispatch_warehouseId_dispatchedAt_idx" ON "Dispatch"("warehouseId", "dispatchedAt");
CREATE INDEX "Dispatch_deliveryStatus_dispatchedAt_idx" ON "Dispatch"("deliveryStatus", "dispatchedAt");
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DispatchItem" (
  "id" TEXT NOT NULL, "dispatchId" TEXT NOT NULL, "packageItemId" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  CONSTRAINT "DispatchItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DispatchItem_dispatchId_packageItemId_key" ON "DispatchItem"("dispatchId", "packageItemId");
CREATE INDEX "DispatchItem_packageItemId_idx" ON "DispatchItem"("packageItemId");
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_packageItemId_fkey" FOREIGN KEY ("packageItemId") REFERENCES "PackageItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DeliveryStatusEvent" (
  "id" TEXT NOT NULL, "dispatchId" TEXT NOT NULL, "previousStatus" "DeliveryStatus" NOT NULL, "newStatus" "DeliveryStatus" NOT NULL,
  "actorId" UUID NOT NULL, "notes" TEXT, "failureReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DeliveryStatusEvent_dispatchId_createdAt_idx" ON "DeliveryStatusEvent"("dispatchId", "createdAt");
ALTER TABLE "DeliveryStatusEvent" ADD CONSTRAINT "DeliveryStatusEvent_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryStatusEvent" ADD CONSTRAINT "DeliveryStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CompanySettings" (
  "id" TEXT NOT NULL DEFAULT 'main', "legalBusinessName" TEXT, "tradeName" TEXT, "logoUrl" TEXT, "logoPublicId" TEXT,
  "registeredAddress" TEXT, "state" TEXT, "stateCode" TEXT, "pincode" TEXT, "country" TEXT, "contactNumber" TEXT,
  "officialEmail" TEXT, "pan" TEXT, "gstin" TEXT, "registrationDetails" TEXT, "invoiceHeaderName" TEXT,
  "bankDetails" TEXT, "footerNotes" TEXT, "termsAndConditions" TEXT, "defaultPlaceOfSupply" TEXT,
  "roundingPrecision" INTEGER NOT NULL DEFAULT 2, "roundingMethod" "RoundingMethod" NOT NULL DEFAULT 'HALF_UP',
  "freightLabel" TEXT NOT NULL DEFAULT 'Freight', "packingLabel" TEXT NOT NULL DEFAULT 'Packing', "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GstTaxRate" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "cgstPercent" DECIMAL(5,2) NOT NULL,
  "sgstPercent" DECIMAL(5,2) NOT NULL, "igstPercent" DECIMAL(5,2) NOT NULL, "cessPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "taxInclusive" BOOLEAN NOT NULL DEFAULT false, "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "GstTaxRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GstTaxRate_code_effectiveFrom_key" ON "GstTaxRate"("code", "effectiveFrom");
CREATE INDEX "GstTaxRate_isActive_effectiveFrom_effectiveTo_idx" ON "GstTaxRate"("isActive", "effectiveFrom", "effectiveTo");

CREATE TABLE "HsnSac" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT NOT NULL, "gstRateId" TEXT, "unitOfMeasure" TEXT,
  "effectiveFrom" TIMESTAMP(3), "effectiveTo" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HsnSac_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HsnSac_code_key" ON "HsnSac"("code");
CREATE INDEX "HsnSac_isActive_code_idx" ON "HsnSac"("isActive", "code");
ALTER TABLE "HsnSac" ADD CONSTRAINT "HsnSac_gstRateId_fkey" FOREIGN KEY ("gstRateId") REFERENCES "GstTaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_hsnSacId_fkey" FOREIGN KEY ("hsnSacId") REFERENCES "HsnSac"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_gstRateId_fkey" FOREIGN KEY ("gstRateId") REFERENCES "GstTaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FinancialYear" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FinancialYear_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialYear_name_key" ON "FinancialYear"("name");
CREATE INDEX "FinancialYear_isActive_startDate_endDate_idx" ON "FinancialYear"("isActive", "startDate", "endDate");

CREATE TABLE "DocumentNumberingConfig" (
  "id" TEXT NOT NULL, "financialYearId" TEXT NOT NULL, "documentType" "DocumentType" NOT NULL, "prefix" TEXT NOT NULL,
  "suffix" TEXT, "startingSequence" INTEGER NOT NULL DEFAULT 1, "currentSequence" INTEGER NOT NULL DEFAULT 0,
  "branchCode" TEXT NOT NULL DEFAULT 'DEFAULT', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "DocumentNumberingConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentNumberingConfig_financialYearId_documentType_branchCode_key" ON "DocumentNumberingConfig"("financialYearId", "documentType", "branchCode");
CREATE INDEX "DocumentNumberingConfig_documentType_isActive_idx" ON "DocumentNumberingConfig"("documentType", "isActive");
ALTER TABLE "DocumentNumberingConfig" ADD CONSTRAINT "DocumentNumberingConfig_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ChargeConfiguration" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "label" TEXT NOT NULL, "taxRateId" TEXT, "isTaxable" BOOLEAN NOT NULL DEFAULT false, "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChargeConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChargeConfiguration_code_key" ON "ChargeConfiguration"("code");
ALTER TABLE "ChargeConfiguration" ADD CONSTRAINT "ChargeConfiguration_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "GstTaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BillingAuditEvent" (
  "id" TEXT NOT NULL, "entity" "BillingAuditEntity" NOT NULL, "entityId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "actorId" UUID NOT NULL, "changes" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BillingAuditEvent_entity_entityId_createdAt_idx" ON "BillingAuditEvent"("entity", "entityId", "createdAt");
CREATE INDEX "BillingAuditEvent_actorId_createdAt_idx" ON "BillingAuditEvent"("actorId", "createdAt");
ALTER TABLE "BillingAuditEvent" ADD CONSTRAINT "BillingAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
