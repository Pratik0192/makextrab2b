import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { regenerateInvoicePdf } from "@/lib/invoices";
import { InvoicePdfGenerationError, InvoicePdfStorageError } from "@/lib/invoice-pdf-storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a Super Admin can regenerate an issued invoice PDF." }, { status: 403 });
  try {
    const body = await request.json();
    const { id } = await params;
    return NextResponse.json({ item: await regenerateInvoicePdf(id, String(body.reason ?? ""), user.id) });
  } catch (error) {
    if (error instanceof InvoicePdfStorageError) {
      console.error("[invoice-pdf] Regeneration storage failure", error);
      return NextResponse.json({ error: "The regenerated PDF could not be stored. The previous PDF version remains active." }, { status: 502 });
    }
    if (error instanceof InvoicePdfGenerationError) {
      console.error("[invoice-pdf] Regeneration generation failure", error);
      return NextResponse.json({ error: "The invoice PDF could not be generated. The previous PDF version remains active." }, { status: 500 });
    }
    console.error("[invoice-pdf] Regeneration request failed", error);
    const message = error instanceof Error ? error.message : "PDF regeneration failed.";
    const clientError = message.includes("reason is required") || message.includes("Only an issued invoice") || message.includes("draft") || message.includes("not found");
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 500 });
  }
}
