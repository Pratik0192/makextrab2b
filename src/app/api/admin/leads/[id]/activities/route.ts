import { NextRequest } from "next/server";
import { LeadActivityType } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, leadIsMerged, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
const contactTypes = ["PHONE_CALL", "WHATSAPP", "EMAIL", "MEETING"];
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user;
  const { id } = await context.params; if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (await leadIsMerged(id)) return apiError(409, "LEAD_MERGED", "Add activity to the surviving lead instead.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid activity."); }
  if (!body || typeof body !== "object") return apiError(400, "INVALID_BODY", "Submit a valid activity.");
  const b = body as Record<string, unknown>; const type = b.activityType; const description = typeof b.description === "string" ? b.description.trim().slice(0, 2000) : "";
  if (typeof type !== "string" || !Object.values(LeadActivityType).includes(type as LeadActivityType) || !["PHONE_CALL", "WHATSAPP", "EMAIL", "MEETING", "NOTE"].includes(type) || !description) return apiError(400, "INVALID_ACTIVITY", "Choose a contact type and enter a description.");
  const contactMade = contactTypes.includes(type) && b.contactMade === true;
  const activity = await prisma.$transaction(async (tx) => { const result = await tx.leadActivity.create({ data: { leadId: id, activityType: type as LeadActivityType, description, outcome: typeof b.outcome === "string" ? b.outcome.trim().slice(0, 1000) : null, contactMade, createdById: user.id } }); if (contactMade) await tx.lead.update({ where: { id }, data: { lastContactAt: new Date() } }); return result; });
  return apiSuccess(activity, 201);
}
