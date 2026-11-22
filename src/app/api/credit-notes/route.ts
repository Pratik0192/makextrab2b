import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { createCreditNoteDraft } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can access billing records." }, { status: 403 }); const p = request.nextUrl.searchParams; const page = Math.max(1, Number(p.get("page") || 1)); const pageSize = [10, 20, 50, 100].includes(Number(p.get("pageSize"))) ? Number(p.get("pageSize")) : 20; const q = p.get("q")?.trim().slice(0, 100);
  const where: Prisma.CreditNoteWhereInput = { ...(p.get("status") ? { status: p.get("status") as never } : {}), ...(q ? { OR: [{ creditNoteNumber: { contains: q, mode: "insensitive" } }, { invoice: { invoiceNumber: { contains: q, mode: "insensitive" } } }] } : {}) };
  const [items, total] = await Promise.all([prisma.creditNote.findMany({ where, include: { invoice: { select: { invoiceNumber: true, customer: { select: { businessName: true } }, salesOrder: { select: { orderNumber: true } } } }, createdBy: { select: { firstName: true, lastName: true } }, issuedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.creditNote.count({ where })]); return NextResponse.json({ items, total, page, pageSize });
}
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can create credit notes." }, { status: 403 });
  try { const body = await request.json(); const item = await createCreditNoteDraft(String(body.invoiceId ?? ""), body, user.id); return NextResponse.json({ item }, { status: 201 }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Credit note draft creation failed." }, { status: 400 }); }
}
