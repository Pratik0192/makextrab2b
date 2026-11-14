import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin(request);
  if (isAuthFailure(actor)) return actor;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid assignment request."); }
  if (!body || typeof body !== "object" || typeof (body as { assignedToId?: unknown }).assignedToId !== "string") return apiError(400, "INVALID_ASSIGNMENT", "Select an active Sales Executive.");
  const { assignedToId, reason } = body as { assignedToId: string; reason?: unknown };
  const note = typeof reason === "string" ? reason.trim().slice(0, 500) : undefined;
  try {
    const [lead, assignee] = await Promise.all([
      prisma.lead.findUnique({ where: { id }, select: { id: true, stage: true, assignedToId: true, mergedIntoLeadId: true } }),
      prisma.user.findFirst({ where: { id: assignedToId, role: "SALES_EXECUTIVE", isActive: true }, select: { id: true, firstName: true, lastName: true, email: true } }),
    ]);
    if (!lead) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
    if (lead.mergedIntoLeadId) return apiError(409, "LEAD_MERGED", "Merged leads cannot be reassigned; update the surviving lead.");
    if (!assignee) return apiError(400, "INVALID_ASSIGNEE", "Choose an active Sales Executive.");
    if (lead.assignedToId === assignee.id) return apiError(409, "ALREADY_ASSIGNED", "This lead is already assigned to that executive.");
    const previous = lead.assignedToId ? await prisma.user.findUnique({ where: { id: lead.assignedToId }, select: { firstName: true, lastName: true } }) : null;
    const message = `${previous ? `Reassigned from ${previous.firstName} ${previous.lastName} to` : "Assigned to"} ${assignee.firstName} ${assignee.lastName}${note ? `. Reason: ${note}` : ""}`;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.lead.update({ where: { id }, data: { assignedToId: assignee.id, assignedById: actor.id, assignedAt: new Date(), ...(lead.stage === "NEW" ? { stage: "ASSIGNED" } : {}) } });
      await tx.leadAssignment.create({ data: { leadId: id, assignedToId: assignee.id, assignedById: actor.id, previousAssigneeId: lead.assignedToId, reason: note } });
      await tx.leadActivity.create({ data: { leadId: id, activityType: "ASSIGNMENT", description: message, createdById: actor.id } });
      return result;
    });
    return apiSuccess({ id: updated.id, assignedTo: assignee, assignedAt: updated.assignedAt });
  } catch (error) {
    console.error("Lead assignment failed", error);
    return apiError(500, "ASSIGNMENT_FAILED", "Lead assignment could not be completed.");
  }
}
