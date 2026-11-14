"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import api from "@/lib/axios";

type Product = { id: string; name: string; sku: string; minimumOrderQuantity: number; wholesalePrice: string | null };
type Line = { quotationItemId?: string; productId: string; quantity: string; unitPrice: string; discount: string; catalogUnitPriceSnapshot?: string | null };

export default function QuotationDraftEditor() {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const router = useRouter();
  const base = path.startsWith("/sales") ? "/sales" : "/admin";
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [canOverride, setCanOverride] = useState(false);
  const [validUntil, setValid] = useState("");
  const [discountType, setDiscountType] = useState("FIXED");
  const [discountValue, setDiscountValue] = useState("0");
  const [paymentTerms, setPayment] = useState("");
  const [deliveryTerms, setDelivery] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/api/quotations/${id}`), api.get("/api/quotation-products"), api.get("/api/auth/session")])
      .then(([quotationResponse, productResponse, sessionResponse]) => {
        const quotation = quotationResponse.data;
        setLines(quotation.items.map((item: { id: string; productId: string | null; quantity: number; unitPrice: string; discount: string; catalogUnitPriceSnapshot: string | null }) => ({
          quotationItemId: item.id,
          productId: item.productId ?? "",
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          discount: String(item.discount),
          catalogUnitPriceSnapshot: item.catalogUnitPriceSnapshot,
        })));
        setValid(new Date(quotation.validUntil).toISOString().slice(0, 10));
        setDiscountType(quotation.discountType || "FIXED");
        setDiscountValue(String(quotation.discountValue));
        setPayment(quotation.paymentTerms || "");
        setDelivery(quotation.deliveryTerms || "");
        setCustomerNotes(quotation.customerNotes || "");
        setInternalNotes(quotation.internalNotes || "");
        setProducts(productResponse.data.items || []);
        setCanOverride(sessionResponse.data.data?.role === "SUPER_ADMIN");
      })
      .catch((caught) => setError(caught.response?.data?.error?.message || caught.response?.data?.error || "Could not load quotation draft."));
  }, [id]);

  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    setLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      if (line.productId === productId) return line;
      return { productId, quantity: line.quantity, unitPrice: product?.wholesalePrice ?? "", discount: line.discount };
    }));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/api/quotations/${id}/draft`, {
        validUntil,
        items: lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), discount: Number(line.discount) })),
        discountType,
        discountValue: Number(discountValue),
        paymentTerms,
        deliveryTerms,
        customerNotes,
        internalNotes,
      });
      router.push(`${base}/quotations/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? (caught as Error & { response?: { data?: { error?: string } } }).response?.data?.error ?? caught.message : "Draft could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const money = (amount: string | number) => `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h2 className="text-xl font-semibold">Edit quotation draft</h2><p className="text-sm text-slate-500">Existing quoted prices stay on copied items. New items use their current product price; only Super Admin can override a price.</p></div>
    {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <label className="block text-sm">Valid until<input type="date" value={validUntil} onChange={(event) => setValid(event.target.value)} className="mt-1 block rounded border p-2" /></label>
    <section className="space-y-3 rounded-lg border bg-white p-5"><h3 className="font-semibold">Products</h3>
      {lines.map((line, index) => {
        const product = products.find((item) => item.id === line.productId);
        return <div key={`${line.quotationItemId ?? "new"}-${index}`} className="grid gap-2 border-b py-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div><select value={line.productId} onChange={(event) => selectProduct(index, event.target.value)} className="w-full rounded border p-2 text-sm"><option value="">Select active product</option>{products.map((item) => <option key={item.id} value={item.id} disabled={!item.wholesalePrice && item.id !== line.productId}>{item.name} · {item.sku} · MOQ {item.minimumOrderQuantity} · {item.wholesalePrice ? `${money(item.wholesalePrice)}/piece` : "Price not configured"}</option>)}</select>
            {line.productId && <p className="mt-1 text-xs text-slate-500">Current product price: {product?.wholesalePrice ? money(product.wholesalePrice) : "Not configured"}. Existing quote price: {money(line.unitPrice)} per piece.</p>}</div>
          <input aria-label="Quantity" type="number" min={product?.minimumOrderQuantity ?? 1} step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} className="rounded border p-2" />
          <label className="text-xs">Quoted price / piece<input aria-label="Unit price" type="number" min="0.01" step="0.01" readOnly={!canOverride} value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: event.target.value } : item))} className="mt-1 w-full rounded border p-2 read-only:bg-slate-50" /></label>
          <input aria-label="Line discount" type="number" min="0" step="0.01" value={line.discount} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, discount: event.target.value } : item))} className="rounded border p-2" />
          <button onClick={() => setLines((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current)} className="text-sm text-rose-700">Remove</button>
        </div>;
      })}
      <button onClick={() => setLines((current) => [...current, { productId: "", quantity: "10", unitPrice: "", discount: "0" }])} className="text-sm underline">Add product</button>
    </section>
    <section className="grid gap-3 rounded-lg border bg-white p-5 md:grid-cols-2">
      <label className="text-sm">Discount type<select value={discountType} onChange={(event) => setDiscountType(event.target.value)} className="mt-1 block rounded border p-2"><option value="FIXED">Fixed</option><option value="PERCENT">Percent</option></select></label>
      <label className="text-sm">Discount<input type="number" min="0" step="0.01" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className="mt-1 block rounded border p-2" /></label>
      <label>Payment terms<textarea value={paymentTerms} onChange={(event) => setPayment(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <label>Delivery terms<textarea value={deliveryTerms} onChange={(event) => setDelivery(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <label>Customer notes<textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <label>Internal notes<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
    </section>
    <div className="flex justify-end gap-2"><button onClick={() => router.back()} className="rounded border px-4 py-2">Cancel</button><button disabled={busy} onClick={() => void save()} className="rounded bg-[#672f35] px-4 py-2 text-white">{busy ? "Saving…" : "Save draft"}</button></div>
  </div>;
}
