"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getPublicProducts } from "@/services/product.service";
import { createLead } from "@/services/lead.service";
import type { Product } from "@/types/product";
import type { CreateLeadRequest } from "@/types/lead";

type FormValues = Omit<CreateLeadRequest, "idempotencyKey" | "productInterests">;
type ProductInterest = { product: Product; requestedQuantity: number };

const emptyForm: FormValues = {
  businessName: "", businessType: "RETAILER", gstin: "", website: "", socialMediaUrl: "",
  buyerName: "", mobile: "", whatsappNumber: "", email: "", preferredContactMethod: "PHONE",
  city: "", state: "", pincode: "", country: "India", businessAddress: "",
  estimatedOrderValue: "", preferredPaymentMode: "", deliveryAddress: "", notes: "",
  consentToContact: false, consentToPrivacyPolicy: false, informationAccuracyConfirmed: false,
};

const inputClass = "mt-1 h-10 w-full rounded-md border border-[#e4d8cd] bg-white px-3 text-sm text-[#382929] outline-none transition focus:border-[#9a7547] focus:ring-2 focus:ring-[#9a7547]/15 aria-invalid:border-rose-500 aria-invalid:ring-1 aria-invalid:ring-rose-300";
const labelClass = "block text-xs font-medium text-[#634849]";

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: ReactElement }) {
  return <label className={labelClass} data-field={name}>{label}{children}<span id={`${name}-error`} className="mt-1 block min-h-4 text-[11px] font-normal text-rose-700" role={error ? "alert" : undefined}>{error ?? ""}</span></label>;
}

function initialInterests(product?: Product): ProductInterest[] {
  return product ? [{ product, requestedQuantity: 10 }] : [];
}

function getErrorInfo(error: unknown): { message: string; details: Record<string, string> } {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: { message?: string; details?: Record<string, string> } } } }).response;
    const value = response?.data?.error;
    if (value?.message) return { message: value.message, details: value.details ?? {} };
  }
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return { message: "We couldn't reach the server. Check your connection and try again.", details: {} };
  }
  return { message: "We couldn't submit your enquiry. Please try again.", details: {} };
}

export default function WholesaleEnquiryForm({ trigger, initialProduct }: { trigger: ReactElement; initialProduct?: Product }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({ ...emptyForm });
  const [interests, setInterests] = useState<ProductInterest[]>(() => initialInterests(initialProduct));
  const [productOptions, setProductOptions] = useState<Product[]>(initialProduct ? [initialProduct] : []);
  const [productQuery, setProductQuery] = useState("");
  const [productChoice, setProductChoice] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [gstCertificate, setGstCertificate] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const submitLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const gstCertificateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setProductsLoading(true);
      setProductsError("");
      try {
        const result = await getPublicProducts({ page: 1, pageSize: 50, search: productQuery.trim() || undefined });
        if (!cancelled) {
          const byId = new Map(result.items.map((product) => [product.id, product]));
          if (initialProduct) byId.set(initialProduct.id, initialProduct);
          setProductOptions(Array.from(byId.values()));
        }
      } catch {
        if (!cancelled) setProductsError("Products couldn't be loaded right now. You can still submit a general enquiry.");
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }, productQuery ? 220 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, productQuery, initialProduct]);

  const totalQuantity = useMemo(() => interests.reduce((total, item) => total + item.requestedQuantity, 0), [interests]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setFormError("");
  }

  function focusFirstError(fieldErrors: Record<string, string>) {
    const firstKey = Object.keys(fieldErrors).find((key) => fieldErrors[key]);
    if (!firstKey) return;
    window.setTimeout(() => {
      const target = Array.from(formRef.current?.querySelectorAll<HTMLElement>("[data-field]") ?? []).find((element) => element.dataset.field === firstKey || (firstKey.startsWith("productInterests.") && element.dataset.field === firstKey));
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
    }, 0);
  }

  function addProduct() {
    const product = productOptions.find((item) => item.id === productChoice);
    if (!product) return;
    if (interests.some((item) => item.product.id === product.id)) {
      setFormError("That product is already in your enquiry.");
      return;
    }
    if (interests.length >= 20) {
      setFormError("You can enquire about up to 20 products at a time.");
      return;
    }
    setInterests((current) => [...current, { product, requestedQuantity: 10 }]);
    setProductChoice("");
    setFormError("");
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const [key, label] of [["businessName", "Business name"], ["buyerName", "Buyer name"], ["mobile", "Mobile number"], ["email", "Email"], ["city", "City"], ["state", "State"], ["pincode", "PIN code"], ["country", "Country"]] as const) {
      if (!values[key].trim()) next[key] = `${label} is required.`;
    }
    if (!values.businessType) next.businessType = "Please select a business type.";
    if (!values.preferredContactMethod) next.preferredContactMethod = "Please select a contact method.";
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) next.email = "Please enter a valid email address.";
    if (values.mobile) { const mobile = values.mobile.trim(); const digits = mobile.replace(/\D/g, ""); if (!/^\+?[0-9\s()-]+$/.test(mobile) || digits.length < 7 || digits.length > 15) next.mobile = "Please enter a valid mobile number with 7 to 15 digits."; }
    if (values.pincode && (values.country.trim().toLowerCase() === "india" ? !/^[1-9][0-9]{5}$/.test(values.pincode.replace(/[\s-]/g, "")) : !/^[A-Za-z0-9][A-Za-z0-9 -]{1,13}[A-Za-z0-9]$/.test(values.pincode.trim()))) next.pincode = "Please enter a valid PIN code.";
    if (values.gstin && !/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9]Z[A-Za-z0-9]$/.test(values.gstin.trim())) next.gstin = "Enter a valid 15-character GSTIN, or leave this field blank.";
    if (values.estimatedOrderValue && (!/^\d{1,10}(?:\.\d{1,2})?$/.test(values.estimatedOrderValue) || Number(values.estimatedOrderValue) <= 0)) next.estimatedOrderValue = "Enter a positive value with up to two decimal places.";
    if (!values.consentToContact || !values.consentToPrivacyPolicy) next.consentToContact = "Please accept the Privacy Policy and consent to being contacted about this enquiry.";
    if (!values.informationAccuracyConfirmed) next.informationAccuracyConfirmed = "Please confirm that your information is accurate.";
    interests.forEach((item, index) => { if (!Number.isInteger(item.requestedQuantity) || item.requestedQuantity < 10) next[`productInterests.${index}.requestedQuantity`] = `Enter a quantity of at least 10 for ${item.product.name}.`; });
    setErrors(next);
    const firstError = Object.values(next).find(Boolean);
    if (firstError) {
      setFormError("");
      focusFirstError(next);
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || saving || !validate()) return;
    submitLock.current = true;
    setSaving(true);
    setFormError("");
    setErrors({});
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const result = await createLead({
        ...values,
        idempotencyKey: idempotencyKey.current,
        productInterests: interests.map(({ product, requestedQuantity }) => ({ productId: product.id, requestedQuantity })),
      }, gstCertificate);
      toast.success("Enquiry submitted", { description: `Your reference number is ${result.data.referenceNumber}.` });
      setValues({ ...emptyForm });
      setGstCertificate(null);
      setDocumentError("");
      if (gstCertificateInputRef.current) gstCertificateInputRef.current.value = "";
      setInterests(initialInterests(initialProduct));
      setErrors({});
      setOpen(false);
      idempotencyKey.current = null;
    } catch (error) {
      const info = getErrorInfo(error);
      setFormError(Object.keys(info.details).length ? "" : info.message);
      setErrors(info.details);
      if (Object.keys(info.details).length) focusFirstError(info.details);
      else toast.error("Enquiry not submitted", { description: info.message });
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-lg border-[#e5d9cc] bg-[#fbf9f5] p-0 text-[#342424] sm:w-[calc(100%-2rem)]">
      <DialogHeader className="shrink-0 border-b border-[#e8ded2] px-5 py-5 pr-12 text-left sm:px-7">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#9a7547]">Nextra Wholesale</p>
        <DialogTitle className="mt-1 font-serif text-2xl font-normal text-[#452d2d]">Wholesale enquiry</DialogTitle>
        <DialogDescription className="text-xs leading-5 text-[#746866]">Tell us about your business and the styles you are looking for. We’ll follow up using your preferred contact method.</DialogDescription>
      </DialogHeader>
      <form ref={formRef} onSubmit={(event) => void submit(event)} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7" noValidate>
        <section><h3 className="mb-3 font-serif text-lg text-[#452d2d]">Business information</h3><div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Business name *" name="businessName" error={errors.businessName}><input autoComplete="organization" className={inputClass} value={values.businessName} onChange={(event) => update("businessName", event.target.value)} aria-invalid={Boolean(errors.businessName)} /></Field>
          <Field label="Business type *" name="businessType" error={errors.businessType}><select className={inputClass} value={values.businessType} onChange={(event) => update("businessType", event.target.value as FormValues["businessType"])} aria-invalid={Boolean(errors.businessType)}><option value="">Select type</option><option value="WHOLESALER">Wholesaler</option><option value="RETAILER">Retailer</option><option value="BOUTIQUE">Boutique</option><option value="DISTRIBUTOR">Distributor</option><option value="RESELLER">Reseller</option><option value="OTHER">Other</option></select></Field>
          <Field label="GSTIN (optional)" name="gstin" error={errors.gstin}><input className={inputClass} value={values.gstin} maxLength={15} onChange={(event) => update("gstin", event.target.value.toUpperCase())} aria-invalid={Boolean(errors.gstin)} /></Field>
          <Field label="Website (optional)" name="website" error={errors.website}><input type="url" placeholder="https://example.com" className={inputClass} value={values.website} onChange={(event) => update("website", event.target.value)} aria-invalid={Boolean(errors.website)} /></Field>
          <Field label="Instagram / social media URL (optional)" name="socialMediaUrl" error={errors.socialMediaUrl}><input type="url" placeholder="https://instagram.com/yourbusiness" className={inputClass} value={values.socialMediaUrl} onChange={(event) => update("socialMediaUrl", event.target.value)} aria-invalid={Boolean(errors.socialMediaUrl)} /></Field>
        </div></section>

        <section><h3 className="mb-3 font-serif text-lg text-[#452d2d]">Contact information</h3><div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Buyer name *" name="buyerName" error={errors.buyerName}><input autoComplete="name" className={inputClass} value={values.buyerName} onChange={(event) => update("buyerName", event.target.value)} aria-invalid={Boolean(errors.buyerName)} /></Field>
          <Field label="Mobile number *" name="mobile" error={errors.mobile}><input type="tel" autoComplete="tel" placeholder="+91 98765 43210" className={inputClass} value={values.mobile} onChange={(event) => update("mobile", event.target.value)} aria-invalid={Boolean(errors.mobile)} /></Field>
          <Field label="WhatsApp number (optional)" name="whatsappNumber" error={errors.whatsappNumber}><input type="tel" placeholder="Only if you wish to share it" className={inputClass} value={values.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} aria-invalid={Boolean(errors.whatsappNumber)} /></Field>
          <Field label="Email *" name="email" error={errors.email}><input type="email" autoComplete="email" className={inputClass} value={values.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} /></Field>
          <Field label="Preferred contact method *" name="preferredContactMethod" error={errors.preferredContactMethod}><select className={inputClass} value={values.preferredContactMethod} onChange={(event) => update("preferredContactMethod", event.target.value as FormValues["preferredContactMethod"])} aria-invalid={Boolean(errors.preferredContactMethod)}><option value="PHONE">Phone</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></select></Field>
        </div></section>

        <section><h3 className="mb-3 font-serif text-lg text-[#452d2d]">Business location</h3><div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="City *" name="city" error={errors.city}><input autoComplete="address-level2" className={inputClass} value={values.city} onChange={(event) => update("city", event.target.value)} aria-invalid={Boolean(errors.city)} /></Field>
          <Field label="State *" name="state" error={errors.state}><input autoComplete="address-level1" className={inputClass} value={values.state} onChange={(event) => update("state", event.target.value)} aria-invalid={Boolean(errors.state)} /></Field>
          <Field label="PIN code *" name="pincode" error={errors.pincode}><input autoComplete="postal-code" className={inputClass} value={values.pincode} onChange={(event) => update("pincode", event.target.value)} aria-invalid={Boolean(errors.pincode)} /></Field>
          <Field label="Country *" name="country" error={errors.country}><input autoComplete="country-name" className={inputClass} value={values.country} onChange={(event) => update("country", event.target.value)} aria-invalid={Boolean(errors.country)} /></Field>
          <div className="sm:col-span-2"><Field label="Business address (optional)" name="businessAddress" error={errors.businessAddress}><textarea rows={2} className="mt-1 w-full rounded-md border border-[#e4d8cd] bg-white p-3 text-sm outline-none focus:border-[#9a7547]" value={values.businessAddress} onChange={(event) => update("businessAddress", event.target.value)} /></Field></div>
        </div></section>

        <section data-field="gstCertificate"><h3 className="mb-2 font-serif text-lg text-[#452d2d]">GST certificate <span className="font-sans text-xs text-[#827572]">(optional)</span></h3><p className="mb-2 text-[11px] text-[#827572]">PDF, JPG or PNG, up to 5 MB. GSTIN is not required.</p><input ref={gstCertificateInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0] ?? null; setDocumentError(""); setErrors((current) => ({ ...current, gstCertificate: "" })); if (file && (file.size > 5 * 1024 * 1024 || !/\.(pdf|jpe?g|png)$/i.test(file.name))) { setDocumentError("Choose a PDF, JPG or PNG up to 5 MB."); event.currentTarget.value = ""; setGstCertificate(null); return; } setGstCertificate(file); }} className="block w-full text-xs" />{gstCertificate && <div className="mt-2 flex items-center gap-3 text-xs"><span className="truncate">{gstCertificate.name}</span><button type="button" onClick={() => { setGstCertificate(null); if (gstCertificateInputRef.current) gstCertificateInputRef.current.value = ""; setErrors((current) => ({ ...current, gstCertificate: "" })); }} className="text-rose-700">Remove</button><span className="text-slate-500">Ready to upload</span></div>}{(documentError || errors.gstCertificate) && <p role="alert" className="mt-1 text-xs text-rose-700">{documentError || errors.gstCertificate}</p>}</section>

        <section data-field="productInterests"><h3 className="font-serif text-lg text-[#452d2d]">Product interest</h3><p className="mb-3 text-[11px] text-[#827572]">Product selection is optional. Each product has a minimum order quantity of 10.</p>
          {interests.map((item, index) => {
            const image = item.product.images.find((entry) => entry.isPrimary) ?? item.product.images[0];
            const quantityError = errors[`productInterests.${index}.requestedQuantity`];
            return <div key={item.product.id} className="mb-2 flex items-center gap-3 rounded-md border border-[#e8ded2] bg-white p-2.5">
              {image ? <img src={image.imageUrl} alt={image.altText ?? item.product.name} className="h-14 w-12 shrink-0 rounded object-cover" /> : <div className="h-14 w-12 shrink-0 rounded bg-[#eee5dc]" />}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.product.name}</p><p className="text-[10px] uppercase tracking-wider text-[#9a7547]">SKU {item.product.sku}</p></div>
              <label data-field={`productInterests.${index}.requestedQuantity`} className="w-[100px] shrink-0 text-[10px] text-[#746866]">Quantity<input type="number" min={10} max={1_000_000} step={1} value={item.requestedQuantity} onChange={(event) => { const quantity = Number(event.target.value); setInterests((current) => current.map((entry) => entry.product.id === item.product.id ? { ...entry, requestedQuantity: quantity } : entry)); setErrors((current) => ({ ...current, [`productInterests.${index}.requestedQuantity`]: "" })); }} className="mt-1 h-9 w-full rounded border border-[#e4d8cd] bg-white px-2 text-sm aria-invalid:border-rose-500" aria-invalid={Boolean(quantityError)} /><span className="text-[10px] text-rose-700">{quantityError}</span></label>
              <button type="button" aria-label={`Remove ${item.product.name}`} onClick={() => setInterests((current) => current.filter((entry) => entry.product.id !== item.product.id))} className="rounded p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16} /></button>
            </div>;
          })}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search active products" className="h-10 min-w-0 flex-1 rounded-md border border-[#e4d8cd] bg-white px-3 text-sm" aria-label="Search active products" /><select value={productChoice} onChange={(event) => setProductChoice(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-[#e4d8cd] bg-white px-3 text-sm" aria-label="Choose a product"><option value="">{productsLoading ? "Loading products…" : "Select a product to add"}</option>{productOptions.filter((product) => !interests.some((item) => item.product.id === product.id)).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select><button type="button" onClick={addProduct} disabled={!productChoice} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#7a4e4e] px-4 text-xs font-medium text-[#542d30] disabled:opacity-40"><Plus size={14} /> Add product</button></div>
          {productsError && <p role="status" className="mt-2 text-[11px] text-amber-800">{productsError}</p>}
          {errors.productInterests && <p role="alert" className="mt-2 text-[11px] text-rose-700">{errors.productInterests}</p>}
          <p className="mt-3 text-xs text-[#634849]">Estimated total quantity: <strong>{interests.length ? totalQuantity.toLocaleString("en-IN") : "Add product quantities to calculate"}</strong></p>
        </section>

        <section><h3 className="mb-3 font-serif text-lg text-[#452d2d]">Order intent</h3><div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Estimated order value (optional)" name="estimatedOrderValue" error={errors.estimatedOrderValue}><input type="number" min="0.01" step="0.01" placeholder="Enter only if known" className={inputClass} value={values.estimatedOrderValue} onChange={(event) => update("estimatedOrderValue", event.target.value)} aria-invalid={Boolean(errors.estimatedOrderValue)} /></Field>
          <Field label="Preferred payment mode (optional)" name="preferredPaymentMode" error={errors.preferredPaymentMode}><select className={inputClass} value={values.preferredPaymentMode} onChange={(event) => update("preferredPaymentMode", event.target.value as FormValues["preferredPaymentMode"])}><option value="">Not specified</option><option value="BANK_TRANSFER">Bank transfer</option><option value="UPI">UPI</option><option value="OTHER">Other</option><option value="NOT_DECIDED">Not decided</option></select></Field>
          <div className="sm:col-span-2"><Field label="Delivery address (optional)" name="deliveryAddress" error={errors.deliveryAddress}><textarea rows={2} className="mt-1 w-full rounded-md border border-[#e4d8cd] bg-white p-3 text-sm outline-none focus:border-[#9a7547]" value={values.deliveryAddress} onChange={(event) => update("deliveryAddress", event.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Additional notes (optional)" name="notes" error={errors.notes}><textarea rows={3} placeholder="Share anything that would help us understand your requirement." className="mt-1 w-full rounded-md border border-[#e4d8cd] bg-white p-3 text-sm outline-none focus:border-[#9a7547]" value={values.notes} onChange={(event) => update("notes", event.target.value)} /></Field></div>
        </div></section>

        <section className="space-y-3 border-t border-[#e8ded2] pt-4">
          <label data-field="consentToContact" className="flex items-start gap-2 text-xs leading-5 text-[#634849]"><input type="checkbox" aria-invalid={Boolean(errors.consentToContact)} checked={values.consentToContact && values.consentToPrivacyPolicy} onChange={(event) => { update("consentToContact", event.target.checked); update("consentToPrivacyPolicy", event.target.checked); }} className="mt-1 accent-[#9D174D]" /><span>I agree to the Privacy Policy and consent to Nextra Wholesale contacting me regarding this enquiry. *</span></label>
          {errors.consentToContact && <p role="alert" className="text-[11px] text-rose-700">{errors.consentToContact}</p>}
          <label className="flex items-start gap-2 text-xs leading-5 text-[#634849]"><input type="checkbox" checked={values.informationAccuracyConfirmed} onChange={(event) => update("informationAccuracyConfirmed", event.target.checked)} className="mt-1 accent-[#9D174D]" /><span>I confirm that the information provided is accurate. *</span></label>
          {errors.informationAccuracyConfirmed && <p role="alert" className="text-[11px] text-rose-700">{errors.informationAccuracyConfirmed}</p>}
        </section>

        {formError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{formError}</p>}
        <div className="sticky bottom-0 -mx-5 flex justify-end border-t border-[#e8ded2] bg-[#fbf9f5]/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7"><button type="submit" disabled={saving} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-sm bg-[#542d30] px-6 py-3 text-[10px] font-semibold uppercase tracking-[.14em] text-white disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />}{saving ? "Submitting…" : "Submit enquiry"}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
