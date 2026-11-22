const BUSINESS_TYPES = ["WHOLESALER", "RETAILER", "BOUTIQUE", "DISTRIBUTOR", "RESELLER", "OTHER"] as const;
const CONTACT_METHODS = ["PHONE", "WHATSAPP", "EMAIL"] as const;
const PAYMENT_MODES = ["BANK_TRANSFER", "UPI", "OTHER", "NOT_DECIDED"] as const;

export type LeadBusinessType = (typeof BUSINESS_TYPES)[number];
export type LeadContactMethod = (typeof CONTACT_METHODS)[number];
export type LeadPaymentMode = (typeof PAYMENT_MODES)[number];

export interface ParsedLeadSubmission {
  idempotencyKey?: string;
  businessName: string;
  businessType: LeadBusinessType;
  gstin: string | null;
  website: string | null;
  socialMediaUrl: string | null;
  buyerName: string;
  mobile: string;
  whatsappNumber: string | null;
  email: string;
  preferredContactMethod: LeadContactMethod;
  city: string;
  state: string;
  pincode: string;
  country: string;
  businessAddress: string | null;
  deliveryCity: string;
  deliveryState: string;
  deliveryPincode: string;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  estimatedOrderValue: string | null;
  preferredPaymentMode: LeadPaymentMode | null;
  deliveryAddress: string | null;
  notes: string | null;
  productInterests: Array<{ productId: string; requestedQuantity: number }>;
}

export interface LeadValidationResult {
  data: ParsedLeadSubmission | null;
  errors: Record<string, string>;
}

export function parseLeadSubmission(value: unknown): LeadValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { data: null, errors: { form: "Submit a valid enquiry form." } };
  }

  const input = value as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const getText = (key: string, label: string, maxLength: number, required: boolean) => {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === "") {
      if (required) errors[key] = `Please enter ${label.toLowerCase()}.`;
      return "";
    }
    if (typeof raw !== "string") {
      errors[key] = `${label} must be text.`;
      return "";
    }
    const text = raw.trim().replace(/\s+/g, " ");
    if (!text && required) errors[key] = `Please enter ${label.toLowerCase()}.`;
    else if (text.length > maxLength) errors[key] = `${label} must be ${maxLength} characters or fewer.`;
    return text;
  };
  const getOptionalText = (key: string, label: string, maxLength: number) => {
    const text = getText(key, label, maxLength, false);
    return text || null;
  };
  const getEnum = <T extends string>(key: string, label: string, values: readonly T[]): T | null => {
    const raw = input[key];
    if (typeof raw !== "string" || !values.includes(raw as T)) {
      errors[key] = `Please select a valid ${label.toLowerCase()}.`;
      return null;
    }
    return raw as T;
  };

  const businessName = getText("businessName", "Business name", 180, true);
  const businessType = getEnum("businessType", "Business type", BUSINESS_TYPES);
  const gstinRaw = getOptionalText("gstin", "GSTIN", 15);
  const gstin = gstinRaw?.toUpperCase() ?? null;
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)) errors.gstin = "Enter a valid 15-character GSTIN, or leave this field blank.";

  const website = parseUrl(input.website, "website", "Website", errors);
  const socialMediaUrl = parseUrl(input.socialMediaUrl, "socialMediaUrl", "Instagram or social media URL", errors);
  const buyerName = getText("buyerName", "Buyer name", 160, true);
  const mobile = normalizePhone(input.mobile, "mobile", "Mobile number", errors, true);
  const whatsappNumber = normalizePhone(input.whatsappNumber, "whatsappNumber", "WhatsApp number", errors, false);
  const email = getText("email", "Email", 254, true).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email address.";
  const preferredContactMethod = getEnum("preferredContactMethod", "preferred contact method", CONTACT_METHODS);
  const city = getText("city", "City", 100, true);
  const state = getText("state", "State", 100, true);
  const pincodeRaw = getText("pincode", "PIN code", 16, true);
  const country = getText("country", "Country", 100, true);
  const pincode = pincodeRaw.replace(/[\s-]/g, "").toUpperCase();
  if (pincode) {
    const valid = country.toLowerCase() === "india" ? /^[1-9][0-9]{5}$/.test(pincode) : /^[A-Z0-9][A-Z0-9 -]{1,13}[A-Z0-9]$/.test(pincode);
    if (!valid) errors.pincode = country.toLowerCase() === "india" ? "Enter a valid 6-digit Indian PIN code." : "Enter a valid postal code.";
  }

  const businessAddress = getText("businessAddress", "Billing address", 500, true);
  const estimatedOrderValue = parseOrderValue(input.estimatedOrderValue, errors);
  const paymentValue = input.preferredPaymentMode;
  let preferredPaymentMode: LeadPaymentMode | null = null;
  if (paymentValue !== undefined && paymentValue !== null && paymentValue !== "") {
    preferredPaymentMode = getEnum("preferredPaymentMode", "preferred payment mode", PAYMENT_MODES);
  }
  const deliveryAddress = getText("deliveryAddress", "Shipping address", 500, true);
  const deliveryCity = getText("deliveryCity", "Shipping city", 100, true);
  const deliveryState = getText("deliveryState", "Shipping state", 100, true);
  const deliveryPincodeRaw = getText("deliveryPincode", "Shipping postal code", 16, true);
  const deliveryPincode = deliveryPincodeRaw.replace(/[\s-]/g, "").toUpperCase();
  if (deliveryPincode) {
    const valid = country.toLowerCase() === "india" ? /^[1-9][0-9]{5}$/.test(deliveryPincode) : /^[A-Z0-9][A-Z0-9 -]{1,13}[A-Z0-9]$/.test(deliveryPincode);
    if (!valid) errors.deliveryPincode = country.toLowerCase() === "india" ? "Enter a valid 6-digit Indian shipping PIN code." : "Enter a valid shipping postal code.";
  }
  const deliveryContactName = getOptionalText("deliveryContactName", "Shipping contact person", 160);
  const deliveryContactPhone = normalizePhone(input.deliveryContactPhone, "deliveryContactPhone", "Shipping contact phone", errors, false);
  const notes = getOptionalText("notes", "Additional notes", 2000);

  const idempotencyKeyRaw = input.idempotencyKey;
  let idempotencyKey: string | undefined;
  if (idempotencyKeyRaw !== undefined && idempotencyKeyRaw !== null && idempotencyKeyRaw !== "") {
    if (typeof idempotencyKeyRaw !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKeyRaw)) {
      errors.idempotencyKey = "Refresh the form and try submitting again.";
    } else idempotencyKey = idempotencyKeyRaw.toLowerCase();
  }

  const interestsRaw = input.productInterests;
  const productInterests: ParsedLeadSubmission["productInterests"] = [];
  if (interestsRaw !== undefined) {
    if (!Array.isArray(interestsRaw) || interestsRaw.length > 20) {
      errors.productInterests = "Select no more than 20 products.";
    } else {
      const ids = new Set<string>();
      interestsRaw.forEach((entry, index) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
          errors.productInterests = "One of the selected products is invalid.";
          return;
        }
        const item = entry as Record<string, unknown>;
        if (typeof item.productId !== "string" || !item.productId.trim() || item.productId.length > 64 || ids.has(item.productId)) {
          errors.productInterests = "Remove invalid or duplicate products before submitting.";
          return;
        }
        ids.add(item.productId);
        if (typeof item.requestedQuantity !== "number" || !Number.isSafeInteger(item.requestedQuantity) || item.requestedQuantity < 10 || item.requestedQuantity > 1_000_000) {
          errors[`productInterests.${index}.requestedQuantity`] = "Each product quantity must be a whole number of at least 10.";
          return;
        }
        productInterests.push({ productId: item.productId, requestedQuantity: item.requestedQuantity });
      });
    }
  }

  if (input.consentToContact !== true || input.consentToPrivacyPolicy !== true) errors.consentToContact = "Please accept the Privacy Policy and consent to being contacted about this enquiry.";
  if (input.informationAccuracyConfirmed !== true) errors.informationAccuracyConfirmed = "Please confirm that the information provided is accurate.";

  if (Object.keys(errors).length) return { data: null, errors };
  return {
    data: {
      idempotencyKey,
      businessName,
      businessType: businessType!,
      gstin,
      website,
      socialMediaUrl,
      buyerName,
      mobile: mobile!,
      whatsappNumber,
      email,
      preferredContactMethod: preferredContactMethod!,
      city,
      state,
      pincode,
      country,
      businessAddress,
      deliveryCity,
      deliveryState,
      deliveryPincode,
      deliveryContactName,
      deliveryContactPhone,
      estimatedOrderValue,
      preferredPaymentMode,
      deliveryAddress,
      notes,
      productInterests,
    },
    errors: {},
  };
}

function normalizePhone(value: unknown, key: string, label: string, errors: Record<string, string>, required: boolean): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) errors[key] = `Please enter ${label.toLowerCase()}.`;
    return null;
  }
  if (typeof value !== "string") {
    errors[key] = `${label} must be text.`;
    return null;
  }
  const trimmed = value.trim();
  const normalized = trimmed.replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(normalized)) errors[key] = `Enter a valid ${label.toLowerCase()} with 7 to 15 digits.`;
  return normalized;
}

function parseUrl(value: unknown, key: string, label: string, errors: Record<string, string>): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    errors[key] = `${label} must be a valid web address.`;
    return null;
  }
  try {
    const url = new URL(value.trim());
    if (!(["http:", "https:"].includes(url.protocol)) || !url.hostname.includes(".")) throw new Error("Invalid URL");
    return url.toString();
  } catch {
    errors[key] = `Enter a valid ${label.toLowerCase()} starting with https://.`;
    return null;
  }
}

function parseOrderValue(value: unknown, errors: Record<string, string>): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    errors.estimatedOrderValue = "Estimated order value must be a positive amount.";
    return null;
  }
  const amount = String(value).trim();
  if (!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(amount) || Number(amount) <= 0) {
    errors.estimatedOrderValue = "Enter a positive estimated value with up to two decimal places.";
    return null;
  }
  return amount;
}
