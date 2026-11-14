import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { issueCreditNote } from "@/lib/invoices";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can issue credit notes." }, { status: 403 }); try { const { id } = await params; return NextResponse.json({ item: await issueCreditNote(id, user.id) }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Credit note issue failed." }, { status: 400 }); } }
