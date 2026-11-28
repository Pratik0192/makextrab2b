-- Allow direct customer orders and invoices while preserving historical quotation links.
ALTER TABLE "SalesOrder" ALTER COLUMN "quotationId" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "quotationId" DROP NOT NULL;
