export type LeadSource = "WEBSITE" | "WHATSAPP" | "MANUAL" | "PHONE" | "SOCIAL_CAMPAIGN" | "REFERRAL" | "WALK_IN" | "EXISTING_CUSTOMER" | "IMPORT";
export type LeadStage = "NEW" | "ASSIGNED" | "CONTACT_ATTEMPTED" | "CONTACTED" | "VERIFICATION_PENDING" | "QUALIFIED" | "QUOTATION_ORDER_DISCUSSION" | "CONVERTED" | "LOST" | "ON_HOLD";
export type LeadBusinessType = "WHOLESALER" | "RETAILER" | "BOUTIQUE" | "DISTRIBUTOR" | "RESELLER" | "OTHER";
export type LeadContactMethod = "PHONE" | "WHATSAPP" | "EMAIL";
export type LeadPaymentMode = "BANK_TRANSFER" | "UPI" | "OTHER" | "NOT_DECIDED";
export type LeadPriority = "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT";

export interface LeadProductInput {
  productId: string;
  requestedQuantity: number;
}

export interface CreateLeadRequest {
  idempotencyKey: string;
  businessName: string;
  businessType: LeadBusinessType;
  gstin: string;
  website: string;
  socialMediaUrl: string;
  buyerName: string;
  mobile: string;
  whatsappNumber: string;
  email: string;
  preferredContactMethod: LeadContactMethod;
  city: string;
  state: string;
  pincode: string;
  country: string;
  businessAddress: string;
  estimatedOrderValue: string;
  preferredPaymentMode: LeadPaymentMode | "";
  deliveryAddress: string;
  notes: string;
  consentToContact: boolean;
  consentToPrivacyPolicy: boolean;
  informationAccuracyConfirmed: boolean;
  productInterests: LeadProductInput[];
}

export interface LeadListItem {
  id: string;
  referenceNumber: string;
  businessName: string;
  buyerName: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  source: LeadSource;
  stage: LeadStage;
  priority: LeadPriority;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null;
  assignedAt?: string | null;
  followUps?: Array<{ dueAt: string }>;
  leadTags?: Array<{ tag: { id: string; name: string; normalizedName?: string } }>;
  duplicateMatchesAsA?: Array<{id:string;status:string;confidence:string}>;
  duplicateMatchesAsB?: Array<{id:string;status:string;confidence:string}>;
  lostHistory?: Array<{reason:string;lostAt:string;competitorName:string|null;priceObjection:string|null;reactivationDueAt:string|null;reactivatedAt:string|null;reactivationStage:string|null}>;
  leadProducts: Array<{ productNameSnapshot: string; skuSnapshot: string; requestedQuantity: number }>;
}

export interface LeadDetail extends Omit<LeadListItem, "leadProducts" | "lostHistory"> {
  leadTags?: Array<{ tag: { id: string; name: string; normalizedName: string } }>;
  lostHistory?: Array<{id:string;reason:string;notes:string|null;competitorName:string|null;priceObjection:string|null;lostAt:string;lostById:string;reactivationDueAt:string|null;reactivatedAt:string|null;reactivatedById:string|null;reactivationNote:string|null;reactivationStage:string|null;reactivationFollowUpId:string|null}>;
  mergedLeads?: Array<{id:string;referenceNumber:string;mergedAt:string|null;mergedById:string|null;mergeSnapshot:unknown}>;
  assignedToId?: string | null;
  assignedAt?: string | null;
  lastContactAt?: string | null;
  buyerApprovalStatus?: string;
  buyerApprovalReason?: string | null;
  documents?: Array<{id:string;documentType:string;originalFileName:string;mimeType:string;fileSize:number;scanStatus:string;uploadedAt:string}>;
  verificationChecks?: Array<{id:string;checkType:string;status:string;remarks:string|null;updatedAt:string;updatedBy:{firstName:string;lastName:string}}>
  activities?: Array<{id:string;activityType:string;description:string;outcome:string|null;createdAt:string;createdBy:{firstName:string;lastName:string}|null}>
  followUps?: Array<{id:string;dueAt:string;note:string;status:string;outcome:string|null}>
  businessType: LeadBusinessType;
  gstin: string | null;
  website: string | null;
  socialMediaUrl: string | null;
  whatsappNumber: string | null;
  preferredContactMethod: LeadContactMethod;
  pincode: string;
  country: string;
  businessAddress: string | null;
  estimatedTotalQuantity: number | null;
  estimatedOrderValue: string | number | null;
  preferredPaymentMode: LeadPaymentMode | null;
  deliveryAddress: string | null;
  notes: string | null;
  priority: LeadPriority;
  consentToContact: boolean;
  consentToPrivacyPolicy: boolean;
  informationAccuracyConfirmed: boolean;
  consentedAt: string;
  updatedAt: string;
  leadProducts: Array<{
    id: string;
    productId: string | null;
    productNameSnapshot: string;
    skuSnapshot: string;
    requestedQuantity: number;
    product: { images: Array<{ imageUrl: string; altText: string | null }> } | null;
  }>;
}
