import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params; const existing = await prisma.hsnSac.findUnique({ where: { id } }); if (!existing) return NextResponse.json({ error: "HSN/SAC not found." }, { status: 404 });
  try {
    const body = await request.json(); if (!body || typeof body !== "object") throw new Error("Invalid HSN/SAC details.");
    const date = (value: unknown, prior: Date | null) => value === undefined ? prior : value === null || value === "" ? null : new Date(String(value));
    const data = { code: typeof body.code === "string" ? body.code.trim() : existing.code, description: typeof body.description === "string" ? body.description.trim().slice(0, 300) : existing.description, gstRateId: typeof body.gstRateId === "string" ? body.gstRateId || null : existing.gstRateId, unitOfMeasure: typeof body.unitOfMeasure === "string" ? body.unitOfMeasure.trim().slice(0, 40) || null : existing.unitOfMeasure, effectiveFrom: date(body.effectiveFrom, existing.effectiveFrom), effectiveTo: date(body.effectiveTo, existing.effectiveTo), ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}) };
    if (!/^\d{4,8}$/.test(data.code) || !data.description || data.effectiveFrom && !Number.isFinite(data.effectiveFrom.getTime()) || data.effectiveTo && !Number.isFinite(data.effectiveTo.getTime()) || data.effectiveFrom && data.effectiveTo && data.effectiveTo <= data.effectiveFrom) throw new Error("HSN/SAC fields or effective dates are invalid.");
    if (data.gstRateId && !await prisma.gstTaxRate.findFirst({ where: { id: data.gstRateId, isActive: true } })) throw new Error("Selected GST rate is not active.");
    const updated = await prisma.hsnSac.update({ where: { id }, data }); await auditBilling(auth.id, "HSN_SAC", id, "UPDATED", data as any); return NextResponse.json(updated);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "HSN/SAC could not be updated." }, { status: 400 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params; const item = await prisma.hsnSac.update({ where: { id }, data: { isActive: false } }); await auditBilling(auth.id, "HSN_SAC", id, "DEACTIVATED"); return NextResponse.json({ success: true, item }); }
