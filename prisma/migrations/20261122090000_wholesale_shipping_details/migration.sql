ALTER TABLE "Lead"
  ADD COLUMN "deliveryCity" TEXT,
  ADD COLUMN "deliveryState" TEXT,
  ADD COLUMN "deliveryPincode" TEXT,
  ADD COLUMN "deliveryContactName" TEXT,
  ADD COLUMN "deliveryContactPhone" TEXT;

ALTER TABLE "Customer"
  ADD COLUMN "deliveryCity" TEXT,
  ADD COLUMN "deliveryState" TEXT,
  ADD COLUMN "deliveryPincode" TEXT,
  ADD COLUMN "deliveryContactName" TEXT,
  ADD COLUMN "deliveryContactPhone" TEXT;

ALTER TABLE "SalesOrder"
  ADD COLUMN "deliveryCity" TEXT,
  ADD COLUMN "deliveryState" TEXT,
  ADD COLUMN "deliveryPincode" TEXT,
  ADD COLUMN "deliveryContactName" TEXT,
  ADD COLUMN "deliveryContactPhone" TEXT;
