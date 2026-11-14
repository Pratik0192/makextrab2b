import { LeadPriority, LeadSource, LeadStage, Prisma, VerificationItemStatus } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, positiveInteger, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

const allowedPageSizes = [10, 20, 50, 100];
const ageRanges = ["0-7", "8-15", "16-30", "30+"];
const followUpStates = ["PENDING", "OVERDUE", "COMPLETED"];
const sortFields = ["createdAt", "updatedAt", "priority", "nextFollowUpDate", "lastContactAt", "leadAge", "businessName"];

function dateFilter(value: string | null, endOfDay = false): Date | null | false {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return date;
}

export async function GET(request: NextRequest) {
  const auth = await requireLeadUser(request);
  if (isAuthFailure(auth)) return auth;
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1, 1_000_000);
  const pageSizeValue = params.get("pageSize");
  const pageSize = pageSizeValue ? Number(pageSizeValue) : 20;
  if (!allowedPageSizes.includes(pageSize)) return apiError(400, "INVALID_PAGE_SIZE", "Choose a page size of 10, 20, 50 or 100.");
  const search = params.get("search")?.trim().replace(/\s+/g, " ").slice(0, 100) || undefined;
  const sourceValue = params.get("source");
  const stageValue = params.get("stage");
  const priorityValue = params.get("priority");
  if (sourceValue && !Object.values(LeadSource).includes(sourceValue as LeadSource)) return apiError(400, "INVALID_SOURCE", "Choose a valid lead source.");
  if (stageValue && !Object.values(LeadStage).includes(stageValue as LeadStage)) return apiError(400, "INVALID_STAGE", "Choose a valid lead stage.");
  if (priorityValue && !Object.values(LeadPriority).includes(priorityValue as LeadPriority)) return apiError(400, "INVALID_PRIORITY", "Choose a valid lead priority.");

  const createdFrom = dateFilter(params.get("createdFrom") ?? params.get("from"));
  const createdTo = dateFilter(params.get("createdTo") ?? params.get("to"), true);
  const contactFrom = dateFilter(params.get("lastContactFrom"));
  const contactTo = dateFilter(params.get("lastContactTo"), true);
  const followFrom = dateFilter(params.get("followUpFrom"));
  const followTo = dateFilter(params.get("followUpTo"), true);
  const dateFilters = [[createdFrom, "createdFrom"], [createdTo, "createdTo"], [contactFrom, "lastContactFrom"], [contactTo, "lastContactTo"], [followFrom, "followUpFrom"], [followTo, "followUpTo"]] as const;
  const invalidDate = dateFilters.find(([date]) => date === false);
  if (invalidDate) return apiError(400, "INVALID_DATE", `Enter a valid ${invalidDate[1]} date.`);
  if (createdFrom && createdTo && createdFrom > createdTo) return apiError(400, "INVALID_DATE_RANGE", "Created start date must be on or before its end date.");
  if (contactFrom && contactTo && contactFrom > contactTo) return apiError(400, "INVALID_DATE_RANGE", "Last contact start date must be on or before its end date.");
  if (followFrom && followTo && followFrom > followTo) return apiError(400, "INVALID_DATE_RANGE", "Follow-up start date must be on or before its end date.");

  const age = params.get("age");
  const followUpStatus = params.get("followUpStatus");
  const duplicateStatus = params.get("duplicateStatus");
  const verificationStatus = params.get("verificationStatus");
  if (age && !ageRanges.includes(age)) return apiError(400, "INVALID_AGE_RANGE", "Choose a valid lead age range.");
  if (followUpStatus && !followUpStates.includes(followUpStatus)) return apiError(400, "INVALID_FOLLOW_UP_STATUS", "Choose Pending, Overdue or Completed.");
  if (duplicateStatus && !["PENDING", "CONFIRMED_DUPLICATE", "DISMISSED", "NONE"].includes(duplicateStatus)) return apiError(400, "INVALID_DUPLICATE_STATUS", "Choose a valid duplicate review status.");
  if (verificationStatus && !Object.values(VerificationItemStatus).includes(verificationStatus as VerificationItemStatus)) return apiError(400, "INVALID_VERIFICATION_STATUS", "Choose a valid verification status.");

  const assignedToId = params.get("assignedToId")?.trim() || undefined;
  const assignmentStatus = params.get("assignmentStatus");
  if (assignedToId && assignmentStatus) return apiError(400, "CONFLICTING_ASSIGNMENT_FILTERS", "Filter by an executive or assignment status, not both.");
  if (auth.role === "SALES_EXECUTIVE" && (assignedToId || assignmentStatus === "UNASSIGNED")) return apiError(403, "FORBIDDEN", "You can only view your assigned leads.");
  if (assignmentStatus && !["ASSIGNED", "UNASSIGNED"].includes(assignmentStatus)) return apiError(400, "INVALID_ASSIGNMENT_STATUS", "Choose assigned or unassigned.");
  if (assignedToId && auth.role === "SUPER_ADMIN") {
    const executive = await prisma.user.findFirst({ where: { id: assignedToId, role: "SALES_EXECUTIVE" }, select: { id: true } });
    if (!executive) return apiError(400, "INVALID_ASSIGNEE", "Choose a valid Sales Executive.");
  }
  const state = params.get("state")?.trim().slice(0, 100);
  const city = params.get("city")?.trim().slice(0, 100);
  const productId = params.get("productId")?.trim();
  const lostOnly = params.get("lostOnly") === "true";
  const tag = params.get("tag")?.trim().replace(/\s+/g, " ").slice(0, 64);
  if (productId && !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) return apiError(400, "INVALID_PRODUCT", "Choose a valid product.");

  const now = new Date();
  const createdAt: Prisma.DateTimeFilter = {};
  if (createdFrom) createdAt.gte = createdFrom;
  if (createdTo) createdAt.lte = createdTo;
  const maxLowerBound = (current: Date | string | undefined, next: Date): Date | string => !current || next > new Date(current) ? next : current;
  const minUpperBound = (current: Date | string | undefined, next: Date): Date | string => !current || next < new Date(current) ? next : current;
  if (age === "0-7") createdAt.gte = maxLowerBound(createdAt.gte, new Date(now.getTime() - 7 * 86400000));
  if (age === "8-15") { createdAt.gte = maxLowerBound(createdAt.gte, new Date(now.getTime() - 15 * 86400000)); createdAt.lt = minUpperBound(createdAt.lt, new Date(now.getTime() - 7 * 86400000)); }
  if (age === "16-30") { createdAt.gte = maxLowerBound(createdAt.gte, new Date(now.getTime() - 30 * 86400000)); createdAt.lt = minUpperBound(createdAt.lt, new Date(now.getTime() - 15 * 86400000)); }
  if (age === "30+") createdAt.lt = minUpperBound(createdAt.lt, new Date(now.getTime() - 30 * 86400000));
  const dueAt: Prisma.DateTimeFilter = {};
  if (followFrom) dueAt.gte = followFrom;
  if (followTo) dueAt.lte = followTo;
  if (followUpStatus === "OVERDUE") dueAt.lt = now;
  if (followUpStatus === "PENDING") dueAt.gte = now;
  const where: Prisma.LeadWhereInput = {
    mergedIntoLeadId: null,
    ...(auth.role === "SALES_EXECUTIVE" ? { assignedToId: auth.id } : {}),
    ...(auth.role === "SUPER_ADMIN" && assignedToId ? { assignedToId } : {}),
    ...(auth.role === "SUPER_ADMIN" && assignmentStatus === "UNASSIGNED" ? { assignedToId: null } : {}),
    ...(auth.role === "SUPER_ADMIN" && assignmentStatus === "ASSIGNED" ? { assignedToId: { not: null } } : {}),
    ...(sourceValue ? { source: sourceValue as LeadSource } : {}),
    ...(stageValue ? { stage: stageValue as LeadStage } : {}),
    ...(priorityValue ? { priority: priorityValue as LeadPriority } : {}),
    ...(state ? { state: { contains: state, mode: "insensitive" } } : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(contactFrom || contactTo ? { lastContactAt: { ...(contactFrom ? { gte: contactFrom } : {}), ...(contactTo ? { lte: contactTo } : {}) } } : {}),
    ...(followFrom || followTo || followUpStatus ? { followUps: { some: { ...(followUpStatus === "COMPLETED" ? { status: "COMPLETED" } : followUpStatus ? { status: "PENDING", ...(Object.keys(dueAt).length ? { dueAt } : {}) } : { status: "PENDING", ...(Object.keys(dueAt).length ? { dueAt } : {}) }) } } } : {}),
    ...(verificationStatus ? { verificationChecks: { some: { status: verificationStatus as VerificationItemStatus } } } : {}),
    ...(productId ? { leadProducts: { some: { productId } } } : {}),
    ...(tag ? { leadTags: { some: { tag: { normalizedName: tag.toLowerCase() } } } } : {}),
    ...(lostOnly ? { lostHistory: { some: {} } } : {}),
    ...(duplicateStatus === "NONE" ? { AND: [{ NOT: { duplicateMatchesAsA: { some: { status: { in: ["PENDING", "CONFIRMED_DUPLICATE"] }, leadB: { mergedIntoLeadId: null } } } } }, { NOT: { duplicateMatchesAsB: { some: { status: { in: ["PENDING", "CONFIRMED_DUPLICATE"] }, leadA: { mergedIntoLeadId: null } } } } }] } : duplicateStatus ? { AND: [{ OR: [{ duplicateMatchesAsA: { some: { status: duplicateStatus as "PENDING" | "CONFIRMED_DUPLICATE" | "DISMISSED", leadB: { mergedIntoLeadId: null } } } }, { duplicateMatchesAsB: { some: { status: duplicateStatus as "PENDING" | "CONFIRMED_DUPLICATE" | "DISMISSED", leadA: { mergedIntoLeadId: null } } } }] }] } : {}),
    ...(search ? { OR: [
      { businessName: { contains: search, mode: "insensitive" } },
      { buyerName: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
      { gstin: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };

  const sortBy = params.get("sortBy") ?? "createdAt";
  const sortDirection = params.get("sortDirection") ?? "desc";
  if (!sortFields.includes(sortBy) || !["asc", "desc"].includes(sortDirection)) return apiError(400, "INVALID_SORT", "Choose a valid sort field and direction.");
  const direction = sortDirection as Prisma.SortOrder;
  const scalarSort = sortBy === "leadAge" ? { createdAt: direction === "desc" ? "asc" : "desc" } : sortBy === "nextFollowUpDate" ? { createdAt: "desc" } : { [sortBy]: direction };
  const orderBy = [scalarSort, { id: "asc" }] as Prisma.LeadOrderByWithRelationInput[];
  const skip = (page - 1) * pageSize;
  try {
    if (sortBy === "nextFollowUpDate") {
      const conditions: Prisma.Sql[] = [];
      conditions.push(Prisma.sql`l."mergedIntoLeadId" IS NULL`);
      if (auth.role === "SALES_EXECUTIVE") conditions.push(Prisma.sql`l."assignedToId" = ${auth.id}`);
      if (auth.role === "SUPER_ADMIN" && assignedToId) conditions.push(Prisma.sql`l."assignedToId" = ${assignedToId}`);
      if (auth.role === "SUPER_ADMIN" && assignmentStatus === "UNASSIGNED") conditions.push(Prisma.sql`l."assignedToId" IS NULL`);
      if (auth.role === "SUPER_ADMIN" && assignmentStatus === "ASSIGNED") conditions.push(Prisma.sql`l."assignedToId" IS NOT NULL`);
      if (sourceValue) conditions.push(Prisma.sql`l."source" = ${sourceValue}::"LeadSource"`);
      if (stageValue) conditions.push(Prisma.sql`l."stage" = ${stageValue}::"LeadStage"`);
      if (priorityValue) conditions.push(Prisma.sql`l."priority" = ${priorityValue}::"LeadPriority"`);
      if (state) conditions.push(Prisma.sql`l."state" ILIKE ${`%${state}%`}`);
      if (city) conditions.push(Prisma.sql`l."city" ILIKE ${`%${city}%`}`);
      if (Object.keys(createdAt).length) { if (createdAt.gte) conditions.push(Prisma.sql`l."createdAt" >= ${createdAt.gte}`); if (createdAt.lt) conditions.push(Prisma.sql`l."createdAt" < ${createdAt.lt}`); if (createdAt.lte) conditions.push(Prisma.sql`l."createdAt" <= ${createdAt.lte}`); }
      if (contactFrom) conditions.push(Prisma.sql`l."lastContactAt" >= ${contactFrom}`);
      if (contactTo) conditions.push(Prisma.sql`l."lastContactAt" <= ${contactTo}`);
      if (search) { const term = `%${search}%`; conditions.push(Prisma.sql`(l."referenceNumber" ILIKE ${term} OR l."businessName" ILIKE ${term} OR l."buyerName" ILIKE ${term} OR l."mobile" ILIKE ${term} OR l."email" ILIKE ${term} OR l."gstin" ILIKE ${term})`); }
      if (productId) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "LeadProduct" lp WHERE lp."leadId"=l.id AND lp."productId"=${productId})`);
      if (tag) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "LeadTagAssignment" lta JOIN "LeadTag" t ON t.id=lta."tagId" WHERE lta."leadId"=l.id AND t."normalizedName"=${tag.toLowerCase()})`);
      if (lostOnly) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "LeadLostHistory" lh WHERE lh."leadId"=l.id)`);
      if (duplicateStatus === "NONE") conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "LeadDuplicateMatch" dm JOIN "Lead" other ON other.id=CASE WHEN dm."leadAId"=l.id THEN dm."leadBId" ELSE dm."leadAId" END WHERE (dm."leadAId"=l.id OR dm."leadBId"=l.id) AND other."mergedIntoLeadId" IS NULL AND dm.status IN ('PENDING'::"DuplicateReviewStatus",'CONFIRMED_DUPLICATE'::"DuplicateReviewStatus"))`);
      else if (duplicateStatus) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "LeadDuplicateMatch" dm JOIN "Lead" other ON other.id=CASE WHEN dm."leadAId"=l.id THEN dm."leadBId" ELSE dm."leadAId" END WHERE (dm."leadAId"=l.id OR dm."leadBId"=l.id) AND other."mergedIntoLeadId" IS NULL AND dm.status=${duplicateStatus}::"DuplicateReviewStatus")`);
      if (verificationStatus) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "LeadVerificationCheck" vc WHERE vc."leadId"=l.id AND vc.status=${verificationStatus}::"VerificationItemStatus")`);
      if (followUpStatus === "COMPLETED") conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "LeadFollowUp" f WHERE f."leadId"=l.id AND f.status='COMPLETED'::"FollowUpStatus"${followFrom ? Prisma.sql` AND f."dueAt">=${followFrom}` : Prisma.empty}${followTo ? Prisma.sql` AND f."dueAt"<=${followTo}` : Prisma.empty})`);
      else if (followUpStatus || followFrom || followTo) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "LeadFollowUp" f WHERE f."leadId"=l.id AND f.status='PENDING'::"FollowUpStatus"${followUpStatus === "OVERDUE" ? Prisma.sql` AND f."dueAt"<${now}` : Prisma.empty}${followUpStatus === "PENDING" ? Prisma.sql` AND f."dueAt">=${now}` : Prisma.empty}${followFrom ? Prisma.sql` AND f."dueAt">=${followFrom}` : Prisma.empty}${followTo ? Prisma.sql` AND f."dueAt"<=${followTo}` : Prisma.empty})`);
      const directionSql = sortDirection === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC");
      const sorted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT l.id FROM "Lead" l ${conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty} ORDER BY (SELECT MIN(f."dueAt") FROM "LeadFollowUp" f WHERE f."leadId"=l.id AND f.status='PENDING'::"FollowUpStatus") ${directionSql} NULLS LAST, l.id ASC LIMIT ${pageSize} OFFSET ${skip}`);
      const [rows, total] = await Promise.all([prisma.lead.findMany({ where: { ...where, id: { in: sorted.map(row => row.id) } }, select: { id: true, referenceNumber: true, businessName: true, buyerName: true, mobile: true, email: true, city: true, state: true, source: true, stage: true, priority: true, createdAt: true, updatedAt: true, assignedAt: true, lastContactAt: true, assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }, followUps: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 1, select: { dueAt: true, status: true } }, leadTags: { select: { tag: { select: { id: true, name: true, normalizedName: true } } } }, duplicateMatchesAsA: { where: { leadB: { mergedIntoLeadId: null } }, select: { id: true, status: true, confidence: true } }, duplicateMatchesAsB: { where: { leadA: { mergedIntoLeadId: null } }, select: { id: true, status: true, confidence: true } }, ...(lostOnly ? { lostHistory: { orderBy: { lostAt: "desc" }, take: 1, select: { reason: true, lostAt: true, competitorName: true, priceObjection: true, reactivationDueAt: true, reactivatedAt: true, reactivationStage: true } } } : {}), leadProducts: { select: { productId: true, productNameSnapshot: true, skuSnapshot: true, requestedQuantity: true } } } }), prisma.lead.count({ where })]);
      const byId = new Map(rows.map(row => [row.id, row]));
      return apiSuccess({ items: sorted.map(row => byId.get(row.id)).filter(Boolean), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
    }
    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: {
          id: true, referenceNumber: true, businessName: true, buyerName: true, mobile: true, email: true, city: true, state: true,
          source: true, stage: true, priority: true, createdAt: true, updatedAt: true, assignedAt: true, lastContactAt: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          followUps: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 1, select: { dueAt: true, status: true } },
          leadTags: { select: { tag: { select: { id: true, name: true, normalizedName: true } } } },
          duplicateMatchesAsA: { where: { leadB: { mergedIntoLeadId: null } }, select: { id: true, status: true, confidence: true } },
          duplicateMatchesAsB: { where: { leadA: { mergedIntoLeadId: null } }, select: { id: true, status: true, confidence: true } },
          ...(lostOnly ? { lostHistory: { orderBy: { lostAt: "desc" }, take: 1, select: { reason: true, lostAt: true, competitorName: true, priceObjection: true, reactivationDueAt: true, reactivatedAt: true, reactivationStage: true } } } : {}),
          leadProducts: { select: { productId: true, productNameSnapshot: true, skuSnapshot: true, requestedQuantity: true } },
        },
        orderBy: sortBy === "nextFollowUpDate" ? [{ createdAt: "desc" }, { id: "asc" }] : orderBy,
        skip, take: pageSize,
      }),
      prisma.lead.count({ where }),
    ]);
    return apiSuccess({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error("Admin lead list retrieval failed", error);
    return apiError(500, "LEADS_LOAD_FAILED", "Leads could not be loaded right now.");
  }
}
