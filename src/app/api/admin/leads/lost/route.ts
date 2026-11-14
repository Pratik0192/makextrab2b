import { NextRequest } from "next/server";
import { LeadLostReason, Prisma } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, positiveInteger, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

function day(value: string | null, end = false): Date | null | false {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value ? false : parsed;
}

export async function GET(request: NextRequest) {
  const auth = await requireLeadUser(request); if (isAuthFailure(auth)) return auth;
  const p = request.nextUrl.searchParams;
  const page = positiveInteger(p.get("page"), 1, 1_000_000);
  const pageSize = Number(p.get("pageSize") ?? 20);
  if (![10,20,50,100].includes(pageSize)) return apiError(400, "INVALID_PAGE_SIZE", "Choose 10, 20, 50 or 100 records per page.");
  const reason = p.get("reason");
  if (reason && !Object.values(LeadLostReason).includes(reason as LeadLostReason)) return apiError(400, "INVALID_LOST_REASON", "Choose a valid lost reason.");
  const lostFrom = day(p.get("lostFrom")); const lostTo = day(p.get("lostTo"), true);
  const reactivationFrom = day(p.get("reactivationFrom")); const reactivationTo = day(p.get("reactivationTo"), true);
  if ([lostFrom,lostTo,reactivationFrom,reactivationTo].includes(false)) return apiError(400, "INVALID_DATE", "Enter valid lost and reactivation dates.");
  if (lostFrom && lostTo && lostFrom > lostTo || reactivationFrom && reactivationTo && reactivationFrom > reactivationTo) return apiError(400, "INVALID_DATE_RANGE", "Each start date must be before its end date.");
  const status = p.get("reactivationStatus");
  if (status && !["OVERDUE","UPCOMING","SCHEDULED","NOT_SCHEDULED","REACTIVATED"].includes(status)) return apiError(400, "INVALID_REACTIVATION_STATUS", "Choose a valid reactivation status.");
  const now = new Date();
  const assignedToId = p.get("assignedToId")?.trim();
  if(assignedToId&&auth.role==="SUPER_ADMIN"&&!(await prisma.user.findFirst({where:{id:assignedToId,role:"SALES_EXECUTIVE"},select:{id:true}})))return apiError(400,"INVALID_ASSIGNEE","Choose a valid Sales Executive.");
  const search = p.get("search")?.trim().replace(/\s+/g," ").slice(0,100);
  const dueFilter: Prisma.DateTimeNullableFilter = {};
  if(reactivationFrom)dueFilter.gte=reactivationFrom;if(reactivationTo)dueFilter.lte=reactivationTo;
  if(status==="OVERDUE")dueFilter.lt=now;if(status==="UPCOMING")dueFilter.gte=now;
  if(status==="SCHEDULED")dueFilter.not=null;
  if(status==="NOT_SCHEDULED")dueFilter.equals=null;
  const lostHistory: Prisma.LeadLostHistoryWhereInput = {
    ...(reason ? {reason: reason as LeadLostReason}:{}),
    ...(lostFrom || lostTo ? {lostAt:{...(lostFrom?{gte:lostFrom}:{}),...(lostTo?{lte:lostTo}:{})}}:{}),
    ...(Object.keys(dueFilter).length ? {reactivationDueAt:dueFilter}:{}),
    ...(status === "OVERDUE" || status === "UPCOMING" ? {reactivatedAt:null} : {}),
    ...(status === "REACTIVATED" ? {reactivatedAt:{not:null}} : {}),
  };
  const where: Prisma.LeadWhereInput = {
    mergedIntoLeadId: null,
    ...(auth.role === "SALES_EXECUTIVE" ? {assignedToId:auth.id}:{}),
    lostHistory:{some:lostHistory},
    ...(assignedToId && auth.role === "SUPER_ADMIN" ? {assignedToId}:{}),
    ...(p.get("state")?.trim()?{state:{contains:p.get("state")!.trim().slice(0,100),mode:"insensitive"}}:{}),
    ...(p.get("city")?.trim()?{city:{contains:p.get("city")!.trim().slice(0,100),mode:"insensitive"}}:{}),
    ...(search?{OR:[{referenceNumber:{contains:search,mode:"insensitive"}},{businessName:{contains:search,mode:"insensitive"}},{buyerName:{contains:search,mode:"insensitive"}},{mobile:{contains:search}},{email:{contains:search,mode:"insensitive"}},{gstin:{contains:search,mode:"insensitive"}}]}:{}),
  };
  try {
    const [items,total] = await Promise.all([
      prisma.lead.findMany({where,orderBy:[{updatedAt:"desc"},{id:"asc"}],skip:(page-1)*pageSize,take:pageSize,select:{id:true,referenceNumber:true,businessName:true,buyerName:true,mobile:true,email:true,city:true,state:true,source:true,stage:true,priority:true,createdAt:true,updatedAt:true,lastContactAt:true,assignedAt:true,assignedTo:{select:{id:true,firstName:true,lastName:true,email:true}},leadProducts:{select:{productNameSnapshot:true,skuSnapshot:true,requestedQuantity:true}},leadTags:{select:{tag:{select:{id:true,name:true}}}},followUps:{where:{status:"PENDING"},orderBy:{dueAt:"asc"},take:1,select:{dueAt:true,status:true}},lostHistory:{where:lostHistory,orderBy:{lostAt:"desc"},take:1,select:{id:true,reason:true,notes:true,competitorName:true,priceObjection:true,lostAt:true,reactivationDueAt:true,reactivatedAt:true,reactivationNote:true,reactivationStage:true}}}}),
      prisma.lead.count({where}),
    ]);
    return apiSuccess({items,pagination:{page,pageSize,total,totalPages:Math.ceil(total/pageSize)}});
  } catch(error) { console.error("Lost leads retrieval failed",error); return apiError(500,"LOST_LEADS_LOAD_FAILED","Lost leads could not be loaded."); }
}
