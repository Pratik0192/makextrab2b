import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { canViewInvoice, updateInvoiceDraft } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const invoice = await prisma.invoice.findUnique({ where: { id }, include: { customer: true, salesOrder: { include: { customer: true, quotation: { select: { quotationNumber: true } } } }, dispatch: true, items: true, documents: { include: { generatedBy: { select: { firstName: true, lastName: true } } }, orderBy: { version: "asc" } }, createdBy: { select: { firstName: true, lastName: true } }, issuedBy: { select: { firstName: true, lastName: true } }, events: { include: { actor: { select: { firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: "asc" } }, payments: { include: { recordedBy: { select: { firstName: true, lastName: true } }, events: { include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { paymentDate: "asc" } }, creditNotes: { include: { items: true, issuedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!invoice || !canViewInvoice(user, invoice)) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (["ISSUED", "CREDIT_NOTED"].includes(invoice.status) && invoice.dueDate && invoice.dueDate < new Date() && invoice.outstandingAmount.gt(0) && invoice.paymentStatus !== "OVERDUE") await prisma.invoice.update({ where: { id }, data: { paymentStatus: "OVERDUE", events: { create: { actorId: user.id, action: "MARKED_OVERDUE" } } } });
  return NextResponse.json({ item: invoice });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can edit a draft invoice." }, { status: 403 });
  const { id } = await params;
  try { const body = await request.json(); const item = await updateInvoiceDraft(id, { treatment: body.treatment, charges: body.charges, dueDate: body.dueDate }, user.id); return NextResponse.json({ item }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Draft update failed." }, { status: 400 }); }
}
