import { NextRequest } from "next/server";
import { DuplicateReviewStatus } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; matchId: string }> }) {
  const actor = await requireSuperAdmin(request); if (isAuthFailure(actor)) return actor;
  const { id, matchId } = await context.params;
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a duplicate review decision."); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (input.status !== "CONFIRMED_DUPLICATE" && input.status !== "DISMISSED") return apiError(400, "INVALID_REVIEW_STATUS", "Choose Confirm duplicate or Dismiss.");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 1000) return apiError(400, "INVALID_REVIEW_NOTE", "Review notes must be 1,000 characters or fewer.");
  const existing = await prisma.leadDuplicateMatch.findFirst({ where: { id: matchId, OR: [{ leadAId: id }, { leadBId: id }] }, select: { id: true, leadAId: true, leadBId: true, status: true, reasons: true } });
  if (!existing) return apiError(404, "DUPLICATE_MATCH_NOT_FOUND", "This duplicate match could not be found.");
  if (existing.status !== "PENDING") return apiError(409, "DUPLICATE_ALREADY_REVIEWED", "This duplicate match has already been reviewed.");
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.leadDuplicateMatch.updateMany({ where: { id: matchId, status: "PENDING" }, data: { status: input.status as DuplicateReviewStatus, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note || null } });
    if (!changed.count) return false;
    const action = input.status === "DISMISSED" ? "dismissed as a false positive" : "confirmed as duplicates";
    for (const leadId of [existing.leadAId, existing.leadBId]) await tx.leadActivity.create({ data: { leadId, activityType: "DUPLICATE_REVIEW", description: `Possible duplicate ${action} (${existing.reasons.join(", ")}).${note ? ` Note: ${note}` : ""}`, createdById: actor.id } });
    return true;
  });
  if (!result) return apiError(409, "DUPLICATE_ALREADY_REVIEWED", "This duplicate match has already been reviewed.");
  return apiSuccess({ id: matchId, status: input.status });
}
