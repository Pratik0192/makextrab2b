import { NextRequest } from "next/server";
import { LeadLostReason, LeadStage } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, leadIsMerged, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { canTransitionLeadStage } from "@/lib/lead-stage";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user;
  const { id } = await context.params; if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (await leadIsMerged(id)) return apiError(409, "LEAD_MERGED", "Merged leads cannot be edited; open the surviving lead instead.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid stage."); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const stage = input.stage;
  if (typeof stage !== "string" || !Object.values(LeadStage).includes(stage as LeadStage)) return apiError(400, "INVALID_STAGE", "Choose a valid lead stage.");
  if (stage === "CONVERTED") return apiError(409, "CONVERSION_WORKFLOW_REQUIRED", "Leads cannot be converted until the customer conversion workflow is available.");
  if (user.role === "SALES_EXECUTIVE" && ["NEW", "ASSIGNED"].includes(stage)) return apiError(403, "FORBIDDEN", "You cannot set this lead stage.");
  const lead = await prisma.lead.findUnique({ where: { id }, select: { stage: true, mergedIntoLeadId: true, buyerApprovalStatus: true, verificationChecks: { select: { status: true } } } });
  if (!lead) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (lead.stage === "LOST") return apiError(409, "LOST_LEAD_REACTIVATION_REQUIRED", "Use the Reactivate action to return a lost lead to the active pipeline.");
  if (stage !== lead.stage && !canTransitionLeadStage(lead.stage, stage as LeadStage)) return apiError(409, "INVALID_STAGE_TRANSITION", `A lead cannot move from ${lead.stage} to ${stage}.`);
  if (user.role === "SALES_EXECUTIVE" && stage === "QUALIFIED" && (lead.buyerApprovalStatus !== "APPROVED" || lead.verificationChecks.length < 5 || lead.verificationChecks.some((check) => !["VERIFIED", "NOT_APPLICABLE"].includes(check.status)))) return apiError(409, "VERIFICATION_REQUIRED", "A Super Admin must approve the buyer and all verification checks must be resolved before qualification.");
  let lostReason: LeadLostReason | undefined;
  let reactivationDueAt: Date | null = null;
  if (stage === "LOST") {
    if (typeof input.lostReason !== "string" || !Object.values(LeadLostReason).includes(input.lostReason as LeadLostReason)) return apiError(400, "LOST_REASON_REQUIRED", "Choose a valid reason before marking this lead lost.");
    lostReason = input.lostReason as LeadLostReason;
    const notes = typeof input.lostNotes === "string" ? input.lostNotes.trim() : "";
    if (lostReason === "OTHER" && !notes) return apiError(400, "LOST_NOTES_REQUIRED", "Explain the reason when selecting Other.");
    if (notes.length > 2000 || (typeof input.competitorName === "string" && input.competitorName.length > 160) || (typeof input.priceObjection === "string" && input.priceObjection.length > 500)) return apiError(400, "LOST_DETAILS_TOO_LONG", "Lost lead details exceed the allowed length.");
    if (input.reactivationDueAt) { const parsed = new Date(String(input.reactivationDueAt)); if (Number.isNaN(parsed.getTime())) return apiError(400, "INVALID_REACTIVATION_DATE", "Enter a valid reactivation date."); reactivationDueAt = parsed; }
  }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.lead.updateMany({ where: { id, stage: lead.stage, mergedIntoLeadId: null }, data: { stage: stage as LeadStage } });
    if (!changed.count) throw new Error("LEAD_STAGE_CONFLICT");
    const result = await tx.lead.findUniqueOrThrow({ where: { id }, select: { stage: true } });
    await tx.leadActivity.create({ data: { leadId: id, activityType: "STAGE_CHANGE", description: `Stage changed from ${lead.stage} to ${stage}.`, createdById: user.id } });
    if (lostReason) {
      const details = { notes: typeof input.lostNotes === "string" ? input.lostNotes.trim() || null : null, competitorName: typeof input.competitorName === "string" ? input.competitorName.trim() || null : null, priceObjection: typeof input.priceObjection === "string" ? input.priceObjection.trim() || null : null };
      await tx.leadLostHistory.create({ data: { leadId: id, reason: lostReason, ...details, lostById: user.id, reactivationDueAt } });
      await tx.leadActivity.create({ data: { leadId: id, activityType: "LEAD_LOST", description: `Marked LOST: ${lostReason}${details.notes ? `. ${details.notes}` : ""}${details.competitorName ? `. Competitor: ${details.competitorName}` : ""}${details.priceObjection ? `. Price objection: ${details.priceObjection}` : ""}${reactivationDueAt ? `. Review for reactivation on ${reactivationDueAt.toISOString()}` : ""}`, createdById: user.id } });
    }
    return result;
  }).catch((error) => { if (error instanceof Error && error.message === "LEAD_STAGE_CONFLICT") return null; throw error; });
  if (!updated) return apiError(409, "LEAD_STAGE_CONFLICT", "This lead was changed by another user. Refresh and try again.");
  return apiSuccess({ stage: updated.stage });
}
