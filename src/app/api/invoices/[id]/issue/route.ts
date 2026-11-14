import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { issueInvoice } from "@/lib/invoices";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can issue an invoice." }, { status: 403 });
  try { const { id } = await params; const item = await issueInvoice(id, user.id); return NextResponse.json({ item }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Invoice issue failed." }, { status: 400 }); }
}
