import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { canAccessOrder } from "@/lib/sales-orders";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { customerCode: true, businessName: true, buyerName: true, mobile: true, email: true, assignedSalesExecutiveId: true } },
      quotation: { select: { quotationNumber: true, acceptedAt: true } },
      assignedSalesExecutive: { select: { firstName: true, lastName: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      reservations: { include: { warehouse: { select: { name: true, code: true } }, product: { select: { name: true, sku: true } } }, orderBy: { createdAt: "desc" } },
      pickingList: { include: { items: true } },
      packingRecords: { include: { packages: { include: { items: { include: { salesOrderItem: true } } } } } },
      dispatches: { include: { items: true, invoice: { select: { id: true, invoiceNumber: true, status: true } }, deliveryEvents: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } },
      events: { include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!order || !canAccessOrder(user, order)) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  return NextResponse.json(order);
}
