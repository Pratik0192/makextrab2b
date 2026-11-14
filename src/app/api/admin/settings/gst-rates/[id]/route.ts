import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params;
  const prior = await prisma.gstTaxRate.findUnique({ where: { id } }); if (!prior) return NextResponse.json({ error: "Tax rate not found." }, { status: 404 });
  const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const rates = await import("@/lib/billing-config");
    const cgstPercent = rates.parsePercent((body as any).cgstPercent ?? prior.cgstPercent.toString(), "CGST"); const sgstPercent = rates.parsePercent((body as any).sgstPercent ?? prior.sgstPercent.toString(), "SGST"); const igstPercent = rates.parsePercent((body as any).igstPercent ?? prior.igstPercent.toString(), "IGST"); const cessPercent = rates.parsePercent((body as any).cessPercent ?? prior.cessPercent.toString(), "Cess");
    if (!cgstPercent.plus(sgstPercent).equals(igstPercent)) throw new Error("CGST plus SGST must equal the configured IGST rate.");
    const effectiveFrom = body && (body as any).effectiveFrom ? new Date((body as any).effectiveFrom) : prior.effectiveFrom; const effectiveTo = body && "effectiveTo" in body ? ((body as any).effectiveTo ? new Date((body as any).effectiveTo) : null) : prior.effectiveTo;
    if (!Number.isFinite(effectiveFrom.getTime()) || effectiveTo && (!Number.isFinite(effectiveTo.getTime()) || effectiveTo <= effectiveFrom)) throw new Error("Effective dates are invalid.");
    const overlap = await prisma.gstTaxRate.findFirst({ where: { id: { not: id }, code: prior.code, effectiveFrom: { lte: effectiveTo ?? new Date("9999-12-31T23:59:59.999Z") }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }] }, select: { id: true } });
    if (overlap) throw new Error("This rate code overlaps another effective period.");
    const data = { cgstPercent, sgstPercent, igstPercent, cessPercent, effectiveFrom, effectiveTo, ...(typeof (body as any).name === "string" ? { name: (body as any).name.trim().slice(0, 120) } : {}), ...(typeof (body as any).taxInclusive === "boolean" ? { taxInclusive: (body as any).taxInclusive } : {}), ...(typeof (body as any).isActive === "boolean" ? { isActive: (body as any).isActive } : {}) };
    const updated = await prisma.gstTaxRate.update({ where: { id }, data }); await auditBilling(auth.id, "GST_RATE", id, "UPDATED", data as Prisma.InputJsonValue); return NextResponse.json(updated);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "GST rate could not be updated." }, { status: 400 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params;
  const item = await prisma.gstTaxRate.update({ where: { id }, data: { isActive: false } }); await auditBilling(auth.id, "GST_RATE", id, "DEACTIVATED"); return NextResponse.json({ success: true, item });
}
