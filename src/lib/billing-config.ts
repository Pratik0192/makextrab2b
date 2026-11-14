import { Prisma, type RoundingMethod } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export const companySettingsFields = ["legalBusinessName", "tradeName", "logoUrl", "logoPublicId", "registeredAddress", "state", "stateCode", "pincode", "country", "contactNumber", "officialEmail", "pan", "gstin", "registrationDetails", "invoiceHeaderName", "bankDetails", "footerNotes", "termsAndConditions", "defaultPlaceOfSupply", "freightLabel", "packingLabel"] as const;
const companyLimits: Record<(typeof companySettingsFields)[number], number> = { legalBusinessName: 200, tradeName: 200, logoUrl: 1000, logoPublicId: 255, registeredAddress: 2000, state: 100, stateCode: 10, pincode: 20, country: 80, contactNumber: 40, officialEmail: 254, pan: 10, gstin: 15, registrationDetails: 1000, invoiceHeaderName: 200, bankDetails: 2000, footerNotes: 3000, termsAndConditions: 5000, defaultPlaceOfSupply: 100, freightLabel: 80, packingLabel: 80 };

export function parseCompanySettings(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Settings must be an object.");
  const input = body as Record<string, unknown>; const data: Record<string, unknown> = {};
  for (const key of companySettingsFields) if (key in input) {
    const value = input[key];
    if (value !== null && typeof value !== "string") throw new Error(`${key} must be text.`);
    const normalized = typeof value === "string" ? value.trim() : null;
    if (normalized && normalized.length > companyLimits[key]) throw new Error(`${key} is too long.`);
    data[key] = normalized || null;
  }
  for (const key of ["officialEmail", "pan", "gstin", "stateCode"] as const) {
    const value = data[key]; if (typeof value !== "string" || !value) continue;
    data[key] = value.toUpperCase();
  }
  if (typeof data.officialEmail === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.officialEmail)) throw new Error("Enter a valid official email address.");
  if (typeof data.pan === "string" && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.pan)) throw new Error("PAN format is invalid. This check does not verify PAN with a government service.");
  if (typeof data.gstin === "string" && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(data.gstin)) throw new Error("GSTIN format is invalid. This check does not verify GSTIN with a government service.");
  if ("roundingPrecision" in input) { const n = input.roundingPrecision; if (!Number.isInteger(n) || Number(n) < 0 || Number(n) > 4) throw new Error("Rounding precision must be between 0 and 4 decimal places."); data.roundingPrecision = n; }
  if ("roundingMethod" in input) { if (!["HALF_UP", "HALF_EVEN", "DOWN", "UP"].includes(String(input.roundingMethod))) throw new Error("Unsupported rounding method."); data.roundingMethod = input.roundingMethod; }
  return data;
}

export function parsePercent(value: unknown, field: string, max = 100): Prisma.Decimal {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(`${field} must be a decimal number.`);
  const result = new Prisma.Decimal(value);
  if (!result.isFinite() || result.isNegative() || result.gt(max)) throw new Error(`${field} must be between 0 and ${max}.`);
  return result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundingMode(method: RoundingMethod) {
  switch (method) {
    case "HALF_EVEN": return Prisma.Decimal.ROUND_HALF_EVEN;
    case "DOWN": return Prisma.Decimal.ROUND_DOWN;
    case "UP": return Prisma.Decimal.ROUND_UP;
    default: return Prisma.Decimal.ROUND_HALF_UP;
  }
}

export async function nextConfiguredDocumentNumber(configId: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ value: number; prefix: string; suffix: string | null; fy: string; branchCode: string | null }>>`
      UPDATE "DocumentNumberingConfig" d SET "currentSequence" = GREATEST(d."currentSequence", d."startingSequence" - 1) + 1, "updatedAt" = CURRENT_TIMESTAMP
      FROM "FinancialYear" f WHERE d."id" = ${configId} AND d."financialYearId" = f."id" AND d."isActive" = true AND f."isActive" = true
      RETURNING d."currentSequence" AS value, d."prefix", d."suffix", d."branchCode", f."name" AS fy`;
    const row = rows[0]; if (!row) throw new Error("No active numbering configuration exists for the active financial year.");
    return `${row.prefix}${row.fy}${row.branchCode ? `-${row.branchCode}` : ""}-${String(row.value).padStart(6, "0")}${row.suffix ?? ""}`;
  }, { isolationLevel: "Serializable" });
}

export async function auditBilling(actorId: string, entity: "COMPANY_SETTINGS" | "GST_RATE" | "HSN_SAC" | "PRODUCT_TAX" | "FINANCIAL_YEAR" | "NUMBERING_CONFIG" | "CHARGE_CONFIG", entityId: string, action: string, changes?: Prisma.InputJsonValue) {
  await prisma.billingAuditEvent.create({ data: { actorId, entity, entityId, action, changes } });
}
