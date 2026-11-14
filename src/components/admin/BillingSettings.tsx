"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";

const tabs = [
  ["/admin/settings/company", "Company profile"],
  ["/admin/settings/gst", "GST rates"],
  ["/admin/settings/hsn", "HSN / SAC"],
  ["/admin/settings/product-tax", "Product tax mapping"],
  ["/admin/settings/financial-year", "Financial years"],
  ["/admin/settings/numbering", "Document numbering"],
  ["/admin/settings/charges", "Charges"],
  ["/admin/settings/tax-preview", "Tax preview"],
];
const blank = {
  legalBusinessName: "",
  tradeName: "",
  registeredAddress: "",
  state: "",
  stateCode: "",
  pincode: "",
  country: "",
  contactNumber: "",
  officialEmail: "",
  pan: "",
  gstin: "",
  registrationDetails: "",
  invoiceHeaderName: "",
  bankDetails: "",
  footerNotes: "",
  termsAndConditions: "",
  defaultPlaceOfSupply: "",
  roundingPrecision: 2,
  roundingMethod: "HALF_UP",
  freightLabel: "Freight",
  packingLabel: "Packing",
};
const rateBlank = {
  code: "",
  name: "",
  cgstPercent: "",
  sgstPercent: "",
  igstPercent: "",
  cessPercent: "0",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  taxInclusive: false,
};
const hsnBlank = {
  code: "",
  description: "",
  gstRateId: "",
  unitOfMeasure: "",
  effectiveFrom: "",
  effectiveTo: "",
};
const yearBlank = { name: "", startDate: "", endDate: "", isActive: false };
const numberingBlank = {
  financialYearId: "",
  documentType: "TAX_INVOICE",
  prefix: "",
  suffix: "",
  startingSequence: 1,
  branchCode: "",
};
const chargeBlank = {
  code: "",
  label: "",
  isTaxable: false,
  taxInclusive: false,
  taxRateId: "",
};
const fieldClass = "mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-sm";
const fields = (
  values: Record<string, any>,
  set: (key: string, value: any) => void,
  names: Array<[string, string, string?]>,
) =>
  names.map(([key, label, type]) => (
    <label className="text-sm" key={key}>
      {label}
      <input
        className={fieldClass}
        type={type ?? "text"}
        value={values[key] ?? ""}
        onChange={(e) =>
          set(key, type === "number" ? Number(e.target.value) : e.target.value)
        }
      />
    </label>
  ));
export default function BillingSettings() {
  const path = usePathname();
  const [form, setForm] = useState<Record<string, any>>(blank);
  const [rates, setRates] = useState<any[]>([]);
  const [hsn, setHsn] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [numbering, setNumbering] = useState<any[]>([]);
  const [charges, setCharges] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState<any>(rateBlank);
  const [hsnForm, setHsnForm] = useState<any>(hsnBlank);
  const [year, setYear] = useState<any>(yearBlank);
  const [numberConfig, setNumberConfig] = useState<any>(numberingBlank);
  const [charge, setCharge] = useState<any>(chargeBlank);
  const active = useMemo(() => tabs.find((tab) => tab[0] === path), [path]);
  const load = async () => {
    setError("");
    try {
      if (path.endsWith("/company")) {
        const r = await api.get("/api/admin/settings/company");
        setForm({ ...blank, ...(r.data.settings ?? {}) });
      }
      if (path.endsWith("/gst"))
        setRates((await api.get("/api/admin/settings/gst-rates")).data.items);
      if (path.endsWith("/hsn")) {
        const [h, r] = await Promise.all([
          api.get("/api/admin/settings/hsn"),
          api.get("/api/admin/settings/gst-rates"),
        ]);
        setHsn(h.data.items);
        setRates(r.data.items);
      }
      if (path.endsWith("/financial-year"))
        setYears(
          (await api.get("/api/admin/settings/financial-years")).data.items,
        );
      if (path.endsWith("/numbering")) {
        const [n, y] = await Promise.all([
          api.get("/api/admin/settings/numbering"),
          api.get("/api/admin/settings/financial-years"),
        ]);
        setNumbering(n.data.items);
        setYears(y.data.items);
      }
      if (path.endsWith("/charges")) {
        const [c, r] = await Promise.all([
          api.get("/api/admin/settings/charges"),
          api.get("/api/admin/settings/gst-rates"),
        ]);
        setCharges(c.data.items);
        setRates(r.data.items);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || "Unable to load configuration.");
    }
  };
  useEffect(() => {
    void load();
  }, [path]);
  function setter(
    target: "form" | "rate" | "hsn" | "year" | "number" | "charge",
    key: string,
    value: any,
  ) {
    const update =
      target === "form"
        ? setForm
        : target === "rate"
          ? setRate
          : target === "hsn"
            ? setHsnForm
            : target === "year"
              ? setYear
              : target === "number"
                ? setNumberConfig
                : setCharge;
    update((old: any) => ({ ...old, [key]: value }));
  }
  async function save(action: () => Promise<unknown>, message = "Saved.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, fn: () => void) => (
    <button
      disabled={busy}
      onClick={fn}
      className="rounded bg-[#672f35] px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {busy ? "Saving…" : label}
    </button>
  );
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <p className="text-xs text-slate-500">Administration / Settings</p>
        <h2 className="text-2xl font-semibold">
          {active?.[1] ?? "Billing configuration"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Super Admin configuration. Tax values and legal details are left blank
          until supplied by your business/accountant.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2">
        {tabs.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`rounded border border-slate-300 px-3 py-2 text-xs ${path === href ? "border border-slate-300-[#672f35] bg-[#f5eaea] text-[#672f35]" : "bg-white text-slate-600"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {error && (
        <p
          role="alert"
          className="rounded bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {path.endsWith("/company") && (
        <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">Legal and invoice display details</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {fields(form, (k, v) => setter("form", k, v), [
              ["legalBusinessName", "Registered legal business name"],
              ["tradeName", "Trade name"],
              ["logoUrl", "Logo URL"],
              ["invoiceHeaderName", "Invoice header name"],
              ["registeredAddress", "Registered address"],
              ["state", "Registered state"],
              ["stateCode", "State code"],
              ["pincode", "PIN code"],
              ["country", "Country"],
              ["contactNumber", "Contact number"],
              ["officialEmail", "Official email", "email"],
              ["pan", "PAN"],
              ["gstin", "GSTIN"],
              ["registrationDetails", "Business registration details"],
              ["defaultPlaceOfSupply", "Default place of supply"],
              ["freightLabel", "Freight label"],
              ["packingLabel", "Packing label"],
            ])}
            <label className="text-sm">
              Bank/payment details
              <textarea
                className={fieldClass}
                value={form.bankDetails ?? ""}
                onChange={(e) => setter("form", "bankDetails", e.target.value)}
              />
            </label>
            <label className="text-sm">
              Footer notes
              <textarea
                className={fieldClass}
                value={form.footerNotes ?? ""}
                onChange={(e) => setter("form", "footerNotes", e.target.value)}
              />
            </label>
            <label className="text-sm">
              Terms and conditions
              <textarea
                className={fieldClass}
                value={form.termsAndConditions ?? ""}
                onChange={(e) =>
                  setter("form", "termsAndConditions", e.target.value)
                }
              />
            </label>
            <label className="text-sm">
              Rounding precision
              <select
                className={fieldClass}
                value={form.roundingPrecision}
                onChange={(e) =>
                  setter("form", "roundingPrecision", Number(e.target.value))
                }
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Rounding method
              <select
                className={fieldClass}
                value={form.roundingMethod}
                onChange={(e) =>
                  setter("form", "roundingMethod", e.target.value)
                }
              >
                {["HALF_UP", "HALF_EVEN", "DOWN", "UP"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          {button(
            "Save settings",
            () =>
              void save(() => api.patch("/api/admin/settings/company", form)),
          )}
        </section>
      )}
      {path.endsWith("/gst") && (
        <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">Effective-dated GST rate master</h3>
          <p className="text-xs text-slate-500">
            CGST + SGST must equal IGST. Use values reviewed by your accountant;
            this tool does not verify tax applicability.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            {fields(rate, (k, v) => setter("rate", k, v), [
              ["code", "Rate code"],
              ["name", "Name"],
              ["cgstPercent", "CGST %", "number"],
              ["sgstPercent", "SGST %", "number"],
              ["igstPercent", "IGST %", "number"],
              ["cessPercent", "Cess %", "number"],
              ["effectiveFrom", "Effective from", "date"],
              ["effectiveTo", "Effective to", "date"],
            ])}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rate.taxInclusive}
                onChange={(e) =>
                  setter("rate", "taxInclusive", e.target.checked)
                }
              />
              Tax inclusive
            </label>
          </div>
          {button(
            "Add GST rate",
            () =>
              void save(() => api.post("/api/admin/settings/gst-rates", rate)),
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Code",
                    "Name",
                    "CGST",
                    "SGST",
                    "IGST",
                    "Cess",
                    "Effective",
                    "Status",
                  ].map((x) => (
                    <th className="p-2" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr className="border border-slate-300-t" key={r.id}>
                    <td className="p-2">{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.cgstPercent}</td>
                    <td>{r.sgstPercent}</td>
                    <td>{r.igstPercent}</td>
                    <td>{r.cessPercent}</td>
                    <td>
                      {new Date(r.effectiveFrom).toLocaleDateString()} –{" "}
                      {r.effectiveTo
                        ? new Date(r.effectiveTo).toLocaleDateString()
                        : "Open"}
                    </td>
                    <td>{r.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      {r.isActive && (
                        <>
                          <button
                            className="mr-2 underline"
                            onClick={() => {
                              const value = window.prompt(
                                "Enter CGST, SGST, IGST, Cess percentages separated by commas",
                                `${r.cgstPercent},${r.sgstPercent},${r.igstPercent},${r.cessPercent}`,
                              );
                              if (value) {
                                const [
                                  cgstPercent,
                                  sgstPercent,
                                  igstPercent,
                                  cessPercent,
                                ] = value.split(",").map((x) => x.trim());
                                void save(() =>
                                  api.patch(
                                    `/api/admin/settings/gst-rates/${r.id}`,
                                    {
                                      cgstPercent,
                                      sgstPercent,
                                      igstPercent,
                                      cessPercent,
                                    },
                                  ),
                                );
                              }
                            }}
                          >
                            Edit rates
                          </button>
                          <button
                            className="underline text-rose-700"
                            onClick={() =>
                              void save(() =>
                                api.delete(
                                  `/api/admin/settings/gst-rates/${r.id}`,
                                ),
                              )
                            }
                          >
                            Deactivate
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {path.endsWith("/hsn") && (
        <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">HSN / SAC master</h3>
          <p className="text-xs text-slate-500">
            Enter only codes supplied and approved by your business. Format
            validation does not verify a code with the government.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {fields(hsnForm, (k, v) => setter("hsn", k, v), [
              ["code", "HSN/SAC code"],
              ["description", "Description"],
              ["unitOfMeasure", "UOM"],
              ["effectiveFrom", "Effective from", "date"],
              ["effectiveTo", "Effective to", "date"],
            ])}
            <label className="text-sm">
              GST rate
              <select
                className={fieldClass}
                value={hsnForm.gstRateId}
                onChange={(e) => setter("hsn", "gstRateId", e.target.value)}
              >
                <option value="">Not configured</option>
                {rates.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {button(
            "Add HSN/SAC",
            () => void save(() => api.post("/api/admin/settings/hsn", hsnForm)),
          )}
          {hsn.map((h) => (
            <p key={h.id} className="border border-slate-300-t pt-2 text-sm">
              {h.code} · {h.description} ·{" "}
              {h.gstRate?.code ?? "Tax not configured"} ·{" "}
              {h.isActive ? "Active" : "Inactive"}
            </p>
          ))}
        </section>
      )}
      {path.endsWith("/financial-year") && (
        <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">Financial year setup</h3>
          <div className="grid gap-3 md:grid-cols-4">
            {fields(year, (k, v) => setter("year", k, v), [
              ["name", "Financial year name"],
              ["startDate", "Start date", "date"],
              ["endDate", "End date", "date"],
            ])}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={year.isActive}
                onChange={(e) => setter("year", "isActive", e.target.checked)}
              />
              Active year
            </label>
          </div>
          {button(
            "Add financial year",
            () =>
              void save(() =>
                api.post("/api/admin/settings/financial-years", year),
              ),
          )}
          {years.map((y) => (
            <p key={y.id} className="border border-slate-300-t pt-2 text-sm">
              {y.name} · {new Date(y.startDate).toLocaleDateString()} to{" "}
              {new Date(y.endDate).toLocaleDateString()} ·{" "}
              {y.isActive ? "Active" : "Inactive"}{" "}
              {!y.isActive && (
                <button
                  className="ml-3 underline"
                  onClick={() =>
                    void save(() =>
                      api.patch(`/api/admin/settings/financial-years/${y.id}`, {
                        isActive: true,
                      }),
                    )
                  }
                >
                  Set active
                </button>
              )}
            </p>
          ))}
        </section>
      )}
      {path.endsWith("/numbering") && (
        <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">Financial-year document numbering</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              Financial year
              <select
                className={fieldClass}
                value={numberConfig.financialYearId}
                onChange={(e) =>
                  setter("number", "financialYearId", e.target.value)
                }
              >
                <option value="">Select financial year</option>
                {years.map((y) => (
                  <option value={y.id} key={y.id}>
                    {y.name}
                    {y.isActive ? " · Active" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Document type
              <select
                className={fieldClass}
                value={numberConfig.documentType}
                onChange={(e) =>
                  setter("number", "documentType", e.target.value)
                }
              >
                {[
                  "TAX_INVOICE",
                  "PROFORMA_INVOICE",
                  "DELIVERY_CHALLAN",
                  "CREDIT_NOTE",
                  "DEBIT_NOTE",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            {fields(numberConfig, (k, v) => setter("number", k, v), [
              ["prefix", "Prefix"],
              ["suffix", "Suffix"],
              ["startingSequence", "Starting sequence", "number"],
              ["branchCode", "Branch code (optional)"],
            ])}
          </div>
          {button(
            "Add numbering rule",
            () =>
              void save(() =>
                api.post("/api/admin/settings/numbering", numberConfig),
              ),
          )}
          {numbering.map((n) => (
            <p key={n.id} className="border border-slate-300-t pt-2 text-sm">
              {n.financialYear.name} · {n.documentType} · {n.prefix} · sequence{" "}
              {n.currentSequence}/{n.startingSequence} ·{" "}
              {n.isActive ? "Active" : "Inactive"}
            </p>
          ))}
          <p className="text-xs text-slate-500">
            Configuration only. No invoice or other financial document numbers
            are issued in this phase.
          </p>
        </section>
      )}
      {path.endsWith("/charges") && (
        <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">
            Freight, packing and additional charge configuration
          </h3>
          <div className="grid gap-3 md:grid-cols-4">
            {fields(charge, (k, v) => setter("charge", k, v), [
              ["code", "Charge code"],
              ["label", "Display label"],
            ])}
            <label className="text-sm">
              GST rate
              <select
                className={fieldClass}
                value={charge.taxRateId}
                onChange={(e) => setter("charge", "taxRateId", e.target.value)}
              >
                <option value="">No tax</option>
                {rates.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={charge.isTaxable}
                onChange={(e) =>
                  setter("charge", "isTaxable", e.target.checked)
                }
              />
              Taxable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={charge.taxInclusive}
                onChange={(e) =>
                  setter("charge", "taxInclusive", e.target.checked)
                }
              />
              Amount includes tax
            </label>
          </div>
          {button(
            "Add charge",
            () =>
              void save(() => api.post("/api/admin/settings/charges", charge)),
          )}
          {charges.map((c) => (
            <p key={c.id} className="border border-slate-300-t pt-2 text-sm">
              {c.code} · {c.label} ·{" "}
              {c.isTaxable
                ? `Taxable${c.taxInclusive ? " (inclusive)" : " (exclusive)"}`
                : "Non-taxable"}
            </p>
          ))}
        </section>
      )}
      {path.endsWith("/product-tax") && <ProductTaxMappings />}
      {path.endsWith("/tax-preview") && <TaxPreview />}
    </div>
  );
}

function ProductTaxMappings() {
  const [products, setProducts] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [hsn, setHsn] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      api.get("/api/admin/products?pageSize=100"),
      api.get("/api/admin/settings/gst-rates"),
      api.get("/api/admin/settings/hsn"),
    ])
      .then(([p, r, h]) => {
        setProducts(p.data.data.items);
        setRates(r.data.items);
        setHsn(h.data.items);
      })
      .catch((e) =>
        setError(e.response?.data?.error || "Unable to load products."),
      );
  }, []);
  async function save(product: any) {
    try {
      await api.patch(`/api/admin/products/${product.id}/tax`, {
        hsnSacId: product.hsnSacId,
        gstRateId: product.gstRateId,
        taxInclusive: product.taxInclusive,
        taxUom: product.taxUom,
      });
    } catch (e: any) {
      setError(
        e.response?.data?.error || "Product tax mapping could not be saved.",
      );
    }
  }
  return (
    <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
      <h3 className="font-semibold">Product tax mapping</h3>
      <p className="text-xs text-slate-500">
        Existing products remain unconfigured until an HSN/SAC and effective
        rate are selected.
      </p>
      {error && <p className="text-rose-700">{error}</p>}
      {products.map((p) => (
        <div
          className="grid items-center gap-2 border-t border-slate-300 py-3 text-sm md:grid-cols-[1fr_1fr_1fr_auto]"
          key={p.id}
        >
          <span>
            {p.name} · {p.sku}
          </span>
          <select
            className="rounded border border-slate-300 p-2 bg-white"
            value={p.hsnSacId ?? ""}
            onChange={(e) =>
              setProducts((old) =>
                old.map((x) =>
                  x.id === p.id
                    ? { ...x, hsnSacId: e.target.value || null }
                    : x,
                ),
              )
            }
          >
            <option value="">Tax not configured (HSN)</option>
            {hsn
              .filter((x) => x.isActive)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.description}
                </option>
              ))}
          </select>
          <select
            className="rounded border border-slate-300 p-2 bg-white"
            value={p.gstRateId ?? ""}
            onChange={(e) =>
              setProducts((old) =>
                old.map((x) =>
                  x.id === p.id
                    ? { ...x, gstRateId: e.target.value || null }
                    : x,
                ),
              )
            }
          >
            <option value="">Use HSN rate / no mapping</option>
            {rates
              .filter((x) => x.isActive)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
          </select>
          <button
            onClick={() => void save(p)}
            className="rounded border border-slate-300 px-3 py-2"
          >
            Save
          </button>
          <label className="flex items-center gap-2 md:col-span-4">
            <input
              type="checkbox"
              checked={p.taxInclusive ?? false}
              onChange={(e) =>
                setProducts((old) =>
                  old.map((x) =>
                    x.id === p.id
                      ? { ...x, taxInclusive: e.target.checked }
                      : x,
                  ),
                )
              }
            />
            Tax-inclusive wholesale price{" "}
            <input
              className="rounded border border-slate-300 p-1 bg-white"
              placeholder="UOM"
              value={p.taxUom ?? ""}
              onChange={(e) =>
                setProducts((old) =>
                  old.map((x) =>
                    x.id === p.id ? { ...x, taxUom: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
        </div>
      ))}
    </section>
  );
}

function TaxPreview() {
  const [orderId, setOrderId] = useState("");
  const [treatment, setTreatment] = useState("INTRA_STATE");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  async function run() {
    setError("");
    try {
      const r = await api.post("/api/admin/settings/tax-preview", {
        salesOrderId: orderId,
        supplyTreatment: treatment,
      });
      setResult(r.data);
    } catch (e: any) {
      setError(e.response?.data?.error || "Tax preview failed.");
      setResult(null);
    }
  }
  return (
    <section className="space-y-4 rounded-lg border border-slate-300 bg-white p-5">
      <h3 className="font-semibold">Tax calculation preview</h3>
      <p className="text-xs text-slate-500">
        This is a preview and does not issue an invoice. Select
        intra/inter-state treatment only after accountant review of
        place-of-supply rules.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border border-slate-300 p-2"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Sales Order ID"
        />
        <select
          className="rounded border border-slate-300 p-2"
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
        >
          <option value="INTRA_STATE">Intra-state (CGST + SGST)</option>
          <option value="INTER_STATE">Inter-state (IGST)</option>
        </select>
        <button
          onClick={() => void run()}
          className="rounded bg-[#672f35] px-3 py-2 text-sm text-white"
        >
          Calculate preview
        </button>
      </div>
      {error && <p className="text-rose-700">{error}</p>}
      {result && (
        <>
          <pre className="max-h-[500px] overflow-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
          <p className="text-xs text-amber-700">{result.disclaimer}</p>
        </>
      )}
    </section>
  );
}
