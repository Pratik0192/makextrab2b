import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling, parseCompanySettings } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  const settings = await prisma.companySettings.findUnique({ where: { id: "main" } }); return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  try {
    const input = parseCompanySettings(await request.json());
    const settings = await prisma.companySettings.upsert({ where: { id: "main" }, create: { id: "main", ...input, updatedById: auth.id } as Prisma.CompanySettingsUncheckedCreateInput, update: { ...input, updatedById: auth.id } as Prisma.CompanySettingsUncheckedUpdateInput });
    await auditBilling(auth.id, "COMPANY_SETTINGS", "main", "UPDATED", input as Prisma.InputJsonValue);
    return NextResponse.json({ settings });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Settings could not be saved." }, { status: 400 }); }
}
