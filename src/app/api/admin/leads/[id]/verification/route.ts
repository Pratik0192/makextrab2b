import { NextRequest } from "next/server";
import { VerificationCheckType, VerificationItemStatus } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, leadIsMerged, requireLeadOwnership, requireLeadUser, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user;
  const { id } = await context.params; if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (await leadIsMerged(id)) return apiError(409, "LEAD_MERGED", "Merged leads cannot be updated; update the surviving lead.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid verification update."); }
  if (!body || typeof body !== "object") return apiError(400, "INVALID_BODY", "Submit a valid verification update.");
  const b = body as Record<string, unknown>;
  if (b.action === "approval") {
    const admin = await requireSuperAdmin(request); if (isAuthFailure(admin)) return admin;
    const status = b.status; const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 1000) : "";
    if (!["APPROVED", "REJECTED", "MORE_INFORMATION_REQUESTED"].includes(String(status)) || (status === "REJECTED" && !reason)) return apiError(400, "INVALID_DECISION", "Choose a valid decision and provide a reason when rejecting.");
    const updated = await prisma.$transaction(async (tx) => { const lead = await tx.lead.update({ where: { id }, data: { buyerApprovalStatus: status as "APPROVED" | "REJECTED" | "MORE_INFORMATION_REQUESTED", buyerApprovalReason: reason || null, buyerApprovedById: admin.id, buyerApprovedAt: new Date() } }); await tx.leadActivity.create({ data: { leadId: id, activityType: "VERIFICATION_UPDATE", description: `Buyer status set to ${status}${reason ? `: ${reason}` : ""}`, createdById: admin.id } }); return lead; });
    return apiSuccess({ buyerApprovalStatus: updated.buyerApprovalStatus });
  }
  if (typeof b.checkType !== "string" || !Object.values(VerificationCheckType).includes(b.checkType as VerificationCheckType) || typeof b.status !== "string" || !Object.values(VerificationItemStatus).includes(b.status as VerificationItemStatus)) return apiError(400, "INVALID_VERIFICATION", "Choose a valid checklist item and status.");
  const record = await prisma.$transaction(async (tx) => { const check = await tx.leadVerificationCheck.upsert({ where: { leadId_checkType: { leadId: id, checkType: b.checkType as VerificationCheckType } }, create: { leadId: id, checkType: b.checkType as VerificationCheckType, status: b.status as VerificationItemStatus, remarks: typeof b.remarks === "string" ? b.remarks.slice(0, 1000) : null, updatedById: user.id }, update: { status: b.status as VerificationItemStatus, remarks: typeof b.remarks === "string" ? b.remarks.slice(0, 1000) : null, updatedById: user.id } }); await tx.leadActivity.create({ data: { leadId: id, activityType: "VERIFICATION_UPDATE", description: `${b.checkType} marked ${b.status}.`, createdById: user.id } }); return check; });
  return apiSuccess(record);
}
