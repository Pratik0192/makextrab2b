CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CREDIT_NOTED', 'CANCELLED');
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER');
CREATE TYPE "PaymentRecordStatus" AS ENUM ('RECORDED', 'REVERSED');
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL, "invoiceNumber" TEXT, "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "paymentStatus" "InvoicePaymentStatus" NOT NULL DEFAULT 'UNPAID', "invoiceDate" TIMESTAMP(3), "dueDate" TIMESTAMP(3),
  "customerId" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "quotationId" TEXT NOT NULL, "dispatchId" TEXT NOT NULL,
  "financialYearId" TEXT, "numberingConfigId" TEXT, "createdById" UUID NOT NULL, "issuedById" UUID,
  "issuedAt" TIMESTAMP(3), "cancelledById" UUID, "cancelledAt" TIMESTAMP(3), "cancellationReason" TEXT,
  "supplyTreatment" TEXT NOT NULL, "placeOfSupply" TEXT, "stateCode" TEXT, "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
  "companySnapshot" JSONB NOT NULL, "customerSnapshot" JSONB NOT NULL, "shippingSnapshot" JSONB NOT NULL, "chargesSnapshot" JSONB NOT NULL,
  "taxableSubtotal" DECIMAL(14,2) NOT NULL, "cgstTotal" DECIMAL(14,2) NOT NULL, "sgstTotal" DECIMAL(14,2) NOT NULL,
  "igstTotal" DECIMAL(14,2) NOT NULL, "cessTotal" DECIMAL(14,2) NOT NULL, "freightTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "packingTotal" DECIMAL(14,2) NOT NULL DEFAULT 0, "otherChargesTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0, "roundOff" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(14,2) NOT NULL, "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amountCredited" DECIMAL(14,2) NOT NULL DEFAULT 0, "outstandingAmount" DECIMAL(14,2) NOT NULL,
  "pdfProviderFileId" TEXT, "pdfGeneratedAt" TIMESTAMP(3), "pdfVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_dispatchId_key" ON "Invoice"("dispatchId");
CREATE INDEX "Invoice_customerId_invoiceDate_idx" ON "Invoice"("customerId", "invoiceDate");
CREATE INDEX "Invoice_salesOrderId_createdAt_idx" ON "Invoice"("salesOrderId", "createdAt");
CREATE INDEX "Invoice_status_paymentStatus_invoiceDate_idx" ON "Invoice"("status", "paymentStatus", "invoiceDate");
CREATE INDEX "Invoice_dueDate_paymentStatus_idx" ON "Invoice"("dueDate", "paymentStatus");
CREATE INDEX "Invoice_createdById_createdAt_idx" ON "Invoice"("createdById", "createdAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_numberingConfigId_fkey" FOREIGN KEY ("numberingConfigId") REFERENCES "DocumentNumberingConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "salesOrderItemId" TEXT, "productId" TEXT,
  "productName" TEXT NOT NULL, "sku" TEXT NOT NULL, "description" TEXT, "hsnSacCode" TEXT NOT NULL, "uom" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(14,4) NOT NULL, "catalogPriceSnapshot" DECIMAL(14,4),
  "quotedPriceSnapshot" DECIMAL(14,4) NOT NULL, "lineDiscount" DECIMAL(14,2) NOT NULL, "taxableValue" DECIMAL(14,2) NOT NULL,
  "gstRateCode" TEXT NOT NULL, "gstRateSnapshot" DECIMAL(5,2) NOT NULL, "cgstPercent" DECIMAL(5,2) NOT NULL,
  "cgstAmount" DECIMAL(14,2) NOT NULL, "sgstPercent" DECIMAL(5,2) NOT NULL, "sgstAmount" DECIMAL(14,2) NOT NULL,
  "igstPercent" DECIMAL(5,2) NOT NULL, "igstAmount" DECIMAL(14,2) NOT NULL, "cessPercent" DECIMAL(5,2) NOT NULL,
  "cessAmount" DECIMAL(14,2) NOT NULL, "taxInclusive" BOOLEAN NOT NULL DEFAULT false, "lineTotal" DECIMAL(14,2) NOT NULL,
  "taxSnapshot" JSONB NOT NULL, CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InvoiceEvent" (
  "id" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "actorId" UUID NOT NULL, "action" TEXT NOT NULL,
  "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceEvent_invoiceId_createdAt_idx" ON "InvoiceEvent"("invoiceId", "createdAt");
CREATE INDEX "InvoiceEvent_actorId_createdAt_idx" ON "InvoiceEvent"("actorId", "createdAt");
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InvoicePayment" (
  "id" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "paymentDate" TIMESTAMP(3) NOT NULL,
  "mode" "PaymentMode" NOT NULL, "transactionReference" TEXT, "bankDetails" TEXT, "remarks" TEXT,
  "status" "PaymentRecordStatus" NOT NULL DEFAULT 'RECORDED', "idempotencyKey" TEXT NOT NULL,
  "recordedById" UUID NOT NULL, "reversedById" UUID, "reversedAt" TIMESTAMP(3), "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoicePayment_idempotencyKey_key" ON "InvoicePayment"("idempotencyKey");
CREATE INDEX "InvoicePayment_invoiceId_paymentDate_idx" ON "InvoicePayment"("invoiceId", "paymentDate");
CREATE INDEX "InvoicePayment_recordedById_createdAt_idx" ON "InvoicePayment"("recordedById", "createdAt");
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InvoicePaymentEvent" (
  "id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "actorId" UUID NOT NULL, "action" TEXT NOT NULL,
  "reason" TEXT, "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoicePaymentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoicePaymentEvent_paymentId_createdAt_idx" ON "InvoicePaymentEvent"("paymentId", "createdAt");
ALTER TABLE "InvoicePaymentEvent" ADD CONSTRAINT "InvoicePaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "InvoicePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoicePaymentEvent" ADD CONSTRAINT "InvoicePaymentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CreditNote" (
  "id" TEXT NOT NULL, "creditNoteNumber" TEXT, "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "invoiceId" TEXT NOT NULL, "financialYearId" TEXT, "numberingConfigId" TEXT, "reason" TEXT NOT NULL, "notes" TEXT,
  "issueDate" TIMESTAMP(3), "subtotal" DECIMAL(14,2) NOT NULL, "cgstTotal" DECIMAL(14,2) NOT NULL,
  "sgstTotal" DECIMAL(14,2) NOT NULL, "igstTotal" DECIMAL(14,2) NOT NULL, "cessTotal" DECIMAL(14,2) NOT NULL,
  "grandTotal" DECIMAL(14,2) NOT NULL, "createdById" UUID NOT NULL, "issuedById" UUID, "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");
CREATE INDEX "CreditNote_invoiceId_createdAt_idx" ON "CreditNote"("invoiceId", "createdAt");
CREATE INDEX "CreditNote_status_issueDate_idx" ON "CreditNote"("status", "issueDate");
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_numberingConfigId_fkey" FOREIGN KEY ("numberingConfigId") REFERENCES "DocumentNumberingConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CreditNoteItem" (
  "id" TEXT NOT NULL, "creditNoteId" TEXT NOT NULL, "invoiceItemId" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  "taxableValue" DECIMAL(14,2) NOT NULL, "cgstAmount" DECIMAL(14,2) NOT NULL, "sgstAmount" DECIMAL(14,2) NOT NULL,
  "igstAmount" DECIMAL(14,2) NOT NULL, "cessAmount" DECIMAL(14,2) NOT NULL, "totalAmount" DECIMAL(14,2) NOT NULL,
  "taxSnapshot" JSONB NOT NULL, CONSTRAINT "CreditNoteItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreditNoteItem_creditNoteId_idx" ON "CreditNoteItem"("creditNoteId");
CREATE INDEX "CreditNoteItem_invoiceItemId_idx" ON "CreditNoteItem"("invoiceItemId");
ALTER TABLE "CreditNoteItem" ADD CONSTRAINT "CreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNoteItem" ADD CONSTRAINT "CreditNoteItem_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CreditNoteEvent" (
  "id" TEXT NOT NULL, "creditNoteId" TEXT NOT NULL, "actorId" UUID NOT NULL, "action" TEXT NOT NULL,
  "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNoteEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreditNoteEvent_creditNoteId_createdAt_idx" ON "CreditNoteEvent"("creditNoteId", "createdAt");
ALTER TABLE "CreditNoteEvent" ADD CONSTRAINT "CreditNoteEvent_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNoteEvent" ADD CONSTRAINT "CreditNoteEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD COLUMN "customerCreditBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN "orderedQuantity" INTEGER NOT NULL, ADD COLUMN "dispatchedQuantity" INTEGER NOT NULL, ADD COLUMN "previouslyInvoicedQuantity" INTEGER NOT NULL, ADD COLUMN "invoiceableQuantity" INTEGER NOT NULL, ADD COLUMN "remainingQuantity" INTEGER NOT NULL;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "CreditNoteItem" ADD CONSTRAINT "CreditNoteItem_quantity_positive" CHECK ("quantity" > 0);
CREATE TABLE "InvoiceDocument" (
  "id" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "version" INTEGER NOT NULL, "providerFileId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf', "sizeBytes" INTEGER NOT NULL, "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedById" UUID NOT NULL, "reason" TEXT, CONSTRAINT "InvoiceDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceDocument_providerFileId_key" ON "InvoiceDocument"("providerFileId");
CREATE UNIQUE INDEX "InvoiceDocument_invoiceId_version_key" ON "InvoiceDocument"("invoiceId", "version");
CREATE INDEX "InvoiceDocument_generatedById_generatedAt_idx" ON "InvoiceDocument"("generatedById", "generatedAt");
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
