import { NextRequest } from "next/server";
import { LeadPriority } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, leadIsMerged, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin(request); if (isAuthFailure(user)) return user;
  const { id } = await context.params;
  if (await leadIsMerged(id)) return apiError(409, "LEAD_MERGED", "Merged leads cannot be edited; update the surviving lead.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid priority."); }
  const priority = body && typeof body === "object" ? (body as { priority?: unknown }).priority : undefined;
  if (typeof priority !== "string" || !Object.values(LeadPriority).includes(priority as LeadPriority)) return apiError(400, "INVALID_PRIORITY", "Choose LOW, MEDIUM, HIGH or URGENT.");
  const current = await prisma.lead.findUnique({ where: { id }, select: { priority: true } }); if (!current) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (current.priority === priority) return apiSuccess({ priority: current.priority });
  const updated = await prisma.$transaction(async tx => { const lead = await tx.lead.update({ where: { id }, data: { priority: priority as LeadPriority } }); await tx.leadActivity.create({ data: { leadId: id, activityType: "PRIORITY_CHANGE", description: `Priority changed from ${current.priority} to ${priority}.`, createdById: user.id } }); return lead; });
  return apiSuccess({ priority: updated.priority });
}
