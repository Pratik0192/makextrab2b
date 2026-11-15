"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

type Preview = {
  rows: Array<any>;
  totals: Record<string, string>;
  dispatch: any;
  customer: any;
};
export default function GenerateDispatchInvoice({
  dispatchId,
  existingInvoiceId,
}: {
  dispatchId: string;
  existingInvoiceId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [treatment, setTreatment] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [chargeConfigs, setChargeConfigs] = useState<any[]>([]);
  const [chargeAmounts, setChargeAmounts] = useState<Record<string, string>>(
    {},
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open)
      api
        .get("/api/admin/settings/charges")
        .then((r) =>
          setChargeConfigs(r.data.items.filter((x: any) => x.isActive)),
        )
        .catch(() => setChargeConfigs([]));
  }, [open]);
  const charges = Object.entries(chargeAmounts)
    .filter(([, amount]) => amount.trim() !== "")
    .map(([configurationId, amount]) => ({ configurationId, amount }));
  const decision = {
    dispatchId,
    treatment,
    placeOfSupply,
    stateCode,
    reverseCharge,
    charges,
  };

  async function runPreview() {
    setError("");
    setPreview(null);
    if (!treatment)
      return setError("Select the authorized place-of-supply tax treatment.");
    if (!placeOfSupply.trim() || !/^\d{2}$/.test(stateCode))
      return setError(
        "Enter the professionally determined place of supply and two-digit state code.",
      );
    setBusy(true);
    try {
      const r = await api.post("/api/invoices/preview", decision);
      setPreview(r.data.preview);
    } catch (e: any) {
      setError(
        e.response?.data?.error || "Could not preview dispatch invoice.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    setError("");
    setBusy(true);
    try {
      const r = await api.post("/api/invoices", decision);
      router.push(`/admin/invoices/${r.data.item.id}`);
    } catch (e: any) {
      setError(e.response?.data?.error || "Could not create invoice draft.");
    } finally {
      setBusy(false);
    }
  }

  if (existingInvoiceId)
    return (
      <a
        className="text-sm underline"
        href={`/admin/invoices/${existingInvoiceId}`}
      >
        View invoice
      </a>
    );
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="rounded border border-[#9D174D] px-3 py-2 text-sm text-[#9D174D]"
      >
        Generate Invoice
      </button>
      {open && (
        <div className="mt-3 rounded border-l border-slate-300 bg-[#fffdfd] p-4">
          <p className="font-medium">Dispatch invoice preview</p>
          <p className="mt-1 text-xs text-slate-500">
            Invoice quantities and quoted prices come from the confirmed
            dispatch and Sales Order. Enter professionally reviewed
            place-of-supply details; the application does not infer statutory
            treatment.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Supply treatment
              <select
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                className="mt-1 block rounded border bg-white p-2"
              >
                <option value="">Select treatment</option>
                <option value="INTRA_STATE">Intra-state (CGST + SGST)</option>
                <option value="INTER_STATE">Inter-state (IGST)</option>
              </select>
            </label>
            <label className="text-sm">
              Place of supply
              <input
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                className="mt-1 block rounded border p-2 bg-white"
              />
            </label>
            <label className="text-sm">
              State code
              <input
                maxLength={2}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="mt-1 block w-24 rounded border p-2 bg-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reverseCharge}
                onChange={(e) => setReverseCharge(e.target.checked)}
              />
              Reverse charge
            </label>
            <button
              disabled={busy}
              onClick={() => void runPreview()}
              className="rounded bg-[#9D174D] px-3 py-2 text-sm text-white"
            >
              {busy ? "Loading…" : "Preview"}
            </button>
          </div>
          {chargeConfigs.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {chargeConfigs.map((c: any) => (
                <label key={c.id} className="text-sm">
                  {c.label}
                  {c.isTaxable ? " (taxable)" : ""}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional amount"
                    value={chargeAmounts[c.id] ?? ""}
                    onChange={(e) =>
                      setChargeAmounts({
                        ...chargeAmounts,
                        [c.id]: e.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded border p-2 bg-white"
                  />
                </label>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          {preview && (
            <>
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <p>Customer: {preview.customer.businessName}</p>
                <p>Dispatch: {preview.dispatch.reference}</p>
                <p>Order: {preview.dispatch.salesOrder.orderNumber}</p>
                <p>GSTIN: {preview.customer.gstin || "Not provided"}</p>
                <p>
                  Billing: {preview.customer.businessAddress},{" "}
                  {preview.customer.city}, {preview.customer.state}{" "}
                  {preview.customer.pincode}
                </p>
                <p>
                  Shipping:{" "}
                  {preview.dispatch.salesOrder.deliveryAddress ||
                    preview.customer.deliveryAddress ||
                    preview.customer.businessAddress}
                </p>
                <p>
                  Place of supply: {placeOfSupply} · State code {stateCode} ·{" "}
                  {treatment}
                </p>
              </div>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      {[
                        "Product / SKU",
                        "HSN",
                        "Ordered",
                        "Dispatched",
                        "Prior invoiced",
                        "This invoice",
                        "Remaining",
                        "Quoted / pc",
                        "Discount",
                        "Taxable",
                        "GST",
                        "Total",
                      ].map((x) => (
                        <th className="p-2" key={x}>
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr className="border-b" key={row.salesOrderItemId}>
                        <td className="p-2">
                          {row.productName} / {row.sku}
                        </td>
                        <td className="p-2">{row.hsnSacCode}</td>
                        <td className="p-2">{row.orderedQuantity}</td>
                        <td className="p-2">{row.dispatchedQuantity}</td>
                        <td className="p-2">
                          {row.previouslyInvoicedQuantity}
                        </td>
                        <td className="p-2">
                          {row.invoiceableQuantity} {row.uom}
                        </td>
                        <td className="p-2">{row.remainingQuantity}</td>
                        <td className="p-2">{row.quotedPriceSnapshot}</td>
                        <td className="p-2">{row.lineDiscount}</td>
                        <td className="p-2">{row.taxableValue}</td>
                        <td className="p-2">{row.gstRateSnapshot}%</td>
                        <td className="p-2">{row.lineTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 ml-auto max-w-sm space-y-1 text-right text-sm">
                <p>Taxable: ₹{preview.totals.taxableSubtotal}</p>
                <p>
                  CGST ₹{preview.totals.cgstTotal} · SGST ₹
                  {preview.totals.sgstTotal} · IGST ₹{preview.totals.igstTotal}{" "}
                  · Cess ₹{preview.totals.cessTotal}
                </p>
                <p>
                  Charges ₹{preview.totals.freightTotal} freight · ₹
                  {preview.totals.packingTotal} packing · ₹
                  {preview.totals.otherChargesTotal} other
                </p>
                <p>
                  Discount ₹{preview.totals.discountTotal} · Round-off ₹
                  {preview.totals.roundOff}
                </p>
                <p className="text-base font-semibold">
                  Invoice total ₹{preview.totals.grandTotal}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() => void createDraft()}
                className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm text-white"
              >
                Create invoice draft for review
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
