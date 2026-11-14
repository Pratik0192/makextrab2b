import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) { const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; return NextResponse.json({ items: await prisma.financialYear.findMany({ include: { numbering: true }, orderBy: { startDate: "desc" } }) }); }
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json(); const name = typeof body.name === "string" ? body.name.trim() : ""; const startDate = new Date(body.startDate); const endDate = new Date(body.endDate); const isActive = body.isActive === true;
    if (!name || name.length > 40 || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) throw new Error("Provide a name and valid start/end dates.");
    const result = await prisma.$transaction(async (tx) => {
      const overlap = await tx.financialYear.findFirst({ where: { startDate: { lte: endDate }, endDate: { gte: startDate } } }); if (overlap) throw new Error(`Date range overlaps financial year ${overlap.name}.`);
      if (isActive) await tx.financialYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
      const year = await tx.financialYear.create({ data: { name, startDate, endDate, isActive } });
      await tx.billingAuditEvent.create({ data: { entity: "FINANCIAL_YEAR", entityId: year.id, action: "CREATED", actorId: auth.id, changes: { name, startDate: startDate.toISOString(), endDate: endDate.toISOString(), isActive } } }); return year;
    }, { isolationLevel: "Serializable" }); return NextResponse.json(result, { status: 201 });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "A financial year with that name already exists." }, { status: 409 }); return NextResponse.json({ error: error instanceof Error ? error.message : "Financial year could not be created." }, { status: 400 }); }
}
