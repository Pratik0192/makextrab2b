import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { findPossibleLeadDuplicates, saveLeadDuplicateMatches, normalizeMobile } from "@/lib/lead-duplicates";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireLeadUser(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  if (!(await requireLeadOwnership(auth, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  try {
    const mergeState = await prisma.lead.findUnique({ where: { id }, select: { mergedIntoLead: { select: { id: true, referenceNumber: true, assignedToId: true } } } });
    if (mergeState?.mergedIntoLead) {
      if (auth.role === "SALES_EXECUTIVE" && mergeState.mergedIntoLead.assignedToId !== auth.id) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
      return apiError(409, "LEAD_MERGED", `This lead was merged into ${mergeState.mergedIntoLead.referenceNumber}.`, { mergedIntoLeadId: mergeState.mergedIntoLead.id });
    }
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        referenceNumber: true,
        businessName: true,
        businessType: true,
        gstin: true,
        website: true,
        socialMediaUrl: true,
        buyerName: true,
        mobile: true,
        whatsappNumber: true,
        email: true,
        preferredContactMethod: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
        businessAddress: true,
        estimatedTotalQuantity: true,
        estimatedOrderValue: true,
        preferredPaymentMode: true,
        deliveryAddress: true,
        notes: true,
        source: true,
        stage: true,
        priority: true,
        consentToContact: true,
        consentToPrivacyPolicy: true,
        informationAccuracyConfirmed: true,
        consentedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedToId: true,
        assignedAt: true,
        lastContactAt: true,
        buyerApprovalStatus: true,
        buyerApprovalReason: true,
        assignments: { orderBy: { createdAt: "desc" }, take: 25, include: { assignedTo: { select: { firstName: true, lastName: true, email: true } }, assignedBy: { select: { firstName: true, lastName: true } }, previousAssignee: { select: { firstName: true, lastName: true } } } },
        activities: { orderBy: { createdAt: "desc" }, take: 100, include: { createdBy: { select: { firstName: true, lastName: true } } } },
        documents: { orderBy: { uploadedAt: "desc" }, select: { id: true, documentType: true, originalFileName: true, mimeType: true, fileSize: true, scanStatus: true, uploadedAt: true } },
        verificationChecks: { include: { updatedBy: { select: { firstName: true, lastName: true } } } },
        followUps: { orderBy: { dueAt: "asc" }, take: 50 },
        leadProducts: {
          orderBy: { createdAt: "asc" },
          include: {
            product: {
              select: {
                images: {
                  orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
                  take: 1,
                  select: { imageUrl: true, altText: true },
                },
              },
            },
          },
        },
        leadTags: { select: { tag: { select: { id: true, name: true, normalizedName: true } } }, orderBy: { tag: { name: "asc" } } },
        lostHistory: { orderBy: { lostAt: "desc" }, take: 25 },
        mergedLeads: { orderBy: { mergedAt: "desc" }, select: { id: true, referenceNumber: true, mergedAt: true, mergedById: true, mergeSnapshot: true } },
      },
    });
    if (!lead) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
    return apiSuccess(lead);
  } catch (error) {
    console.error("Admin lead detail retrieval failed", error);
    return apiError(500, "LEAD_LOAD_FAILED", "Lead details could not be loaded right now.");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireLeadUser(request);
  if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  if (!(await requireLeadOwnership(auth, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit valid lead details."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError(400, "INVALID_BODY", "Submit valid lead details.");
  const input = body as Record<string, unknown>;
  const editable = ["businessName", "buyerName", "mobile", "whatsappNumber", "email", "gstin", "city", "state", "businessAddress", "website", "socialMediaUrl"] as const;
  const data: Record<string, string | null> = {};
  for (const field of editable) if (Object.prototype.hasOwnProperty.call(input, field)) {
    const value = input[field];
    if (value !== null && typeof value !== "string") return apiError(400, "INVALID_FIELD", `Enter a valid ${field}.`, undefined, field);
    const cleaned = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : null;
    if (cleaned && cleaned.length > (field === "businessAddress" ? 1000 : 200)) return apiError(400, "FIELD_TOO_LONG", `${field} is too long.`, undefined, field);
    if (["businessName", "buyerName", "mobile", "email", "city", "state"].includes(field) && !cleaned) return apiError(400, "REQUIRED_FIELD", `${field} cannot be empty.`, undefined, field);
    if (field === "email" && cleaned && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return apiError(400, "INVALID_EMAIL", "Enter a valid email address.", undefined, field);
    if ((field === "mobile" || field === "whatsappNumber") && cleaned && !normalizeMobile(cleaned)) return apiError(400, "INVALID_MOBILE", "Enter a valid 10-digit Indian mobile number.", undefined, field);
    data[field] = cleaned;
  }
  if (!Object.keys(data).length) return apiError(400, "NO_CHANGES", "Provide at least one editable business or contact field.");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.lead.findFirst({ where: { id, mergedIntoLeadId: null }, select: { businessName:true,businessType:true,gstin:true,website:true,socialMediaUrl:true,buyerName:true,mobile:true,whatsappNumber:true,email:true,preferredContactMethod:true,city:true,state:true,pincode:true,country:true,businessAddress:true,deliveryAddress:true,notes:true } });
      if (!current) throw new Error("LEAD_NOT_FOUND");
      const updated = await tx.lead.update({ where: { id }, data: data as Prisma.LeadUpdateInput });
      const merged = { ...current, ...data };
      const candidates = await findPossibleLeadDuplicates(tx, merged, id);
      await saveLeadDuplicateMatches(tx, id, candidates, auth.id);
      await tx.leadActivity.create({ data: { leadId:id, activityType:"NOTE", description:"Business or contact details updated.", createdById:auth.id } });
      return { updated: true, newPossibleMatches: candidates.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
    console.error("Lead details update failed", error);
    return apiError(500, "LEAD_UPDATE_FAILED", "Lead details could not be updated.");
  }
}
