import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import type { AuthenticatedUser } from "@/types/auth";

export async function requireSuperAdmin(request: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return apiError(401, "UNAUTHENTICATED", "A valid Super Admin session is required.");
  if (user.role !== "SUPER_ADMIN") return apiError(403, "FORBIDDEN", "Super Admin access is required.");
  return user;
}

export async function requireLeadUser(request: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return apiError(401, "UNAUTHENTICATED", "A valid admin session is required.");
  if (user.role !== "SUPER_ADMIN" && user.role !== "SALES_EXECUTIVE") return apiError(403, "FORBIDDEN", "Lead workspace access is required.");
  return user;
}

export async function requireLeadOwnership(user: AuthenticatedUser, leadId: string): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const lead = await (await import("@/lib/prisma")).prisma.lead.findFirst({ where: { id: leadId, assignedToId: user.id }, select: { id: true } });
  return Boolean(lead);
}

export async function leadIsMerged(leadId: string): Promise<boolean> {
  const lead = await (await import("@/lib/prisma")).prisma.lead.findUnique({ where: { id: leadId }, select: { mergedIntoLeadId: true } });
  return Boolean(lead?.mergedIntoLeadId);
}

export function isAuthFailure(value: AuthenticatedUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
