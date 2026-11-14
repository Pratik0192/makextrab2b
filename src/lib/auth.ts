import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/types/auth";

export const AUTH_COOKIE_NAME = "nextra_admin_session";
export const AUTH_SESSION_SECONDS = 8 * 60 * 60;
const JWT_ISSUER = "nextra-wholesale";
const JWT_AUDIENCE = "nextra-admin";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: AUTH_SESSION_SECONDS,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

const dummyPasswordHash = bcrypt.hash("nextra-invalid-account-check", 12);

export async function verifyUnknownAccountPassword(password: string): Promise<void> {
  await bcrypt.compare(password, await dummyPasswordHash);
}

export function createAuthToken(user: Pick<AuthenticatedUser, "id" | "email" | "role">): string {
  return jwt.sign(
    { email: user.email, role: user.role },
    getJwtSecret(),
    {
      subject: user.id,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: AUTH_SESSION_SECONDS,
    },
  );
}

interface AuthTokenClaims extends JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export function verifyAuthToken(token: string): AuthTokenClaims | null {
  try {
    const claims = jwt.verify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (
      typeof claims === "string" ||
      typeof claims.sub !== "string" ||
      typeof claims.email !== "string" ||
      typeof claims.role !== "string"
    ) {
      return null;
    }
    return claims as AuthTokenClaims;
  } catch {
    return null;
  }
}

export async function getUserForAuthToken(token: string): Promise<AuthenticatedUser | null> {
  const claims = verifyAuthToken(token);
  if (!claims || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(claims.role)) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive || user.role !== claims.role || user.email !== claims.email) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  };
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? getUserForAuthToken(token) : null;
}

export async function getAuthenticatedUserFromRequest(
  request: NextRequest,
): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return token ? getUserForAuthToken(token) : null;
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", { ...getSessionCookieOptions(), maxAge: 0 });
  // Clear the legacy cookie too so logout removes sessions from the previous auth flow.
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateLimitBuckets.set(key, bucket);
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, item] of rateLimitBuckets) {
      if (item.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearRateLimit(key: string): void {
  rateLimitBuckets.delete(key);
}

export function getRequestRateLimitKey(request: NextRequest, purpose: string): string {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `${purpose}:${realIp || forwardedIp || "unknown"}`;
}
