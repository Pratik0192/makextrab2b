import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

function parse(body: any) {
  if (!body || typeof body !== "object") throw new Error("HSN/SAC details must be an object.");
  const code = typeof body.code === "string" ? body.code.trim() : ""; const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!/^\d{4,8}$/.test(code)) throw new Error("Use a 4 to 8 digit HSN/SAC code. This format check is not official code verification.");
  if (!description || description.length > 300) throw new Error("Enter a description of up to 300 characters.");
  const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : null; const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
  if (effectiveFrom && !Number.isFinite(effectiveFrom.getTime()) || effectiveTo && !Number.isFinite(effectiveTo.getTime()) || effectiveFrom && effectiveTo && effectiveTo <= effectiveFrom) throw new Error("Effective dates are invalid.");
  return { code, description, gstRateId: typeof body.gstRateId === "string" && body.gstRateId ? body.gstRateId : null, unitOfMeasure: typeof body.unitOfMeasure === "string" ? body.unitOfMeasure.trim().slice(0, 40) || null : null, effectiveFrom, effectiveTo, isActive: body.isActive !== false };
}

export async function GET(request: NextRequest) { const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; return NextResponse.json({ items: await prisma.hsnSac.findMany({ include: { gstRate: true }, orderBy: { code: "asc" } }) }); }
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  try { const data = parse(await request.json()); if (data.gstRateId && !await prisma.gstTaxRate.findFirst({ where: { id: data.gstRateId, isActive: true } })) throw new Error("Selected GST rate is not active."); const item = await prisma.hsnSac.create({ data }); await auditBilling(auth.id, "HSN_SAC", item.id, "CREATED", data as Prisma.InputJsonValue); return NextResponse.json(item, { status: 201 }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "This HSN/SAC code already exists." }, { status: 409 }); return NextResponse.json({ error: error instanceof Error ? error.message : "HSN/SAC could not be created." }, { status: 400 }); }
}
