import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { nextCustomerCode } from "@/lib/customer";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin(request); if (isAuthFailure(user)) return user;
  const { id } = await params;
  let overrides: Record<string, unknown> = {};
  try { overrides = await request.json(); } catch { /* use the reviewed lead details */ }
  try {
    const result = await prisma.$transaction(async tx => {
      const lead = await tx.lead.findUnique({ where: { id }, include: { verificationChecks: true, customer: true } });
      if (!lead) throw new Error("Lead not found.");
      if (lead.customer) throw new Error(`Already converted to ${lead.customer.customerCode}.`);
      if (lead.mergedIntoLeadId) throw new Error("Merged leads cannot be converted.");
      if (lead.stage === "LOST") throw new Error("Lost leads cannot be converted. Reactivate the lead first.");
      if (lead.stage !== "QUALIFIED") throw new Error("Only QUALIFIED leads can be converted.");
      const missing: string[] = [];
      if (lead.buyerApprovalStatus !== "APPROVED") missing.push("Buyer approval must be APPROVED.");
      const checks = new Map(lead.verificationChecks.map(check => [check.checkType, check.status]));
      for (const [kind, label] of [["BUSINESS_DETAILS", "Business details"], ["CONTACT_DETAILS", "Contact details"], ["BUSINESS_LEGITIMACY", "Business legitimacy"]] as const) if (checks.get(kind) !== "VERIFIED") missing.push(`${label} verification must be VERIFIED.`);
      for (const check of lead.verificationChecks) if (check.status !== "VERIFIED" && check.status !== "NOT_APPLICABLE") missing.push(`${check.checkType.replaceAll("_", " ")} must be VERIFIED or NOT APPLICABLE.`);
      const text = (key: string, original: string | null | undefined) => typeof overrides[key] === "string" ? String(overrides[key]).trim() : original ?? "";
      const businessName=text("businessName",lead.businessName), buyerName=text("buyerName",lead.buyerName), mobile=text("mobile",lead.mobile), email=text("email",lead.email), city=text("city",lead.city), state=text("state",lead.state), pincode=text("pincode",lead.pincode), businessAddress=text("businessAddress",lead.businessAddress), deliveryAddress=text("deliveryAddress",lead.deliveryAddress), deliveryCity=text("deliveryCity",lead.deliveryCity), deliveryState=text("deliveryState",lead.deliveryState), deliveryPincode=text("deliveryPincode",lead.deliveryPincode);
      if (!businessName) missing.push("Business name is required.");
      if (!buyerName) missing.push("Buyer name is required.");
      if (!mobile) missing.push("Mobile number is required.");
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) missing.push("A valid email address is required.");
      const gstin=text("gstin",lead.gstin).toUpperCase();
      if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)) missing.push("GSTIN must be a valid 15-character GSTIN or left blank.");
      if (!city || !state || !pincode) missing.push("City, state and pincode are required.");
      if (!businessAddress) missing.push("Billing address is required.");
      if (!deliveryAddress || !deliveryCity || !deliveryState || !deliveryPincode) missing.push("Complete shipping address, city, state and postal code are required.");
      if (missing.length) throw new Error(missing.join(" "));
      const customerCode = await nextCustomerCode();
      const customer = await tx.customer.create({ data: {
        customerCode, businessName, businessType: lead.businessType, buyerName,
        mobile, whatsappNumber: text("whatsappNumber",lead.whatsappNumber)||null, email, gstin: gstin||null,
        website: lead.website, socialMediaUrl: lead.socialMediaUrl, businessAddress,
        city, state, pincode, country: text("country",lead.country)||"India",
        preferredContactMethod: lead.preferredContactMethod, preferredPaymentMode: lead.preferredPaymentMode,
        deliveryAddress, deliveryCity, deliveryState, deliveryPincode,
        deliveryContactName: text("deliveryContactName", lead.deliveryContactName) || buyerName,
        deliveryContactPhone: text("deliveryContactPhone", lead.deliveryContactPhone) || mobile,
        assignedSalesExecutiveId: lead.assignedToId,
        convertedFromLeadId: lead.id, convertedById: user.id,
      } });
      const changed = await tx.lead.updateMany({ where: { id, stage: "QUALIFIED", mergedIntoLeadId: null }, data: { stage: "CONVERTED" } });
      if (changed.count !== 1) throw new Error("Lead conversion raced with another update. Refresh and retry.");
      await tx.leadActivity.create({ data: { leadId: id, activityType: "LEAD_CONVERTED", description: `Converted to customer ${customer.customerCode}.`, createdById: user.id } });
      await tx.customerAuditEvent.create({ data: { customerId: customer.id, actorId: user.id, action: "CONVERTED_FROM_LEAD", details: { leadReference: lead.referenceNumber } } });
      return customer;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ success: true, customer: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not convert lead.";
    return NextResponse.json({ success: false, error: message }, { status: 409 });
  }
}
