-- Add new enum values in separate migrations before they are used.
ALTER TYPE "LeadPriority" ADD VALUE 'MEDIUM' BEFORE 'NORMAL';

-- CreateTable
CREATE TABLE "LeadTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTagAssignment" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTagAssignment_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadTag_normalizedName_key" ON "LeadTag"("normalizedName");

-- CreateIndex
CREATE INDEX "LeadTagAssignment_tagId_leadId_idx" ON "LeadTagAssignment"("tagId", "leadId");

-- CreateIndex
CREATE INDEX "Lead_priority_createdAt_idx" ON "Lead"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_state_city_createdAt_idx" ON "Lead"("state", "city", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_lastContactAt_idx" ON "Lead"("lastContactAt");

-- AddForeignKey
ALTER TABLE "LeadTagAssignment" ADD CONSTRAINT "LeadTagAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTagAssignment" ADD CONSTRAINT "LeadTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "LeadTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

