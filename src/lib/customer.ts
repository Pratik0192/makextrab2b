import { prisma } from "@/lib/prisma";

export async function nextCustomerCode() {
  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('customer_code_seq'::regclass) AS value`;
  return `MXT-CUST-${rows[0].value.toString().padStart(6, "0")}`;
}
