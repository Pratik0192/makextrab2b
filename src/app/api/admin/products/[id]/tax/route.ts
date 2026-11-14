import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, sku: true, name: true, hsnSacId: true, gstRateId: true, taxInclusive: true, taxUom: true, hsnSac: true, gstRate: true } }); if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 }); return NextResponse.json({ product });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params;
  try { const body = await request.json(); const product = await prisma.product.findUnique({ where: { id }, select: { id: true } }); if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const hsnSacId = typeof body.hsnSacId === "string" && body.hsnSacId ? body.hsnSacId : null; const gstRateId = typeof body.gstRateId === "string" && body.gstRateId ? body.gstRateId : null;
    if (hsnSacId && !await prisma.hsnSac.findFirst({ where: { id: hsnSacId, isActive: true } })) throw new Error("Selected HSN/SAC entry is not active.");
    if (gstRateId && !await prisma.gstTaxRate.findFirst({ where: { id: gstRateId, isActive: true, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] } })) throw new Error("Selected GST rate is not currently effective.");
    const data = { hsnSacId, gstRateId, ...(typeof body.taxInclusive === "boolean" ? { taxInclusive: body.taxInclusive } : {}), ...(typeof body.taxUom === "string" || body.taxUom === null ? { taxUom: typeof body.taxUom === "string" ? body.taxUom.trim().slice(0, 40) || null : null } : {}) };
    const updated = await prisma.product.update({ where: { id }, data, select: { id: true, name: true, sku: true, hsnSacId: true, gstRateId: true, taxInclusive: true, taxUom: true } }); await auditBilling(auth.id, "PRODUCT_TAX", id, "MAPPING_UPDATED", data as any); return NextResponse.json({ product: updated });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tax mapping could not be updated." }, { status: 400 }); }
}
