import type { LeadStage } from "@/generated/prisma";

const transitions: Record<LeadStage, readonly LeadStage[]> = {
  NEW: ["ASSIGNED", "CONTACT_ATTEMPTED", "ON_HOLD", "LOST"],
  ASSIGNED: ["CONTACT_ATTEMPTED", "CONTACTED", "VERIFICATION_PENDING", "ON_HOLD", "LOST"],
  CONTACT_ATTEMPTED: ["CONTACTED", "VERIFICATION_PENDING", "ON_HOLD", "LOST"],
  CONTACTED: ["CONTACT_ATTEMPTED", "VERIFICATION_PENDING", "QUALIFIED", "ON_HOLD", "LOST"],
  VERIFICATION_PENDING: ["CONTACTED", "QUALIFIED", "ON_HOLD", "LOST"],
  QUALIFIED: ["QUOTATION_ORDER_DISCUSSION", "ON_HOLD", "LOST"],
  QUOTATION_ORDER_DISCUSSION: ["QUALIFIED", "ON_HOLD", "LOST"],
  CONVERTED: [],
  LOST: [],
  ON_HOLD: ["CONTACT_ATTEMPTED", "CONTACTED", "VERIFICATION_PENDING", "QUALIFIED", "QUOTATION_ORDER_DISCUSSION", "LOST"],
};

export function canTransitionLeadStage(current: LeadStage, next: LeadStage): boolean {
  return current === next || (next !== "CONVERTED" && transitions[current].includes(next));
}
