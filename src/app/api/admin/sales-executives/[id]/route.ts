import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  const { id } = await context.params;
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit a valid account update."); }
  const isActive = body && typeof body === "object" ? (body as { isActive?: unknown }).isActive : undefined;
  if (typeof isActive !== "boolean") return apiError(400, "INVALID_STATUS", "Choose active or inactive status.");
  const user = await prisma.user.findFirst({ where: { id, role: "SALES_EXECUTIVE" }, select: { id: true } });
  if (!user) return apiError(404, "USER_NOT_FOUND", "Sales Executive could not be found.");
  if (!isActive) {
    const assignedCount = await prisma.lead.count({ where: { assignedToId: id } });
    if (assignedCount > 0) return apiError(409, "LEADS_ASSIGNED", `This executive has ${assignedCount} assigned lead(s). Reassign them before deactivation.`);
  }
  const updated = await prisma.user.update({ where: { id }, data: { isActive }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } });
  return apiSuccess(updated);
}
