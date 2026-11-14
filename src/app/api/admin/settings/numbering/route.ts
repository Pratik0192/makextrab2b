import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

const types = ["TAX_INVOICE", "PROFORMA_INVOICE", "DELIVERY_CHALLAN", "CREDIT_NOTE", "DEBIT_NOTE"];
export async function GET(request: NextRequest) { const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; return NextResponse.json({ items: await prisma.documentNumberingConfig.findMany({ include: { financialYear: true }, orderBy: [{ financialYear: { startDate: "desc" } }, { documentType: "asc" }] }) }); }
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  try { const body = await request.json(); const documentType = String(body.documentType); const prefix = typeof body.prefix === "string" ? body.prefix.trim() : ""; const startingSequence = Number(body.startingSequence ?? 1); const branchCode = typeof body.branchCode === "string" ? body.branchCode.trim() || null : null;
    if (!types.includes(documentType) || !prefix || prefix.length > 30 || !Number.isInteger(startingSequence) || startingSequence < 1) throw new Error("Numbering type, prefix and positive starting sequence are required.");
    if (!await prisma.financialYear.findUnique({ where: { id: String(body.financialYearId) } })) throw new Error("Select an existing financial year.");
    const data = { financialYearId: String(body.financialYearId), documentType: documentType as any, prefix, suffix: typeof body.suffix === "string" ? body.suffix.trim().slice(0, 20) || null : null, startingSequence, currentSequence: startingSequence - 1, branchCode: branchCode?.slice(0, 20) ?? "DEFAULT", isActive: body.isActive !== false };
    const item = await prisma.documentNumberingConfig.create({ data }); await auditBilling(auth.id, "NUMBERING_CONFIG", item.id, "CREATED", data as Prisma.InputJsonValue); return NextResponse.json(item, { status: 201 });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "A numbering configuration already exists for this year, document type and branch." }, { status: 409 }); return NextResponse.json({ error: error instanceof Error ? error.message : "Numbering configuration could not be created." }, { status: 400 }); }
}
