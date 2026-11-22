import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function nextReference(sequence: "customer_code_seq" | "quotation_number_seq", prefix: "MXT-CUST" | "MXT-QTN") {
  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`SELECT nextval(${sequence}::regclass) AS value`;
  return `${prefix}-${rows[0].value.toString().padStart(6, "0")}`;
}

export function decimal(value: unknown, field: string): Prisma.Decimal {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(`${field} must be a number.`);
  if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new Error(`${field} must be a non-negative number.`);
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function jsonSafe<T>(value: T): T { return JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Prisma.Decimal ? item.toString() : item)) as T; }
