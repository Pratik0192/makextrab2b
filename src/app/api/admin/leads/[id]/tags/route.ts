import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, leadIsMerged, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
function normalizeTag(value: unknown): { name: string; normalizedName: string } | null { if (typeof value !== "string") return null; const name = value.trim().replace(/\s+/g, " "); if (!name || name.length > 64) return null; return { name, normalizedName: name.toLocaleLowerCase("en-US") }; }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user;
  const { id } = await context.params; if (!(await requireLeadOwnership(user, id))) return apiError(404, "LEAD_NOT_FOUND", "This lead could not be found.");
  if (await leadIsMerged(id)) return apiError(409, "LEAD_MERGED", "Merged leads cannot be edited; update the surviving lead.");
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit valid tag changes."); }
  if (!body || typeof body !== "object") return apiError(400, "INVALID_BODY", "Submit valid tag changes.");
  const input = body as Record<string, unknown>; const addRaw = input.add ?? []; const removeRaw = input.remove ?? [];
  if (!Array.isArray(addRaw) || !Array.isArray(removeRaw) || addRaw.length > 15 || removeRaw.length > 15) return apiError(400, "INVALID_TAGS", "Add or remove up to 15 tags at a time.");
  const add = addRaw.map(normalizeTag); const remove = removeRaw.map(normalizeTag);
  if (add.some(x=>!x) || remove.some(x=>!x)) return apiError(400, "INVALID_TAG", "Tags must contain 1–64 characters.");
  try {
    const result = await prisma.$transaction(async tx => {
      const changes: string[] = [];
      for (const tag of add as Array<{name:string;normalizedName:string}>) {
        const saved = await tx.leadTag.upsert({ where: { normalizedName: tag.normalizedName }, create: tag, update: {} });
        const link = await tx.leadTagAssignment.createMany({ data: [{ leadId: id, tagId: saved.id }], skipDuplicates: true });
        if (link.count) changes.push(`Added tag “${saved.name}”.`);
      }
      for (const tag of remove as Array<{name:string;normalizedName:string}>) {
        const deleted = await tx.leadTagAssignment.deleteMany({ where: { leadId: id, tag: { normalizedName: tag.normalizedName } } });
        if (deleted.count) changes.push(`Removed tag “${tag.name}”.`);
      }
      if (changes.length) await tx.leadActivity.create({ data: { leadId: id, activityType: "TAG_CHANGE", description: changes.join(" "), createdById: user.id } });
      return tx.leadTagAssignment.findMany({ where: { leadId: id }, select: { tag: { select: { id: true, name: true } } }, orderBy: { tag: { name: "asc" } } });
    });
    return apiSuccess({ tags: result.map(item=>item.tag) });
  } catch (error) { console.error("Lead tag update failed", error); return apiError(500, "TAGS_UPDATE_FAILED", "Lead tags could not be updated."); }
}
