import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { token, password } = body as { token?: unknown; password?: unknown };
  if (typeof token !== "string" || token.length > 100 || typeof password !== "string" || password.length < 12 || password.length > 128) return NextResponse.json({ error: "Use the activation link and a password of at least 12 characters." }, { status: 400 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({ where: { activationTokenHash: tokenHash, activationExpiresAt: { gt: new Date() }, role: "SALES_EXECUTIVE" }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "This activation link is invalid or expired." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), isActive: true, emailVerifiedAt: new Date(), activationTokenHash: null, activationExpiresAt: null } });
  return NextResponse.json({ success: true });
}
