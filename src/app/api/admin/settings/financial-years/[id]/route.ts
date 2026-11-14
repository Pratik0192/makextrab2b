import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params; const body = await request.json().catch(() => null); if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const current = await prisma.financialYear.findUnique({ where: { id } }); if (!current) return NextResponse.json({ error: "Financial year not found." }, { status: 404 });
  const issuedNumbering = await prisma.documentNumberingConfig.findFirst({ where: { financialYearId: id, currentSequence: { gte: 1 } }, select: { id: true } });
  const name = typeof (body as any).name === "string" ? (body as any).name.trim() : current.name; const startDate = (body as any).startDate ? new Date((body as any).startDate) : current.startDate; const endDate = (body as any).endDate ? new Date((body as any).endDate) : current.endDate; const activate = (body as any).isActive === true;
  if (!name || name.length > 40 || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return NextResponse.json({ error: "Financial year dates are invalid." }, { status: 400 });
  if (issuedNumbering && (name !== current.name || startDate.getTime() !== current.startDate.getTime() || endDate.getTime() !== current.endDate.getTime())) return NextResponse.json({ error: "A financial year with issued numbers cannot be renamed or have its dates changed." }, { status: 409 });
  try { const result = await prisma.$transaction(async (tx) => { const overlap = await tx.financialYear.findFirst({ where: { id: { not: id }, startDate: { lte: endDate }, endDate: { gte: startDate } } }); if (overlap) throw new Error(`Date range overlaps financial year ${overlap.name}.`); if (activate) await tx.financialYear.updateMany({ where: { isActive: true, id: { not: id } }, data: { isActive: false } }); const updated = await tx.financialYear.update({ where: { id }, data: { name, startDate, endDate, ...(typeof (body as any).isActive === "boolean" ? { isActive: (body as any).isActive } : {}) } }); await tx.billingAuditEvent.create({ data: { entity: "FINANCIAL_YEAR", entityId: id, action: "UPDATED", actorId: auth.id, changes: body as any } }); return updated; }, { isolationLevel: "Serializable" }); return NextResponse.json(result); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Financial year could not be updated." }, { status: 409 }); }
}
