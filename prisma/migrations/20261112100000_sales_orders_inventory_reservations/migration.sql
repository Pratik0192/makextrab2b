CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'CONFIRMED', 'ON_HOLD', 'REJECTED', 'CANCELLED');
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'RELEASED', 'SHORTAGE');

CREATE SEQUENCE sales_order_number_seq START 1 INCREMENT 1;

CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "assignedSalesExecutiveId" UUID,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryAddress" TEXT,
    "deliveryInstructions" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesOrder_orderNumber_key" ON "SalesOrder"("orderNumber");
CREATE UNIQUE INDEX "SalesOrder_quotationId_key" ON "SalesOrder"("quotationId");
CREATE INDEX "SalesOrder_status_orderDate_idx" ON "SalesOrder"("status", "orderDate");
CREATE INDEX "SalesOrder_customerId_orderDate_idx" ON "SalesOrder"("customerId", "orderDate");
CREATE INDEX "SalesOrder_assignedSalesExecutiveId_orderDate_idx" ON "SalesOrder"("assignedSalesExecutiveId", "orderDate");
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_assignedSalesExecutiveId_fkey" FOREIGN KEY ("assignedSalesExecutiveId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "productId" TEXT,
    "productNameSnapshot" TEXT NOT NULL, "skuSnapshot" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL, "catalogUnitPriceSnapshot" DECIMAL(12,2),
    "discount" DECIMAL(12,2) NOT NULL, "taxRate" DECIMAL(5,2) NOT NULL, "taxAmount" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL, CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");
CREATE INDEX "SalesOrderItem_productId_idx" ON "SalesOrderItem"("productId");
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SalesOrderEvent" (
    "id" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "actorId" UUID NOT NULL, "action" TEXT NOT NULL,
    "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesOrderEvent_salesOrderId_createdAt_idx" ON "SalesOrderEvent"("salesOrderId", "createdAt");
CREATE INDEX "SalesOrderEvent_actorId_createdAt_idx" ON "SalesOrderEvent"("actorId", "createdAt");
ALTER TABLE "SalesOrderEvent" ADD CONSTRAINT "SalesOrderEvent_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderEvent" ADD CONSTRAINT "SalesOrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SalesOrderReservation" (
    "id" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "salesOrderItemId" TEXT NOT NULL, "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "status" "ReservationStatus" NOT NULL,
    "availableAtCheck" INTEGER, "shortageQuantity" INTEGER, "createdById" UUID NOT NULL, "releasedById" UUID,
    "releaseReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "releasedAt" TIMESTAMP(3),
    CONSTRAINT "SalesOrderReservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesOrderReservation_salesOrderId_status_idx" ON "SalesOrderReservation"("salesOrderId", "status");
CREATE INDEX "SalesOrderReservation_salesOrderItemId_status_idx" ON "SalesOrderReservation"("salesOrderItemId", "status");
CREATE INDEX "SalesOrderReservation_productId_warehouseId_status_idx" ON "SalesOrderReservation"("productId", "warehouseId", "status");
ALTER TABLE "SalesOrderReservation" ADD CONSTRAINT "SalesOrderReservation_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderReservation" ADD CONSTRAINT "SalesOrderReservation_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderReservation" ADD CONSTRAINT "SalesOrderReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderReservation" ADD CONSTRAINT "SalesOrderReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderReservation" ADD CONSTRAINT "SalesOrderReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderReservation" ADD CONSTRAINT "SalesOrderReservation_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
