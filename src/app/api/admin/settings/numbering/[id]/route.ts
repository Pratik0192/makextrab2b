import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { auditBilling } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth; const { id } = await params; const prior = await prisma.documentNumberingConfig.findUnique({ where: { id } }); if (!prior) return NextResponse.json({ error: "Numbering configuration not found." }, { status: 404 });
  try { const body = await request.json(); if ("currentSequence" in body) throw new Error("Issued document sequence values cannot be edited."); if ("startingSequence" in body && prior.currentSequence >= prior.startingSequence) throw new Error("Starting sequence cannot be changed after a number has been issued.");
    const data = { ...(typeof body.prefix === "string" ? { prefix: body.prefix.trim().slice(0, 30) } : {}), ...(typeof body.suffix === "string" || body.suffix === null ? { suffix: body.suffix?.trim().slice(0, 20) || null } : {}), ...(Number.isInteger(body.startingSequence) && body.startingSequence > 0 ? { startingSequence: body.startingSequence } : {}), ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}) };
    const updated = await prisma.documentNumberingConfig.update({ where: { id }, data }); await auditBilling(auth.id, "NUMBERING_CONFIG", id, "UPDATED", data as Prisma.InputJsonValue); return NextResponse.json(updated);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Numbering configuration could not be updated." }, { status: 400 }); }
}
