import { NextRequest, NextResponse } from "next/server";
import { getPrivateLeadDocumentUrl } from "@/lib/cloudinary";
import { isAuthFailure, requireLeadOwnership, requireLeadUser } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; documentId: string }> }) {
  const user = await requireLeadUser(request); if (isAuthFailure(user)) return user;
  const { id, documentId } = await context.params;
  const ownsLead = await requireLeadOwnership(user, id);
  const ownsConvertedCustomer = user.role === "SALES_EXECUTIVE" && await prisma.customer.findFirst({ where: { convertedFromLeadId: id, assignedSalesExecutiveId: user.id }, select: { id: true } });
  if (!ownsLead && !ownsConvertedCustomer) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const document = await prisma.leadDocument.findFirst({ where: { id: documentId, leadId: id }, select: { providerFileId: true, originalFileName: true, mimeType: true } });
  if (!document || !extensions[document.mimeType]) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  try {
    const url = await getPrivateLeadDocumentUrl(document.providerFileId, extensions[document.mimeType]);
    const stored = await fetch(url, { cache: "no-store", redirect: "error" });
    if (!stored.ok || !stored.body) return NextResponse.json({ error: "Document unavailable." }, { status: 502 });
    const filename = document.originalFileName.replace(/[\\"\r\n]/g, "_").slice(-120);
    return new NextResponse(stored.body, { headers: { "Content-Type": document.mimeType, "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox" } });
  } catch { return NextResponse.json({ error: "Document unavailable." }, { status: 502 }); }
}
