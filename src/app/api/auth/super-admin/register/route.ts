import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { clearRateLimit, consumeRateLimit, getRequestRateLimitKey, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AuthApiError, RegisterSuperAdminResponse } from "@/types/auth";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeSecretMatch(provided: string, configured: string): boolean {
  const providedBuffer = Buffer.from(provided, "utf8");
  const configuredBuffer = Buffer.from(configured, "utf8");
  return providedBuffer.length === configuredBuffer.length && timingSafeEqual(providedBuffer, configuredBuffer);
}

function isStrongPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128 &&
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export async function POST(request: NextRequest) {
  const rateLimitKey = getRequestRateLimitKey(request, "super-admin-bootstrap");
  const rate = consumeRateLimit(rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json<AuthApiError>(
      { error: "Too many setup attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const setupSecret = process.env.SUPER_ADMIN_SETUP_SECRET;
  if (!setupSecret || Buffer.byteLength(setupSecret, "utf8") < 32) {
    return NextResponse.json<AuthApiError>({ error: "Super Admin setup is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<AuthApiError>({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json<AuthApiError>({ error: "Invalid request body." }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phoneProvided = body.phone !== undefined && body.phone !== null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const providedSecret = typeof body.setupSecret === "string" ? body.setupSecret : "";

  if (
    firstName.length < 1 || firstName.length > 80 || lastName.length < 1 || lastName.length > 80 ||
    !EMAIL_PATTERN.test(email) || email.length > 254 ||
    (phoneProvided && typeof body.phone !== "string") ||
    (phone !== undefined && phone.length > 30) || password.length === 0 || confirmPassword.length === 0 ||
    providedSecret.length === 0 || providedSecret.length > 512
  ) {
    return NextResponse.json<AuthApiError>({ error: "Check the required fields and try again." }, { status: 400 });
  }
  if (!safeSecretMatch(providedSecret, setupSecret)) {
    return NextResponse.json<AuthApiError>({ error: "Super Admin setup is unavailable." }, { status: 403 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json<AuthApiError>({ error: "Passwords do not match." }, { status: 400 });
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json<AuthApiError>(
      { error: "Use 12–128 characters with uppercase, lowercase, a number, and a symbol." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.$transaction(async (transaction) => {
      // Serialize concurrent bootstrap requests so only one can observe an empty admin table.
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(641920260511::bigint)
      `;

      const existingSuperAdmin = await transaction.user.findFirst({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
      });
      if (existingSuperAdmin) return "setup-closed" as const;

      const existingEmail = await transaction.user.findUnique({ where: { email }, select: { id: true } });
      if (existingEmail) return "email-taken" as const;

      await transaction.user.create({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          passwordHash,
          role: "SUPER_ADMIN",
          isActive: true,
        },
        select: { id: true },
      });
      return "created" as const;
    });

    if (result === "setup-closed") {
      return NextResponse.json<AuthApiError>({ error: "Super Admin setup has already been completed." }, { status: 409 });
    }
    if (result === "email-taken") {
      return NextResponse.json<AuthApiError>({ error: "An account with this email already exists." }, { status: 409 });
    }

    clearRateLimit(rateLimitKey);
    return NextResponse.json<RegisterSuperAdminResponse>({
      success: true,
      message: "Super Admin account created. You can now sign in.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json<AuthApiError>({ error: "An account with this email already exists." }, { status: 409 });
    }
    return NextResponse.json<AuthApiError>({ error: "Unable to complete Super Admin setup." }, { status: 500 });
  }
}
