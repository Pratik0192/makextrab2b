import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireSuperAdmin } from "@/lib/admin-api";
import { previewOrderTax, type SupplyTreatment } from "@/services/tax-calculation.service";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request); if (isAuthFailure(auth)) return auth;
  try { const body = await request.json(); if (typeof body.salesOrderId !== "string") throw new Error("Sales order is required."); if (body.supplyTreatment !== "INTRA_STATE" && body.supplyTreatment !== "INTER_STATE") throw new Error("Select a tax treatment after professional place-of-supply review."); if (body.charges !== undefined && (!Array.isArray(body.charges) || body.charges.length > 20)) throw new Error("Charges must be an array of up to 20 items."); const charges = (body.charges ?? []).map((item: any) => { if (!item || typeof item.configurationId !== "string") throw new Error("Each charge needs an active configuration."); return { configurationId: item.configurationId, amount: item.amount }; }); return NextResponse.json(await previewOrderTax(body.salesOrderId, body.supplyTreatment as SupplyTreatment, charges)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tax preview failed." }, { status: 400 }); }
}
