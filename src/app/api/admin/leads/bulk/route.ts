import { NextRequest } from "next/server";
import { LeadPriority, LeadStage } from "@/generated/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { canTransitionLeadStage } from "@/lib/lead-stage";
import { prisma } from "@/lib/prisma";

type Operation = "ASSIGN" | "PRIORITY" | "ADD_TAGS" | "REMOVE_TAGS" | "STAGE";
function normalizeTag(value: unknown) { if (typeof value !== "string") return null; const name=value.trim().replace(/\s+/g," "); return name && name.length<=64 ? {name,normalizedName:name.toLocaleLowerCase("en-US")} : null; }
export async function POST(request: NextRequest) {
  const actor=await requireSuperAdmin(request); if(isAuthFailure(actor))return actor;
  let body: unknown; try{body=await request.json()}catch{return apiError(400,"INVALID_BODY","Submit valid bulk action details.")}
  if(!body||typeof body!=="object")return apiError(400,"INVALID_BODY","Submit valid bulk action details.");
  const input=body as Record<string,unknown>; const operation=input.operation as Operation; const rawIds=input.leadIds;
  if(!["ASSIGN","PRIORITY","ADD_TAGS","REMOVE_TAGS","STAGE"].includes(operation))return apiError(400,"INVALID_OPERATION","Choose a supported bulk operation.");
  if(!Array.isArray(rawIds)||rawIds.length<1||rawIds.length>100||rawIds.some(id=>typeof id!=="string"||id.length>64))return apiError(400,"INVALID_LEADS","Select between 1 and 100 valid leads.");
  const ids=[...new Set(rawIds as string[])];
  const leads=await prisma.lead.findMany({where:{id:{in:ids}},select:{id:true,stage:true,priority:true,assignedToId:true,mergedIntoLeadId:true}});
  if(leads.length!==ids.length)return apiError(400,"LEAD_SELECTION_CHANGED","One or more selected leads no longer exist. Refresh and select again.");
  if(leads.some(lead=>lead.mergedIntoLeadId))return apiError(409,"LEAD_MERGED","Remove merged leads from the selection; update their surviving leads instead.");
  const results:Array<{leadId:string;status:"UPDATED"|"UNCHANGED"|"REJECTED";message?:string}> = [];
  try {
    if(operation==="ASSIGN"){
      const assignedToId=typeof input.assignedToId==="string"?input.assignedToId:"";
      const executive=await prisma.user.findFirst({where:{id:assignedToId,role:"SALES_EXECUTIVE",isActive:true},select:{id:true,firstName:true,lastName:true}});
      if(!executive)return apiError(400,"INVALID_ASSIGNEE","Choose an active Sales Executive.");
      await prisma.$transaction(async tx=>{for(const lead of leads){if(lead.assignedToId===executive.id){results.push({leadId:lead.id,status:"UNCHANGED",message:"Already assigned to this executive."});continue;}const previous=lead.assignedToId;await tx.lead.update({where:{id:lead.id},data:{assignedToId:executive.id,assignedById:actor.id,assignedAt:new Date(),...(lead.stage==="NEW"?{stage:"ASSIGNED"}:{})}});await tx.leadAssignment.create({data:{leadId:lead.id,assignedToId:executive.id,assignedById:actor.id,previousAssigneeId:previous,reason:typeof input.reason==="string"?input.reason.trim().slice(0,500):null}});await tx.leadActivity.create({data:{leadId:lead.id,activityType:"ASSIGNMENT",description:`${previous?"Reassigned":"Assigned"} to ${executive.firstName} ${executive.lastName} through a Super Admin bulk action.`,createdById:actor.id}});results.push({leadId:lead.id,status:"UPDATED"});}});
    } else if(operation==="PRIORITY"){
      const priority=input.priority;if(typeof priority!=="string"||!Object.values(LeadPriority).includes(priority as LeadPriority)||priority==="NORMAL")return apiError(400,"INVALID_PRIORITY","Choose LOW, MEDIUM, HIGH or URGENT.");
      await prisma.$transaction(async tx=>{for(const lead of leads){if(lead.priority===priority){results.push({leadId:lead.id,status:"UNCHANGED"});continue;}await tx.lead.update({where:{id:lead.id},data:{priority:priority as LeadPriority}});await tx.leadActivity.create({data:{leadId:lead.id,activityType:"PRIORITY_CHANGE",description:`Priority changed from ${lead.priority} to ${priority} through a Super Admin bulk action.`,createdById:actor.id}});results.push({leadId:lead.id,status:"UPDATED"});}});
    } else if(operation==="ADD_TAGS"||operation==="REMOVE_TAGS"){
      const names=input.tags;if(!Array.isArray(names)||names.length<1||names.length>15)return apiError(400,"INVALID_TAGS","Provide between 1 and 15 tags.");const tags=names.map(normalizeTag);if(tags.some(t=>!t))return apiError(400,"INVALID_TAG","Tags must contain 1–64 characters.");const clean=[...new Map((tags as Array<{name:string;normalizedName:string}>).map(t=>[t.normalizedName,t])).values()];
      await prisma.$transaction(async tx=>{for(const lead of leads){const changed:string[]=[];for(const tag of clean){if(operation==="ADD_TAGS"){const saved=await tx.leadTag.upsert({where:{normalizedName:tag.normalizedName},create:tag,update:{}});const added=await tx.leadTagAssignment.createMany({data:[{leadId:lead.id,tagId:saved.id}],skipDuplicates:true});if(added.count)changed.push(`Added ${saved.name}.`);}else{const removed=await tx.leadTagAssignment.deleteMany({where:{leadId:lead.id,tag:{normalizedName:tag.normalizedName}}});if(removed.count)changed.push(`Removed ${tag.name}.`);}}if(changed.length){await tx.leadActivity.create({data:{leadId:lead.id,activityType:"TAG_CHANGE",description:`${changed.join(" ")} Bulk action by Super Admin.`,createdById:actor.id}});results.push({leadId:lead.id,status:"UPDATED"});}else results.push({leadId:lead.id,status:"UNCHANGED",message:"No tag associations changed."});}});
    } else {
      const stage=input.stage;if(typeof stage!=="string"||!Object.values(LeadStage).includes(stage as LeadStage))return apiError(400,"INVALID_STAGE","Choose a valid pipeline stage.");if(stage==="CONVERTED")return apiError(409,"CONVERSION_WORKFLOW_REQUIRED","Bulk conversion is unavailable until the customer conversion workflow exists.");
      if(stage==="LOST")return apiError(409,"LOST_REASON_REQUIRED","Use the individual lost-lead workflow to record a reason and details.");
      for(const lead of leads){if(!canTransitionLeadStage(lead.stage,stage as LeadStage)){results.push({leadId:lead.id,status:"REJECTED",message:`Cannot move ${lead.stage} to ${stage}.`});continue;}if(stage===lead.stage){results.push({leadId:lead.id,status:"UNCHANGED"});continue;}await prisma.$transaction(async tx=>{await tx.lead.update({where:{id:lead.id},data:{stage:stage as LeadStage}});await tx.leadActivity.create({data:{leadId:lead.id,activityType:"STAGE_CHANGE",description:`Stage changed from ${lead.stage} to ${stage} through a Super Admin bulk action.`,createdById:actor.id}});});results.push({leadId:lead.id,status:"UPDATED"});}
    }
    return apiSuccess({operation,total:ids.length,updated:results.filter(r=>r.status==="UPDATED").length,unchanged:results.filter(r=>r.status==="UNCHANGED").length,failed:results.filter(r=>r.status==="REJECTED").length,results});
  } catch(error){console.error("Lead bulk operation failed",error);return apiError(500,"BULK_OPERATION_FAILED","The bulk action could not be completed.");}
}
