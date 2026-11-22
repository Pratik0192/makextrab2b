import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { issueInvoice } from "@/lib/invoices";
import { InvoicePdfGenerationError, InvoicePdfStorageError } from "@/lib/invoice-pdf-storage";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can issue an invoice." }, { status: 403 });
  try { const { id } = await params; const item = await issueInvoice(id, user.id); return NextResponse.json({ item }); } catch (error) {
    if (error instanceof InvoicePdfGenerationError) {
      console.error("[invoice-pdf] Initial generation failed", error);
      return NextResponse.json({ error: "The invoice PDF could not be generated. The invoice was not issued." }, { status: 500 });
    }
    if (error instanceof InvoicePdfStorageError) {
      console.error("[invoice-pdf] Initial storage failed", error);
      return NextResponse.json({ error: "The invoice PDF could not be stored. The invoice was not issued." }, { status: 502 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice issue failed." }, { status: 400 });
  }
}
