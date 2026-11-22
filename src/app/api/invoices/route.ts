import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { createInvoiceDraft } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can access invoice and balance records." }, { status: 403 });
  const p = request.nextUrl.searchParams; const page = Math.max(1, Number(p.get("page") || 1)); const pageSize = [10, 20, 50, 100].includes(Number(p.get("pageSize"))) ? Number(p.get("pageSize")) : 20; const q = p.get("q")?.trim().slice(0, 100); const sort = ["createdAt", "invoiceDate", "dueDate", "grandTotal"].includes(p.get("sort") ?? "") ? p.get("sort")! : "createdAt"; const direction = p.get("direction") === "asc" ? "asc" : "desc";
  const from = p.get("from") ? new Date(p.get("from")!) : null; const to = p.get("to") ? new Date(`${p.get("to")}T23:59:59.999Z`) : null; if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime()))) return NextResponse.json({ error: "Date filter is invalid." }, { status: 400 });
  const invoiceStatuses = ["DRAFT", "ISSUED", "CREDIT_NOTED", "CANCELLED"]; const paymentStatuses = ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"];
  const where: Prisma.InvoiceWhereInput = { ...(invoiceStatuses.includes(p.get("status") ?? "") ? { status: p.get("status") as never } : {}), ...(paymentStatuses.includes(p.get("paymentStatus") ?? "") ? { paymentStatus: p.get("paymentStatus") as never } : {}), ...(p.get("customerId") ? { customerId: p.get("customerId")! } : {}), ...(from || to ? { invoiceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}), ...(q ? { OR: [{ invoiceNumber: { contains: q, mode: "insensitive" } }, { salesOrder: { orderNumber: { contains: q, mode: "insensitive" } } }, { customer: { businessName: { contains: q, mode: "insensitive" } } }, { dispatch: { reference: { contains: q, mode: "insensitive" } } }] } : {}) };

  const [items, total] = await Promise.all([prisma.invoice.findMany({ where, include: { customer: { select: { businessName: true, customerCode: true } }, salesOrder: { select: { orderNumber: true } }, dispatch: { select: { reference: true } }, createdBy: { select: { firstName: true, lastName: true } } }, orderBy: { [sort]: direction } as never, skip: (page - 1) * pageSize, take: pageSize }), prisma.invoice.count({ where })]);
  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can create an invoice draft." }, { status: 403 });
  try { const body = await request.json(); if (!body || typeof body.dispatchId !== "string" || !["INTRA_STATE", "INTER_STATE"].includes(body.treatment)) throw new Error("Dispatch and authorized supply treatment are required."); const item = await createInvoiceDraft({ dispatchId: body.dispatchId, treatment: body.treatment, placeOfSupply: String(body.placeOfSupply ?? ""), stateCode: String(body.stateCode ?? ""), reverseCharge: body.reverseCharge === true, charges: Array.isArray(body.charges) ? body.charges : [], dueDate: body.dueDate ?? null }, user.id); return NextResponse.json({ item }, { status: 201 }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Invoice draft creation failed." }, { status: 400 }); }
}
