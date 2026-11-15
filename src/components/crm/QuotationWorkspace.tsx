"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/axios";
import { Trash2 } from "lucide-react";
type Quote = {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  totalAmount: string;
  status: string;
  revisionNumber: number;
  customer: { customerCode: string; businessName: string };
  createdBy: { firstName: string; lastName: string };
};
export function QuotationList() {
  const pathname = usePathname();
  const base = pathname.startsWith("/sales") ? "/sales" : "/admin";
  const [rows, setRows] = useState<Quote[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    api
      .get("/api/quotations", {
        params: { q, status, page, pageSize, from, to, customerId, assignedTo },
      })
      .then((r) => {
        setRows(r.data.items);
        setTotal(r.data.total);
      })
      .catch(() => setErr("Unable to load quotations."));
  }, [q, status, page, pageSize, from, to, customerId, assignedTo]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Quotations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Wholesale quotations are independent of stock and sales orders.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Search quotation or customer"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {[
              "DRAFT",
              "SENT",
              "ACCEPTED",
              "REJECTED",
              "EXPIRED",
              "CANCELLED",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            aria-label="Customer ID filter"
            placeholder="Customer ID"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setPage(1);
            }}
            className="w-32 rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
          <input
            aria-label="Sales Executive ID filter"
            placeholder="Executive ID"
            value={assignedTo}
            onChange={(e) => {
              setAssignedTo(e.target.value);
              setPage(1);
            }}
            className="w-32 rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
          <input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 px-2 py-2 text-sm bg-white"
          />
          <input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 px-2 py-2 text-sm bg-white"
          />
          <Link
            href={`${base}/quotations/create`}
            className="rounded bg-[#9D174D] px-4 py-2 text-sm text-white"
          >
            New quotation
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {[
                "Reference",
                "Customer",
                "Created by",
                "Date",
                "Valid until",
                "Total",
                "Status",
                "",
              ].map((t) => (
                <th className="px-4 py-3" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {err ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-rose-700">
                  {err}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold text-[#9D174D]">
                    {row.quotationNumber}
                  </td>
                  <td className="px-4 py-3">
                    {row.customer.businessName}
                    <small className="block text-slate-500">
                      {row.customer.customerCode}
                    </small>
                  </td>
                  <td className="px-4 py-3">
                    {row.createdBy.firstName} {row.createdBy.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(row.quotationDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(row.validUntil).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    ₹
                    {Number(row.totalAmount).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="underline"
                      href={`${base}/quotations/${row.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
            {rows.length === 0 && !err && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No quotations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-300 p-3 text-xs text-slate-500">
          <span>
            {total} quotations · Page {page} of{" "}
            {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <div className="flex gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-slate-300 bg-white px-2"
            >
              <option>10</option>
              <option>20</option>
              <option>50</option>
              <option>100</option>
            </select>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(page + 1)}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export function QuotationCreate() {
  const router = useRouter();
  const pathname = usePathname();
  const base = pathname.startsWith("/sales") ? "/sales" : "/admin";
  const [customers, setCustomers] = useState<
    { id: string; customerCode: string; businessName: string; status: string }[]
  >([]);
  const [products, setProducts] = useState<
    {
      id: string;
      name: string;
      sku: string;
      minimumOrderQuantity: number;
      wholesalePrice: string | null;
      images?: { imageUrl: string }[];
    }[]
  >([]);
  const [canOverride, setCanOverride] = useState(false);
  const [customerId, setCustomer] = useState("");
  const [validUntil, setValid] = useState("");
  const [lines, setLines] = useState([
    { productId: "", quantity: "10", unitPrice: "", discount: "0" },
  ]);
  const [discountType, setType] = useState("FIXED");
  const [discountValue, setDiscount] = useState("0");
  const [confirmInactive, setConfirmInactive] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const requestedCustomer = new URLSearchParams(window.location.search).get(
      "customerId",
    );
    if (requestedCustomer) setCustomer(requestedCustomer);
    api
      .get("/api/customers", { params: { pageSize: 100 } })
      .then((r) => setCustomers(r.data.items));
    api
      .get("/api/quotation-products")
      .then((r) => setProducts(r.data.items || []))
      .catch(() => setProducts([]));
    api
      .get("/api/auth/session")
      .then((r) => setCanOverride(r.data.data?.role === "SUPER_ADMIN"))
      .catch(() => setCanOverride(false));
  }, []);
  const selected = customers.find((c) => c.id === customerId);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/api/quotations", {
        customerId,
        validUntil,
        items: lines.map((l) => ({
          ...l,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discount: Number(l.discount),
        })),
        discountType,
        discountValue: Number(discountValue),
        confirmInactive,
        paymentTerms,
        deliveryTerms,
        customerNotes,
        internalNotes,
      });
      router.push(`${base}/quotations/${r.data.quotation.id}`);
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } }).response?.data
          ?.error || "Could not create quotation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Create quotation</h2>
        <p className="mt-1 text-sm text-slate-500">
          The current wholesale price is loaded from the product. Super Admins
          may override it for this quotation. Taxes are currently zero because
          tax rules have not been configured.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      <section className="grid grid-cols-4 gap-2 rounded-lg border border-slate-300 bg-white p-5">
        <label className="block text-sm col-span-3">
          Customer
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
            value={customerId}
            onChange={(e) => setCustomer(e.target.value)}
          >
            <option value="">Select an assigned active customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.customerCode} · {c.businessName} ({c.status})
              </option>
            ))}
          </select>
        </label>
        {selected?.status === "INACTIVE" && (
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmInactive}
              onChange={(e) => setConfirmInactive(e.target.checked)}
            />
            Super Admin confirms this inactive customer can receive a quotation
          </label>
        )}
        <label className="block text-sm col-span-1">
          Valid until
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={validUntil}
            onChange={(e) => setValid(e.target.value)}
            className="mt-1 w-full block rounded border border-slate-300 p-2 bg-white"
          />
        </label>
      </section>
      <section className="space-y-3 rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">Products</h3>
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid gap-2 border-b border-slate-300 items-center pb-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <select
              className="h-9 inline-flex items-center rounded border border-slate-300 p-2 text-sm bg-white"
              value={line.productId}
              onChange={(e) => {
                const p = products.find((item) => item.id === e.target.value);
                setLines((old) =>
                  old.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          productId: e.target.value,
                          unitPrice: p?.wholesalePrice || "",
                        }
                      : x,
                  ),
                );
              }}
            >
              <option value="">Select active product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.wholesalePrice}>
                  {p.name} · {p.sku} · MOQ {p.minimumOrderQuantity} ·{" "}
                  {p.wholesalePrice
                    ? `₹${Number(p.wholesalePrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}/piece`
                    : "Price not configured"}
                </option>
              ))}
            </select>
            <input
              aria-label="Quantity"
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) =>
                setLines((old) =>
                  old.map((x, j) =>
                    j === i ? { ...x, quantity: e.target.value } : x,
                  ),
                )
              }
              placeholder="Qty"
              className="h-9 inline-flex items-center rounded border border-slate-300 p-2 bg-white "
            />
            <input
              aria-label="Unit price per piece"
              type="number"
              min="0.01"
              step="0.01"
              value={line.unitPrice}
              readOnly={!canOverride}
              onChange={(e) =>
                setLines((old) =>
                  old.map((x, j) =>
                      j === i ? { ...x, unitPrice: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Price not configured"
                className="h-9 inline-flex items-center w-full rounded border border-slate-300 p-2 read-only:bg-slate-50 bg-white"
              />
            <input
              aria-label="Line discount"
              type="number"
              min="0"
              step="0.01"
              value={line.discount}
              onChange={(e) =>
                setLines((old) =>
                  old.map((x, j) =>
                    j === i ? { ...x, discount: e.target.value } : x,
                  ),
                )
              }
              placeholder="Discount ₹"
              className="h-9 inline-flex items-center rounded border border-slate-300 p-2 bg-white"
            />
            <button
              onClick={() =>
                setLines((old) =>
                  old.length > 1 ? old.filter((_, j) => j !== i) : old,
                )
              }
              className="h-9 w-9 inline-flex items-center justify-center rounded text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 size={18} />
            </button>
            <p className="text-xs text-slate-500 md:col-span-1">
              Gross line amount: ₹
              {(Number(line.unitPrice) * Number(line.quantity)).toLocaleString(
                "en-IN",
                { minimumFractionDigits: 2 },
              )}{" "}
              · After line discount: ₹
              {Math.max(
                0,
                Number(line.unitPrice) * Number(line.quantity) -
                  Number(line.discount),
              ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-600 md:col-span-1">
              Quantity
            </p>
            <p className="text-xs text-slate-600 md:col-span-1">
              Unit price / piece
            </p>
            <p className="text-xs text-slate-600 md:col-span-1">
              Line Discount
            </p>
          </div>
        ))}
        <button
          onClick={() =>
            setLines((old) => [
              ...old,
              { productId: "", quantity: "10", unitPrice: "", discount: "0" },
            ])
          }
          className="text-sm text-[#9D174D] underline"
        >
          Add product
        </button>
      </section>
      <section className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5 md:grid-cols-2">
        <label className="text-sm">
          Overall discount type
          <select
            value={discountType}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block rounded border border-slate-300 p-2 bg-white"
          >
            <option value="FIXED">Fixed amount</option>
            <option value="PERCENT">Percent</option>
          </select>
        </label>
        <label className="text-sm">
          Overall discount
          <input
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(e) => setDiscount(e.target.value)}
            className="mt-1 block rounded border border-slate-300 p-2 bg-white"
          />
        </label>
        <label className="text-sm">
          Payment terms
          <textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
          />
        </label>
        <label className="text-sm">
          Delivery terms
          <textarea
            value={deliveryTerms}
            onChange={(e) => setDeliveryTerms(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
          />
        </label>
        <label className="text-sm">
          Customer notes
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
          />
        </label>
        <label className="text-sm">
          Internal notes
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
          />
        </label>
      </section>
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="rounded border border-slate-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy || !customerId || !validUntil}
          className="rounded bg-[#9D174D] px-5 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save draft"}
        </button>
      </div>
    </div>
  );
}
