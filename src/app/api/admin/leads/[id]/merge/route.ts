import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const mergeFields = ["businessName", "businessType", "gstin", "website", "socialMediaUrl", "buyerName", "mobile", "whatsappNumber", "email", "preferredContactMethod", "city", "state", "pincode", "country", "businessAddress", "deliveryAddress", "deliveryCity", "deliveryState", "deliveryPincode", "deliveryContactName", "deliveryContactPhone", "notes", "estimatedTotalQuantity", "estimatedOrderValue", "preferredPaymentMode"] as const;
const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin(request); if (isAuthFailure(actor)) return actor;
  const { id: routePrimaryId } = await context.params;
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit valid merge details."); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const primaryId = typeof input.primaryLeadId === "string" ? input.primaryLeadId : routePrimaryId;
  const secondaryId = typeof input.secondaryLeadId === "string" ? input.secondaryLeadId : "";
  if (!secondaryId || primaryId === secondaryId) return apiError(400, "INVALID_MERGE_PAIR", "Choose two different leads to merge.");
  const fieldChoices = input.fieldChoices && typeof input.fieldChoices === "object" ? input.fieldChoices as Record<string, unknown> : {};
  const assignmentProvided = Object.prototype.hasOwnProperty.call(input, "assignedToId");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lockIds = [primaryId, secondaryId].sort((a, b) => a.localeCompare(b));
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Lead" WHERE id IN (${Prisma.join(lockIds)}) ORDER BY id FOR UPDATE`);
      const [primary, secondary] = await Promise.all([
        tx.lead.findUnique({ where: { id: primaryId }, select: { id: true, referenceNumber: true, mergedIntoLeadId: true, mergedAt: true, assignedToId: true, ...Object.fromEntries(mergeFields.map((field) => [field, true])) } }),
        tx.lead.findUnique({ where: { id: secondaryId }, select: { id: true, referenceNumber: true, mergedIntoLeadId: true, mergedAt: true, assignedToId: true, ...Object.fromEntries(mergeFields.map((field) => [field, true])) } }),
      ]);
      if (!primary || !secondary) throw new Error("MERGE_LEAD_NOT_FOUND");
      if (primary.mergedIntoLeadId || secondary.mergedIntoLeadId || primary.mergedAt || secondary.mergedAt) throw new Error("MERGE_ALREADY_MERGED");
      const match = await tx.leadDuplicateMatch.findFirst({ where: { status: "CONFIRMED_DUPLICATE", OR: [{ leadAId: primaryId, leadBId: secondaryId }, { leadAId: secondaryId, leadBId: primaryId }] }, select: { id: true } });
      if (!match) throw new Error("DUPLICATE_NOT_CONFIRMED");

      const profileUpdates: Record<string, unknown> = {};
      for (const field of mergeFields) {
        const left = (primary as Record<string, unknown>)[field];
        const right = (secondary as Record<string, unknown>)[field];
        if (isEmpty(left) && !isEmpty(right)) { profileUpdates[field] = right; continue; }
        if (isEmpty(right) || Object.is(left, right)) continue;
        const choice = fieldChoices[field];
        if (choice !== "PRIMARY" && choice !== "SECONDARY") throw new Error(`INVALID_FIELD_CHOICE:${field}`);
        if (choice === "SECONDARY") profileUpdates[field] = right;
      }

      let assignedToId = primary.assignedToId;
      if (primary.assignedToId !== secondary.assignedToId) {
        if (!assignmentProvided) throw new Error("ASSIGNMENT_CHOICE_REQUIRED");
        assignedToId = input.assignedToId === null ? null : typeof input.assignedToId === "string" ? input.assignedToId : "";
        if (assignedToId === "") throw new Error("INVALID_ASSIGNMENT_CHOICE");
        if (assignedToId && !(await tx.user.findFirst({ where: { id: assignedToId, role: "SALES_EXECUTIVE", isActive: true }, select: { id: true } }))) throw new Error("INVALID_ASSIGNMENT_CHOICE");
      }

      const [primaryBefore, secondaryBefore] = await Promise.all([
        tx.lead.findUniqueOrThrow({ where: { id: primaryId } }),
        tx.lead.findUniqueOrThrow({ where: { id: secondaryId }, include: { leadProducts: true, leadTags: { include: { tag: true } }, documents: { select: { id: true, documentType: true, originalFileName: true, uploadedAt: true } }, followUps: { select: { id: true, dueAt: true, assignedToId: true, status: true } }, assignments: { select: { id: true, assignedToId: true, previousAssigneeId: true, createdAt: true } }, verificationChecks: true, lostHistory: true } }),
      ]);
      const serializableSecondary = JSON.parse(JSON.stringify(secondaryBefore));
      const serializablePrimary = JSON.parse(JSON.stringify(primaryBefore));
      const assignmentChanged = assignedToId !== primaryBefore.assignedToId;
      await tx.lead.update({ where: { id: primaryId }, data: { ...profileUpdates, assignedToId, ...(assignmentChanged ? { assignedAt: assignedToId ? new Date() : null, assignedById: assignedToId ? actor.id : null } : {}) } as Prisma.LeadUpdateInput });

      const existingProducts = await tx.leadProduct.findMany({ where: { leadId: primaryId }, select: { id: true, productId: true, productNameSnapshot: true, skuSnapshot: true, requestedQuantity: true } });
      const existingByProduct = new Map(existingProducts.filter((product) => product.productId).map((product) => [product.productId, product]));
      const existingBySnapshot = new Map(existingProducts.filter((product) => !product.productId).map((product) => [`${product.skuSnapshot.toLowerCase()}|${product.productNameSnapshot.toLowerCase()}`, product]));
      for (const item of secondaryBefore.leadProducts) {
        const existing = item.productId ? existingByProduct.get(item.productId) : existingBySnapshot.get(`${item.skuSnapshot.toLowerCase()}|${item.productNameSnapshot.toLowerCase()}`);
        if (existing) await tx.leadProduct.update({ where: { id: existing.id }, data: { requestedQuantity: existing.requestedQuantity + item.requestedQuantity } });
        else await tx.leadProduct.update({ where: { id: item.id }, data: { leadId: primaryId } });
      }
      await tx.leadTagAssignment.createMany({ data: secondaryBefore.leadTags.map(({ tagId }) => ({ leadId: primaryId, tagId })), skipDuplicates: true });
      await tx.leadDocument.updateMany({ where: { leadId: secondaryId }, data: { leadId: primaryId } });
      await tx.leadActivity.updateMany({ where: { leadId: secondaryId }, data: { leadId: primaryId } });
      await tx.leadAssignment.updateMany({ where: { leadId: secondaryId }, data: { leadId: primaryId } });
      await tx.leadFollowUp.updateMany({ where: { leadId: secondaryId }, data: { leadId: primaryId } });
      const primaryChecks = await tx.leadVerificationCheck.findMany({ where: { leadId: primaryId }, select: { checkType: true } });
      const primaryCheckTypes = new Set(primaryChecks.map((check) => check.checkType));
      for (const check of secondaryBefore.verificationChecks) if (!primaryCheckTypes.has(check.checkType)) await tx.leadVerificationCheck.update({ where: { id: check.id }, data: { leadId: primaryId } });
      await tx.leadLostHistory.updateMany({ where: { leadId: secondaryId }, data: { leadId: primaryId } });

      if (assignedToId !== primaryBefore.assignedToId && assignedToId) await tx.leadAssignment.create({ data: { leadId: primaryId, assignedToId, assignedById: actor.id, previousAssigneeId: primaryBefore.assignedToId, reason: `Final assignment selected during merge of ${secondaryBefore.referenceNumber}.` } });
      await tx.lead.update({ where: { id: secondaryId }, data: { mergedIntoLeadId: primaryId, mergedAt: new Date(), mergedById: actor.id, mergeSnapshot: { originalReferenceNumber: secondaryBefore.referenceNumber, original: serializableSecondary, primaryBeforeMerge: serializablePrimary } as Prisma.InputJsonValue } });
      await tx.leadActivity.create({ data: { leadId: primaryId, activityType: "LEAD_MERGED", description: `Merged ${secondaryBefore.referenceNumber} into ${primaryBefore.referenceNumber}. Original secondary data is retained on the merged record. Final assignment: ${assignedToId ?? "Unassigned"}.`, createdById: actor.id } });
      await tx.leadActivity.create({ data: { leadId: secondaryId, activityType: "LEAD_MERGED", description: `This lead was merged into ${primaryBefore.referenceNumber}.`, createdById: actor.id } });
      return { primaryId, secondaryId, primaryReference: primaryBefore.referenceNumber, secondaryReference: secondaryBefore.referenceNumber, assignedToId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return apiSuccess(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "MERGE_LEAD_NOT_FOUND") return apiError(404, "LEAD_NOT_FOUND", "One or both leads could not be found.");
    if (message === "MERGE_ALREADY_MERGED") return apiError(409, "LEAD_ALREADY_MERGED", "Merged leads cannot be merged again.");
    if (message === "DUPLICATE_NOT_CONFIRMED") return apiError(409, "DUPLICATE_NOT_CONFIRMED", "Confirm this duplicate match before merging.");
    if (message === "ASSIGNMENT_CHOICE_REQUIRED") return apiError(400, "ASSIGNMENT_CHOICE_REQUIRED", "Choose the surviving lead assignment because the leads have different owners.");
    if (message === "INVALID_ASSIGNMENT_CHOICE") return apiError(400, "INVALID_ASSIGNMENT_CHOICE", "Choose an active Sales Executive or explicitly leave the surviving lead unassigned.");
    if (message.startsWith("INVALID_FIELD_CHOICE:")) return apiError(400, "INVALID_FIELD_CHOICE", `Choose which lead's ${message.split(":")[1]} value to keep.`);
    console.error("Lead merge failed", error);
    return apiError(500, "LEAD_MERGE_FAILED", "The leads could not be merged. No partial changes were committed.");
  }
}
