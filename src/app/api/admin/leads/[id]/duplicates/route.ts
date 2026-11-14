import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { findPossibleLeadDuplicates, saveLeadDuplicateMatches } from "@/lib/lead-duplicates";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user;
  const { id } = await context.params;
  if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (user.role === "SUPER_ADMIN") {
    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, mergedIntoLeadId: null }, select: { mobile:true,gstin:true,email:true,businessName:true } });
      if (lead) await saveLeadDuplicateMatches(tx, id, await findPossibleLeadDuplicates(tx, lead, id), user.id);
    }, { isolationLevel: "Serializable" });
  }
  const matches = await prisma.leadDuplicateMatch.findMany({
    where: { OR: [{ leadAId: id }, { leadBId: id }] },
    include: {
      leadA: { select: { id: true, referenceNumber: true, businessName: true, buyerName: true, mobile: true, email: true, gstin: true, createdAt: true, stage: true, assignedToId: true, assignedTo: { select: { firstName: true, lastName: true } }, mergedIntoLeadId: true } },
      leadB: { select: { id: true, referenceNumber: true, businessName: true, buyerName: true, mobile: true, email: true, gstin: true, createdAt: true, stage: true, assignedToId: true, assignedTo: { select: { firstName: true, lastName: true } }, mergedIntoLeadId: true } },
    }, orderBy: { createdAt: "desc" },
  });
  const visible = matches.filter((match) => (match.leadAId === id ? !match.leadB.mergedIntoLeadId : !match.leadA.mergedIntoLeadId) && (user.role === "SUPER_ADMIN" || (match.leadAId === id ? match.leadB.assignedToId === user.id : match.leadA.assignedToId === user.id)));
  return apiSuccess({ items: visible.map(({ leadA, leadB, ...match }) => ({ ...match, candidate: leadA.id === id ? leadB : leadA })), restrictedMatches: user.role === "SALES_EXECUTIVE" && visible.length < matches.length, canReview: user.role === "SUPER_ADMIN" });
}
