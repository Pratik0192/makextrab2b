import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) { const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; return NextResponse.json({ items: await prisma.chargeConfiguration.findMany({ orderBy: { label: "asc" } }) }); }
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  try { const body = await request.json(); const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : ""; const label = typeof body.label === "string" ? body.label.trim() : ""; if (!/^[A-Z0-9_-]{2,32}$/.test(code) || !label || label.length > 80) throw new Error("Provide a valid code and charge label."); const taxRateId = typeof body.taxRateId === "string" && body.taxRateId ? body.taxRateId : null; if (body.isTaxable === true && (!taxRateId || !await prisma.gstTaxRate.findFirst({ where: { id: taxRateId, isActive: true } }))) throw new Error("Select an active GST rate for a taxable charge."); const data = { code, label, taxRateId, isTaxable: body.isTaxable === true, taxInclusive: body.taxInclusive === true, isActive: body.isActive !== false }; const item = await prisma.chargeConfiguration.create({ data }); await auditBilling(auth.id, "CHARGE_CONFIG", item.id, "CREATED", data as Prisma.InputJsonValue); return NextResponse.json(item, { status: 201 }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "This charge code already exists." }, { status: 409 }); return NextResponse.json({ error: error instanceof Error ? error.message : "Charge configuration failed." }, { status: 400 }); }
}
