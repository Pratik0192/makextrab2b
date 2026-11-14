import { NextRequest } from "next/server";
import { isAuthFailure, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { leadIsMerged } from "@/lib/admin-api";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { const user = await requireLeadUser(request); if (isAuthFailure(user)) return user; const { id } = await context.params; if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found."); const items = await prisma.leadFollowUp.findMany({ where: { leadId: id }, orderBy: { dueAt: "asc" } }); return apiSuccess({ items }); }
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user; const { id } = await context.params; if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (await leadIsMerged(id)) return apiError(409, "LEAD_MERGED", "Schedule follow-ups on the surviving lead instead.");
  const lead = await prisma.lead.findUnique({ where: { id }, select: { assignedToId: true, stage:true } }); if (lead?.stage === "LOST") return apiError(409, "LEAD_LOST", "Reactivate the lead before scheduling a normal follow-up."); if (!lead?.assignedToId) return apiError(409, "UNASSIGNED_LEAD", "Assign this lead before scheduling a follow-up.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid follow-up."); }
  if (!body || typeof body !== "object") return apiError(400, "INVALID_BODY", "Submit a valid follow-up."); const b = body as Record<string, unknown>; const dueAt = typeof b.dueAt === "string" ? new Date(b.dueAt) : new Date(NaN); const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : "";
  if (Number.isNaN(dueAt.getTime()) || !note) return apiError(400, "INVALID_FOLLOW_UP", "Choose a valid date and enter a note.");
  const item = await prisma.$transaction(async (tx) => { const created = await tx.leadFollowUp.create({ data: { leadId: id, assignedToId: lead.assignedToId!, createdById: user.id, dueAt, note } }); await tx.leadActivity.create({ data: { leadId: id, activityType: "FOLLOW_UP", description: `Follow-up scheduled for ${dueAt.toISOString()}: ${note}`, createdById: user.id } }); return created; }); return apiSuccess(item, 201);
}
