import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "nextra_admin_session";
const LEGACY_COOKIE = "token";

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

function denyAdminRequest(request: NextRequest, status = 401): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: status === 403 ? "Super Admin access is required." : "Authentication required." },
      { status },
    );
  }
  const destination = request.nextUrl.clone();
  destination.pathname = "/";
  const response = NextResponse.redirect(destination);
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRequest = pathname.startsWith("/admin") || pathname.startsWith("/api/admin/");
  const isSalesPage = pathname === "/sales" || pathname.startsWith("/sales/");
  const isClientRequest = pathname.startsWith("/client");

  if (isAdminRequest) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) return denyAdminRequest(request);

    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey(), {
        issuer: "nextra-wholesale",
        audience: "nextra-admin",
      });
      if (typeof payload.sub !== "string") return denyAdminRequest(request);
      if (payload.role !== "SUPER_ADMIN" && payload.role !== "SALES_EXECUTIVE") return denyAdminRequest(request, 403);
      if (payload.role === "SALES_EXECUTIVE") {
        const allowedApi = pathname === "/api/admin/leads" || pathname.startsWith("/api/admin/leads/");
        if (!allowedApi) return denyAdminRequest(request, 403);
      }
      return NextResponse.next();
    } catch {
      return denyAdminRequest(request);
    }
  }

  if (isSalesPage) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) return denyAdminRequest(request);
    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey(), { issuer: "nextra-wholesale", audience: "nextra-admin" });
      if (typeof payload.sub !== "string") return denyAdminRequest(request);
      if (payload.role !== "SALES_EXECUTIVE") return denyAdminRequest(request, 403);
      return NextResponse.next();
    } catch { return denyAdminRequest(request); }
  }

  if (isClientRequest) {
    const token = request.cookies.get(LEGACY_COOKIE)?.value;
    if (!token) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/";
      return NextResponse.redirect(destination);
    }

    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey());
      if (payload.role === "CLIENT") return NextResponse.next();
    } catch {
      // Invalid legacy sessions fall through to the storefront redirect.
    }
    const destination = request.nextUrl.clone();
    destination.pathname = "/";
    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*", "/sales", "/sales/:path*", "/client", "/client/:path*"],
};
