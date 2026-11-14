import { NextRequest } from "next/server";
import { LeadStage, Prisma } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const allowedStages: LeadStage[] = ["CONTACT_ATTEMPTED", "CONTACTED", "VERIFICATION_PENDING", "QUALIFIED", "QUOTATION_ORDER_DISCUSSION", "ON_HOLD"];
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user;
  const { id } = await context.params;
  if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit reactivation details."); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const stage = input.stage;
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (typeof stage !== "string" || !allowedStages.includes(stage as LeadStage)) return apiError(400, "INVALID_REACTIVATION_STAGE", "Choose an allowed active pipeline stage.");
  if (!note || note.length > 2000) return apiError(400, "REACTIVATION_NOTE_REQUIRED", "Enter a reactivation note of up to 2,000 characters.");
  const followNote = typeof input.followUpNote === "string" ? input.followUpNote.trim() : "";
  let dueAt: Date | null = null;
  if (input.followUpDueAt) { dueAt = new Date(String(input.followUpDueAt)); if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) return apiError(400, "INVALID_FOLLOW_UP_DATE", "Choose a future follow-up date."); if (!followNote || followNote.length > 1000) return apiError(400, "FOLLOW_UP_NOTE_REQUIRED", "Enter a follow-up note of up to 1,000 characters."); }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id }, select: { stage: true, mergedIntoLeadId: true, assignedToId: true, buyerApprovalStatus: true, verificationChecks: { select: { status: true } } } });
      if (!lead || lead.mergedIntoLeadId) throw new Error("LEAD_NOT_FOUND");
      if (lead.stage !== "LOST") throw new Error("LEAD_NOT_LOST");
      if (user.role === "SALES_EXECUTIVE" && stage === "QUALIFIED" && (lead.buyerApprovalStatus !== "APPROVED" || lead.verificationChecks.length < 5 || lead.verificationChecks.some((check) => !["VERIFIED", "NOT_APPLICABLE"].includes(check.status)))) throw new Error("VERIFICATION_REQUIRED");
      const history = await tx.leadLostHistory.findFirst({ where: { leadId: id, reactivatedAt: null }, orderBy: { lostAt: "desc" } });
      if (!history) throw new Error("LOST_HISTORY_NOT_FOUND");
      const changed = await tx.lead.updateMany({ where: { id, stage: "LOST", mergedIntoLeadId: null }, data: { stage: stage as LeadStage } });
      if (!changed.count) throw new Error("LEAD_STAGE_CONFLICT");
      let followUpId: string | null = null;
      if (dueAt) {
        const followUp = await tx.leadFollowUp.create({ data: { leadId: id, assignedToId: lead.assignedToId ?? user.id, dueAt, note: followNote, createdById: user.id } });
        followUpId = followUp.id;
      }
      const historyUpdate = await tx.leadLostHistory.updateMany({ where: { id: history.id, reactivatedAt: null }, data: { reactivatedAt: new Date(), reactivatedById: user.id, reactivationNote: note, reactivationStage: stage as LeadStage, reactivationFollowUpId: followUpId } });
      if (!historyUpdate.count) throw new Error("LEAD_STAGE_CONFLICT");
      await tx.leadActivity.create({ data: { leadId: id, activityType: "STAGE_CHANGE", description: `Stage changed from LOST to ${stage}.`, createdById: user.id } });
      await tx.leadActivity.create({ data: { leadId: id, activityType: "LEAD_REACTIVATED", description: `Lead reactivated into ${stage}. ${note}${dueAt ? ` Follow-up scheduled for ${dueAt.toISOString()}.` : ""}`, createdById: user.id } });
      return { stage, followUpId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return apiSuccess(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "LEAD_NOT_FOUND") return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
    if (message === "LEAD_NOT_LOST") return apiError(409, "LEAD_NOT_LOST", "Only lost leads can be reactivated.");
    if (message === "LOST_HISTORY_NOT_FOUND") return apiError(409, "LOST_HISTORY_NOT_FOUND", "A current lost history record is required before reactivation.");
    if (message === "VERIFICATION_REQUIRED") return apiError(409, "VERIFICATION_REQUIRED", "A Super Admin must approve the buyer and resolve all verification checks before qualification.");
    if (message === "LEAD_STAGE_CONFLICT") return apiError(409, "LEAD_STAGE_CONFLICT", "This lead was changed by another user. Refresh and retry.");
    console.error("Lead reactivation failed", error);
    return apiError(500, "LEAD_REACTIVATION_FAILED", "The lead could not be reactivated.");
  }
}
