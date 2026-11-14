CREATE TYPE "DuplicateReviewStatus" AS ENUM ('PENDING', 'CONFIRMED_DUPLICATE', 'DISMISSED');
CREATE TYPE "DuplicateMatchConfidence" AS ENUM ('HIGH', 'POSSIBLE');
CREATE TYPE "LeadLostReason" AS ENUM ('PRICE_TOO_HIGH', 'COMPETITOR_SELECTED', 'NO_RESPONSE', 'REQUIREMENT_CANCELLED', 'PAYMENT_ISSUE', 'PRODUCT_UNAVAILABLE', 'BUYER_NOT_INTERESTED', 'BUSINESS_NOT_VERIFIED', 'DUPLICATE_LEAD', 'OTHER');

ALTER TABLE "LeadActivity" ALTER COLUMN "createdById" DROP NOT NULL;

ALTER TABLE "Lead"
  ADD COLUMN "mergedIntoLeadId" TEXT,
  ADD COLUMN "mergedAt" TIMESTAMP(3),
  ADD COLUMN "mergedById" UUID,
  ADD COLUMN "mergeSnapshot" JSONB;

CREATE TABLE "LeadDuplicateMatch" (
  "id" TEXT NOT NULL,
  "leadAId" TEXT NOT NULL,
  "leadBId" TEXT NOT NULL,
  "reasons" TEXT[] NOT NULL,
  "confidence" "DuplicateMatchConfidence" NOT NULL,
  "status" "DuplicateReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadDuplicateMatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadDuplicateMatch_unordered_pair_check" CHECK ("leadAId" < "leadBId")
);

CREATE TABLE "LeadLostHistory" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "reason" "LeadLostReason" NOT NULL,
  "notes" TEXT,
  "competitorName" TEXT,
  "priceObjection" TEXT,
  "lostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lostById" UUID NOT NULL,
  "reactivationDueAt" TIMESTAMP(3),
  "reactivatedAt" TIMESTAMP(3),
  "reactivatedById" UUID,
  "reactivationNote" TEXT,
  "reactivationStage" "LeadStage",
  "reactivationFollowUpId" TEXT,
  CONSTRAINT "LeadLostHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadDuplicateMatch_leadAId_leadBId_key" ON "LeadDuplicateMatch"("leadAId", "leadBId");
CREATE INDEX "LeadDuplicateMatch_leadAId_status_idx" ON "LeadDuplicateMatch"("leadAId", "status");
CREATE INDEX "LeadDuplicateMatch_leadBId_status_idx" ON "LeadDuplicateMatch"("leadBId", "status");
CREATE INDEX "LeadDuplicateMatch_status_createdAt_idx" ON "LeadDuplicateMatch"("status", "createdAt");
CREATE INDEX "LeadLostHistory_leadId_lostAt_idx" ON "LeadLostHistory"("leadId", "lostAt");
CREATE INDEX "LeadLostHistory_reason_lostAt_idx" ON "LeadLostHistory"("reason", "lostAt");
CREATE INDEX "LeadLostHistory_reactivationDueAt_reactivatedAt_idx" ON "LeadLostHistory"("reactivationDueAt", "reactivatedAt");
CREATE INDEX "Lead_mergedIntoLeadId_idx" ON "Lead"("mergedIntoLeadId");

ALTER TABLE "LeadDuplicateMatch" ADD CONSTRAINT "LeadDuplicateMatch_leadAId_fkey" FOREIGN KEY ("leadAId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadDuplicateMatch" ADD CONSTRAINT "LeadDuplicateMatch_leadBId_fkey" FOREIGN KEY ("leadBId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadLostHistory" ADD CONSTRAINT "LeadLostHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_mergedIntoLeadId_fkey" FOREIGN KEY ("mergedIntoLeadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
