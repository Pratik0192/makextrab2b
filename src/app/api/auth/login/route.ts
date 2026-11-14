import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AUTH_COOKIE_NAME,
  clearAuthCookies,
  clearRateLimit,
  createAuthToken,
  getRequestRateLimitKey,
  getSessionCookieOptions,
  verifyPassword,
  verifyUnknownAccountPassword,
  consumeRateLimit,
} from "@/lib/auth";
import type { LoginRequest, LoginResponse, AuthApiError } from "@/types/auth";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const rateLimitKey = getRequestRateLimitKey(request, "admin-login");
  const rate = consumeRateLimit(rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json<AuthApiError>(
      { error: "Too many sign-in attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
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

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 128 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json<AuthApiError>({ error: "Enter a valid email and password." }, { status: 400 });
  }
  const credentials: LoginRequest = { email, password };

  try {
    const user = await prisma.user.findUnique({ where: { email: credentials.email } });
    if (!user) {
      await verifyUnknownAccountPassword(credentials.password);
      return NextResponse.json<AuthApiError>({ error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.isActive) {
      await verifyPassword(credentials.password, user.passwordHash);
      return NextResponse.json<AuthApiError>({ error: "Invalid email or password." }, { status: 401 });
    }

    const passwordMatches = await verifyPassword(credentials.password, user.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json<AuthApiError>({ error: "Invalid email or password." }, { status: 401 });
    }

    if (user.role !== "SUPER_ADMIN" && user.role !== "SALES_EXECUTIVE") {
      return NextResponse.json<AuthApiError>(
        { error: "This account does not have admin workspace access." },
        { status: 403 },
      );
    }

    const loggedInUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    const response = NextResponse.json<LoginResponse>({
      success: true,
      message: "Login successful.",
      user: loggedInUser,
    });
    const token = createAuthToken(loggedInUser);
    clearAuthCookies(response);
    response.cookies.set(AUTH_COOKIE_NAME, token, getSessionCookieOptions());
    clearRateLimit(rateLimitKey);
    return response;
  } catch (error) {
    console.error("Admin login failed.", error);
    return NextResponse.json<AuthApiError>({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
