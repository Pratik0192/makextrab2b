import { randomBytes, createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  const users = await prisma.user.findMany({ where: { role: "SALES_EXECUTIVE" }, orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true, createdAt: true, _count: { select: { assignedLeads: true } } } });
  return apiSuccess({ items: users });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  let body: unknown; try { body = await request.json(); } catch { return apiError(400, "INVALID_BODY", "Submit valid account details."); }
  if (!body || typeof body !== "object") return apiError(400, "INVALID_BODY", "Submit valid account details.");
  const input = body as Record<string, unknown>;
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim().slice(0, 30) : null;
  if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError(400, "VALIDATION_ERROR", "Enter a first name, last name and valid email address.");
  const token = randomBytes(32).toString("base64url");
  try {
    const user = await prisma.user.create({ data: { firstName, lastName, email, phone: phone || null, passwordHash: await hashPassword(randomBytes(40).toString("base64url")), role: "SALES_EXECUTIVE", isActive: false, activationTokenHash: createHash("sha256").update(token).digest("hex"), activationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true, createdAt: true } });
    return apiSuccess({ user, activationToken: token }, 201);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return apiError(409, "EMAIL_EXISTS", "An account with this email already exists.");
    console.error("Sales Executive creation failed", error); return apiError(500, "USER_CREATE_FAILED", "The account could not be created.");
  }
}
