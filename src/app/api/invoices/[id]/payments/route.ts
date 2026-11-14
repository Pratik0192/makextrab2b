import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { canViewInvoice, recordInvoicePayment } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can record payments." }, { status: 403 });
  try { const body = await request.json(); const { id } = await params; const item = await recordInvoicePayment(id, body, user.id); return NextResponse.json({ item }, { status: 201 }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Payment recording failed." }, { status: 400 }); }
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { salesOrder: { include: { customer: true } } } }); if (!invoice || !canViewInvoice(user, invoice)) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  const items = await prisma.invoicePayment.findMany({ where: { invoiceId: id }, include: { recordedBy: { select: { firstName: true, lastName: true } }, reversedBy: { select: { firstName: true, lastName: true } }, events: { include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { paymentDate: "asc" } }); return NextResponse.json({ items });
}
