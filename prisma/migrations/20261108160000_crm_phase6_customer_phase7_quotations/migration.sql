ALTER TYPE "LeadActivityType" ADD VALUE IF NOT EXISTS 'LEAD_CONVERTED';

CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

CREATE SEQUENCE "customer_code_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE "quotation_number_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "buyerName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "email" TEXT NOT NULL,
    "gstin" TEXT,
    "website" TEXT,
    "socialMediaUrl" TEXT,
    "businessAddress" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "preferredContactMethod" "PreferredContactMethod" NOT NULL,
    "preferredPaymentMode" "PreferredPaymentMode",
    "deliveryAddress" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedSalesExecutiveId" UUID,
    "convertedFromLeadId" TEXT,
    "convertedById" UUID NOT NULL,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAuditEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceLeadId" TEXT,
    "createdById" UUID NOT NULL,
    "sentById" UUID,
    "assignedSalesExecutiveId" UUID,
    "quotationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "revisionOfId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountType" TEXT,
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "customerNotes" TEXT,
    "sentAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuotationEvent" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");
CREATE UNIQUE INDEX "Customer_convertedFromLeadId_key" ON "Customer"("convertedFromLeadId");
CREATE INDEX "Customer_status_createdAt_idx" ON "Customer"("status", "createdAt");
CREATE INDEX "Customer_businessType_createdAt_idx" ON "Customer"("businessType", "createdAt");
CREATE INDEX "Customer_assignedSalesExecutiveId_status_idx" ON "Customer"("assignedSalesExecutiveId", "status");
CREATE INDEX "Customer_city_state_idx" ON "Customer"("city", "state");
CREATE INDEX "Customer_convertedAt_idx" ON "Customer"("convertedAt");
CREATE INDEX "CustomerAuditEvent_customerId_createdAt_idx" ON "CustomerAuditEvent"("customerId", "createdAt");
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");
CREATE INDEX "Quotation_customerId_quotationDate_idx" ON "Quotation"("customerId", "quotationDate");
CREATE INDEX "Quotation_status_quotationDate_idx" ON "Quotation"("status", "quotationDate");
CREATE INDEX "Quotation_createdById_quotationDate_idx" ON "Quotation"("createdById", "quotationDate");
CREATE INDEX "Quotation_assignedSalesExecutiveId_quotationDate_idx" ON "Quotation"("assignedSalesExecutiveId", "quotationDate");
CREATE INDEX "Quotation_revisionOfId_revisionNumber_idx" ON "Quotation"("revisionOfId", "revisionNumber");
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
CREATE INDEX "QuotationItem_productId_idx" ON "QuotationItem"("productId");
CREATE INDEX "QuotationEvent_quotationId_createdAt_idx" ON "QuotationEvent"("quotationId", "createdAt");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_convertedFromLeadId_fkey" FOREIGN KEY ("convertedFromLeadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedSalesExecutiveId_fkey" FOREIGN KEY ("assignedSalesExecutiveId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAuditEvent" ADD CONSTRAINT "CustomerAuditEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAuditEvent" ADD CONSTRAINT "CustomerAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_assignedSalesExecutiveId_fkey" FOREIGN KEY ("assignedSalesExecutiveId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuotationEvent" ADD CONSTRAINT "QuotationEvent_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationEvent" ADD CONSTRAINT "QuotationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
