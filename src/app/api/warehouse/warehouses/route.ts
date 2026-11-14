import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(_request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.warehouse.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true, city: true, state: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ items });
}
