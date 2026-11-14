-- Lead capture models. Existing catalogue and inventory data is untouched.
CREATE TYPE "LeadSource" AS ENUM (
  'WEBSITE',
  'WHATSAPP',
  'MANUAL',
  'PHONE',
  'SOCIAL_CAMPAIGN',
  'REFERRAL',
  'WALK_IN',
  'EXISTING_CUSTOMER',
  'IMPORT'
);

CREATE TYPE "LeadStage" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
  'ON_HOLD'
);

CREATE TYPE "BusinessType" AS ENUM (
  'WHOLESALER',
  'RETAILER',
  'BOUTIQUE',
  'DISTRIBUTOR',
  'RESELLER',
  'OTHER'
);

CREATE TYPE "PreferredContactMethod" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL');
CREATE TYPE "PreferredPaymentMode" AS ENUM ('BANK_TRANSFER', 'UPI', 'OTHER', 'NOT_DECIDED');
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE SEQUENCE "lead_reference_number_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "idempotencyKey" UUID,
  "businessName" TEXT NOT NULL,
  "businessType" "BusinessType" NOT NULL,
  "gstin" TEXT,
  "website" TEXT,
  "socialMediaUrl" TEXT,
  "buyerName" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "whatsappNumber" TEXT,
  "email" TEXT NOT NULL,
  "preferredContactMethod" "PreferredContactMethod" NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'India',
  "businessAddress" TEXT,
  "estimatedTotalQuantity" INTEGER,
  "estimatedOrderValue" DECIMAL(12,2),
  "preferredPaymentMode" "PreferredPaymentMode",
  "deliveryAddress" TEXT,
  "notes" TEXT,
  "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
  "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
  "priority" "LeadPriority" NOT NULL DEFAULT 'NORMAL',
  "consentToContact" BOOLEAN NOT NULL,
  "consentToPrivacyPolicy" BOOLEAN NOT NULL,
  "informationAccuracyConfirmed" BOOLEAN NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadProduct" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "productId" TEXT,
  "productNameSnapshot" TEXT NOT NULL,
  "skuSnapshot" TEXT NOT NULL,
  "requestedQuantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadProduct_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadProduct_requestedQuantity_check" CHECK ("requestedQuantity" >= 10)
);

CREATE UNIQUE INDEX "Lead_referenceNumber_key" ON "Lead"("referenceNumber");
CREATE UNIQUE INDEX "Lead_idempotencyKey_key" ON "Lead"("idempotencyKey");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "Lead_stage_createdAt_idx" ON "Lead"("stage", "createdAt");
CREATE INDEX "Lead_source_createdAt_idx" ON "Lead"("source", "createdAt");
CREATE INDEX "Lead_mobile_idx" ON "Lead"("mobile");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_businessName_idx" ON "Lead"("businessName");
CREATE UNIQUE INDEX "LeadProduct_leadId_productId_key" ON "LeadProduct"("leadId", "productId");
CREATE INDEX "LeadProduct_leadId_idx" ON "LeadProduct"("leadId");
CREATE INDEX "LeadProduct_productId_idx" ON "LeadProduct"("productId");

ALTER TABLE "LeadProduct" ADD CONSTRAINT "LeadProduct_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadProduct" ADD CONSTRAINT "LeadProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
