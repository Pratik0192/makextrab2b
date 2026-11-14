-- CreateEnum
CREATE TYPE "BuyerApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFORMATION_REQUESTED');

-- CreateEnum
CREATE TYPE "LeadDocumentType" AS ENUM ('GST_CERTIFICATE', 'TRADE_LICENCE', 'BUSINESS_PROOF', 'PAN', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentScanStatus" AS ENUM ('NOT_SCANNED', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "DocumentUploaderType" AS ENUM ('VISITOR', 'STAFF');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('PHONE_CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'NOTE', 'ASSIGNMENT', 'STAGE_CHANGE', 'VERIFICATION_UPDATE', 'DOCUMENT_UPLOAD', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "VerificationCheckType" AS ENUM ('BUSINESS_DETAILS', 'CONTACT_DETAILS', 'GST_CERTIFICATE', 'GSTIN', 'BUSINESS_LEGITIMACY');

-- CreateEnum
CREATE TYPE "VerificationItemStatus" AS ENUM ('PENDING', 'VERIFIED', 'NEEDS_MORE_INFORMATION', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStage" ADD VALUE 'ASSIGNED';
ALTER TYPE "LeadStage" ADD VALUE 'CONTACT_ATTEMPTED';
ALTER TYPE "LeadStage" ADD VALUE 'VERIFICATION_PENDING';
ALTER TYPE "LeadStage" ADD VALUE 'QUOTATION_ORDER_DISCUSSION';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" UUID,
ADD COLUMN     "assignedToId" UUID,
ADD COLUMN     "buyerApprovalReason" TEXT,
ADD COLUMN     "buyerApprovalStatus" "BuyerApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "buyerApprovedAt" TIMESTAMP(3),
ADD COLUMN     "buyerApprovedById" UUID,
ADD COLUMN     "lastContactAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "activationTokenHash" TEXT;

-- CreateTable
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedToId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "previousAssigneeId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "activityType" "LeadActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "outcome" TEXT,
    "contactMade" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadDocument" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "documentType" "LeadDocumentType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "providerFileId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "uploadedByType" "DocumentUploaderType" NOT NULL,
    "uploadedByUserId" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadVerificationCheck" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "checkType" "VerificationCheckType" NOT NULL,
    "status" "VerificationItemStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadVerificationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFollowUp" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedToId" UUID NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadAssignment_leadId_createdAt_idx" ON "LeadAssignment"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadAssignment_assignedToId_createdAt_idx" ON "LeadAssignment"("assignedToId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadDocument_providerFileId_key" ON "LeadDocument"("providerFileId");

-- CreateIndex
CREATE INDEX "LeadDocument_leadId_uploadedAt_idx" ON "LeadDocument"("leadId", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadVerificationCheck_leadId_checkType_key" ON "LeadVerificationCheck"("leadId", "checkType");

-- CreateIndex
CREATE INDEX "LeadFollowUp_assignedToId_status_dueAt_idx" ON "LeadFollowUp"("assignedToId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "LeadFollowUp_leadId_dueAt_idx" ON "LeadFollowUp"("leadId", "dueAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_stage_createdAt_idx" ON "Lead"("assignedToId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_buyerApprovalStatus_idx" ON "Lead"("buyerApprovalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "User_activationTokenHash_key" ON "User"("activationTokenHash");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_previousAssigneeId_fkey" FOREIGN KEY ("previousAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadVerificationCheck" ADD CONSTRAINT "LeadVerificationCheck_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadVerificationCheck" ADD CONSTRAINT "LeadVerificationCheck_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

