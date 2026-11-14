import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling, parsePercent } from "@/lib/billing-config";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

function parse(body: any) {
  if (!body || typeof body !== "object") throw new Error("Tax rate details must be an object.");
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : ""; const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!/^[A-Z0-9_-]{2,32}$/.test(code) || !name || name.length > 120) throw new Error("Provide a rate code and name.");
  const cgstPercent = parsePercent(body.cgstPercent, "CGST"); const sgstPercent = parsePercent(body.sgstPercent, "SGST"); const igstPercent = parsePercent(body.igstPercent, "IGST"); const cessPercent = parsePercent(body.cessPercent ?? 0, "Cess");
  if (!cgstPercent.plus(sgstPercent).equals(igstPercent)) throw new Error("CGST plus SGST must equal the configured IGST rate.");
  const effectiveFrom = new Date(body.effectiveFrom); const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
  if (!Number.isFinite(effectiveFrom.getTime()) || effectiveTo && (!Number.isFinite(effectiveTo.getTime()) || effectiveTo <= effectiveFrom)) throw new Error("Effective dates are invalid.");
  return { code, name, cgstPercent, sgstPercent, igstPercent, cessPercent, taxInclusive: body.taxInclusive === true, effectiveFrom, effectiveTo, isActive: body.isActive !== false };
}

export async function GET(request: NextRequest) { const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; return NextResponse.json({ items: await prisma.gstTaxRate.findMany({ orderBy: [{ effectiveFrom: "desc" }, { code: "asc" }] }) }); }
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  try { const data = parse(await request.json()); const overlap = await prisma.gstTaxRate.findFirst({ where: { code: data.code, effectiveFrom: { lte: data.effectiveTo ?? new Date("9999-12-31T23:59:59.999Z") }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: data.effectiveFrom } }] }, select: { id: true } }); if (overlap) throw new Error("This rate code overlaps an existing effective period."); const item = await prisma.gstTaxRate.create({ data }); await auditBilling(auth.id, "GST_RATE", item.id, "CREATED", data as Prisma.InputJsonValue); return NextResponse.json(item, { status: 201 }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "A rate with this code and effective-from date already exists." }, { status: 409 }); return NextResponse.json({ error: error instanceof Error ? error.message : "GST rate could not be created." }, { status: 400 }); }
}
