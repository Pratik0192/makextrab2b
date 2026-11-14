import { NextRequest } from "next/server";
import { isAuthFailure, leadIsMerged, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; followUpId: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user; const { id, followUpId } = await context.params; if (!(await requireLeadOwnership(user, id))) return apiError(404, "FOLLOW_UP_NOT_FOUND", "Follow-up could not be found.");
  if (await leadIsMerged(id)) return apiError(409, "LEAD_MERGED", "Follow-ups on a merged lead cannot be edited.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid follow-up update."); } if (!body || typeof body !== "object") return apiError(400, "INVALID_BODY", "Submit a valid follow-up update."); const b = body as Record<string, unknown>;
  if (b.status !== "COMPLETED" && b.status !== "CANCELLED") return apiError(400, "INVALID_STATUS", "Choose completed or cancelled."); const outcome = typeof b.outcome === "string" ? b.outcome.trim().slice(0, 1000) : ""; if (b.status === "COMPLETED" && !outcome) return apiError(400, "OUTCOME_REQUIRED", "Enter the follow-up outcome.");
  const current = await prisma.leadFollowUp.findFirst({ where: { id: followUpId, leadId: id }, select: { id: true, status: true, assignedToId: true } }); if (!current) return apiError(404, "FOLLOW_UP_NOT_FOUND", "Follow-up could not be found."); if (current.status !== "PENDING") return apiError(409, "FOLLOW_UP_CLOSED", "This follow-up is already closed."); if (user.role === "SALES_EXECUTIVE" && current.assignedToId !== user.id) return apiError(404, "FOLLOW_UP_NOT_FOUND", "Follow-up could not be found.");
  const finalStatus = b.status as "COMPLETED" | "CANCELLED";
  const updated = await prisma.$transaction(async (tx) => { const item = await tx.leadFollowUp.update({ where: { id: followUpId }, data: { status: finalStatus, outcome: outcome || null, completedAt: finalStatus === "COMPLETED" ? new Date() : null } }); await tx.leadActivity.create({ data: { leadId: id, activityType: "FOLLOW_UP", description: `Follow-up ${finalStatus.toLowerCase()}${outcome ? `: ${outcome}` : ""}`, createdById: user.id } }); return item; }); return apiSuccess(updated);
}
