"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import GenerateDispatchInvoice from "@/components/crm/GenerateDispatchInvoice";
type Row = Record<string, any>;
const money = (x: unknown) =>
  `₹${Number(x ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
export function InvoiceWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<Row[]>([]);
  const [dispatches, setDispatches] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [eligibleQ, setEligibleQ] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sort,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(customerId ? { customerId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    api
      .get(`/api/invoices?${query}`)
      .then((r) => {
        setItems(r.data.items);
        setPageCount(Math.max(1, Math.ceil(r.data.total / r.data.pageSize)));
      })
      .catch((e) =>
        setError(e.response?.data?.error || "Could not load invoices."),
      );
  }, [q, status, paymentStatus, customerId, from, to, sort, page]);
  useEffect(() => {
    if (isAdmin)
      api
        .get(
          `/api/invoices/eligible-dispatches${eligibleQ ? `?q=${encodeURIComponent(eligibleQ)}` : ""}`,
        )
        .then((r) => setDispatches(r.data.items))
        .catch((e) =>
          setError(
            e.response?.data?.error || "Could not load eligible dispatches.",
          ),
        );
  }, [eligibleQ, isAdmin]);
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold">Invoices</h2>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? "Draft, issue and manage dispatch invoices and payments."
            : "Invoices and balances for your authorised customers and orders."}
        </p>
      </header>
      {isAdmin && (
        <article className="space-y-3 rounded-lg border border-slate-300 bg-white p-4">
          <div>
            <h3 className="font-semibold">
              Confirmed dispatches ready to invoice
            </h3>
            <p className="text-xs text-slate-500">
              One invoice per confirmed dispatch; invoice creation is manual and
              Super Admin only.
            </p>
          </div>
          <input
            className="w-full max-w-md rounded border border-slate-300 p-2 bg-white"
            placeholder="Search order or customer"
            value={eligibleQ}
            onChange={(e) => setEligibleQ(e.target.value)}
          />
          {dispatches.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 pt-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {d.reference} · {d.salesOrder.orderNumber}
                </p>
                <p>
                  {d.salesOrder.customer.businessName} ·{" "}
                  {d.items.reduce((sum: number, x: any) => sum + x.quantity, 0)}{" "}
                  dispatched pieces ·{" "}
                  {new Date(d.dispatchedAt).toLocaleDateString()}
                </p>
              </div>
              <GenerateDispatchInvoice dispatchId={d.id} />
            </div>
          ))}
          {!dispatches.length && (
            <p className="text-sm text-slate-500">
              No unbilled confirmed dispatches.
            </p>
          )}
        </article>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border border-slate-300 bg-white p-2"
          placeholder="Search invoice, order, customer, dispatch"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="rounded border border-slate-300 bg-white p-2"
          placeholder="Customer ID filter"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setPage(1);
          }}
        />
        <input
          aria-label="From date"
          type="date"
          className="rounded border border-slate-300 bg-white p-2"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          aria-label="To date"
          type="date"
          className="rounded border border-slate-300 bg-white p-2"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="rounded border border-slate-300 bg-white p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="createdAt">Newest created</option>
          <option value="invoiceDate">Invoice date</option>
          <option value="dueDate">Due date</option>
          <option value="grandTotal">Amount</option>
        </select>
        <select
          className="rounded border border-slate-300 bg-white p-2"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All invoice statuses</option>
          {["DRAFT", "ISSUED", "CREDIT_NOTED", "CANCELLED"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          className="rounded border border-slate-300 bg-white p-2"
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All payment statuses</option>
          {["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-rose-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs">
            <tr>
              {[
                "Invoice",
                "Date",
                "Customer",
                "Order / Dispatch",
                "Amount",
                "Paid",
                "Outstanding",
                "Status",
                "Due",
                "Created by",
              ].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id} className="border-t border-slate-300">
                <td className="p-3">
                  <Link
                    className="font-medium text-[#9D174D] underline"
                    href={`${isAdmin ? "/admin" : "/sales"}/invoices/${x.id}`}
                  >
                    {x.invoiceNumber ?? "Draft"}
                  </Link>
                </td>
                <td className="p-3">
                  {x.invoiceDate
                    ? new Date(x.invoiceDate).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-3">{x.customer.businessName}</td>
                <td className="p-3">
                  {x.salesOrder.orderNumber}
                  <br />
                  <span className="text-xs text-slate-500">
                    {x.dispatch.reference}
                  </span>
                </td>
                <td className="p-3">{money(x.grandTotal)}</td>
                <td className="p-3">{money(x.amountPaid)}</td>
                <td className="p-3">{money(x.outstandingAmount)}</td>
                <td className="p-3">
                  {x.status} · {x.paymentStatus}
                </td>
                <td className="p-3">
                  {x.dueDate ? new Date(x.dueDate).toLocaleDateString() : "—"}
                </td>
                <td className="p-3">
                  {x.createdBy.firstName} {x.createdBy.lastName}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="p-5 text-slate-500" colSpan={10}>
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-3 text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="py-2">
          Page {page} of {pageCount}
        </span>
        <button
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
          className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}

export function InvoiceDetail({ isAdmin }: { isAdmin: boolean }) {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [treatment, setTreatment] = useState("INTRA_STATE");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [charges, setCharges] = useState<any[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [payment, setPayment] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    mode: "BANK_TRANSFER",
    transactionReference: "",
    bankDetails: "",
    remarks: "",
  });
  const [paymentKey, setPaymentKey] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditQty, setCreditQty] = useState<Record<string, number>>({});
  async function load() {
    try {
      const r = await api.get(`/api/invoices/${params.id}`);
      setInvoice(r.data.item);
      setTreatment(r.data.item.supplyTreatment);
      setPlaceOfSupply(r.data.item.placeOfSupply ?? "");
      setStateCode(r.data.item.stateCode ?? "");
      setReverseCharge(r.data.item.reverseCharge);
      setCharges(
        (r.data.item.chargesSnapshot ?? []).map((x: any) => ({
          configurationId: x.configurationId,
          amount: x.amount,
        })),
      );
      setDueDate(r.data.item.dueDate?.slice(0, 10) ?? "");
    } catch (e: any) {
      setError(e.response?.data?.error || "Unable to load invoice.");
    }
  }
  useEffect(() => {
    void load();
  }, [params.id]);
  async function act(task: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Invoice action failed.");
    } finally {
      setBusy(false);
    }
  }
  async function recordPayment() {
    const key = paymentKey || crypto.randomUUID();
    if (!paymentKey) setPaymentKey(key);
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/invoices/${params.id}/payments`, {
        ...payment,
        idempotencyKey: key,
      });
      setPaymentKey(crypto.randomUUID());
      setPayment({
        ...payment,
        amount: "",
        transactionReference: "",
        remarks: "",
      });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Payment could not be recorded.");
    } finally {
      setBusy(false);
    }
  }
  async function saveAndIssue() {
    await api.patch(`/api/invoices/${params.id}`, {
      treatment,
      placeOfSupply,
      stateCode,
      reverseCharge,
      charges,
      dueDate: dueDate || null,
    });
    await api.post(`/api/invoices/${params.id}/issue`, {});
  }
  if (!invoice) return <p>{error || "Loading invoice…"}</p>;
  const company = invoice.companySnapshot ?? {};
  const customer = invoice.customerSnapshot ?? {};
  const issued = ["ISSUED", "CREDIT_NOTED"].includes(invoice.status);
  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            className="text-sm underline"
            href={`${isAdmin ? "/admin" : "/sales"}/invoices`}
          >
            Invoices
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">
            {invoice.invoiceNumber ?? "Invoice draft"}
          </h2>
          <p className="text-sm text-slate-500">
            {invoice.status} · {invoice.paymentStatus} ·{" "}
            {invoice.dispatch.reference} · {invoice.salesOrder.orderNumber}
          </p>
        </div>
        {issued && (
          <div className="flex gap-2">
            <a
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              href={`/api/invoices/${invoice.id}/pdf?download=0`}
              target="_blank"
            >
              View PDF
            </a>
            <a
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              href={`/api/invoices/${invoice.id}/pdf?download=0`}
              target="_blank"
              onClick={(e) => {
                e.preventDefault();
                const w = window.open(
                  `/api/invoices/${invoice.id}/pdf?download=0`,
                  "_blank",
                );
                w?.addEventListener("load", () => w.print());
              }}
            >
              Print
            </a>
            <a
              className="rounded bg-[#9D174D] px-3 py-2 text-sm text-white"
              href={`/api/invoices/${invoice.id}/pdf`}
            >
              Download PDF
            </a>
          </div>
        )}
      </header>
      {error && (
        <p
          role="alert"
          className="rounded bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded border border-slate-300 bg-white p-4">
          <h3 className="font-semibold">Company snapshot</h3>
          <p>{company.legalBusinessName}</p>
          <p className="text-sm">{company.registeredAddress}</p>
          <p className="text-sm">
            GSTIN {company.gstin} · PAN {company.pan}
          </p>
        </article>
        <article className="rounded border border-slate-300 bg-white p-4">
          <h3 className="font-semibold">Bill to / ship to</h3>
          <p>
            {customer.businessName} · {customer.buyerName}
          </p>
          <p className="text-sm">
            {customer.billingAddress}, {customer.city}, {customer.state}{" "}
            {customer.pincode}
          </p>
          <p className="text-sm">
            GSTIN {customer.gstin || "—"} · {customer.mobile}
          </p>
          <p className="text-sm">
            Shipping: {invoice.shippingSnapshot?.address}
          </p>
        </article>
      </div>
      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs">
            <tr>
              {[
                "Product",
                "SKU",
                "HSN",
                "Qty",
                "Unit price",
                "Discount",
                "Taxable",
                "GST",
                "Total",
              ].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((x: Row) => (
              <tr key={x.id} className="border-t border-slate-300">
                <td className="p-3">
                  {x.productName}
                  <div className="text-xs text-slate-500">{x.description}</div>
                </td>
                <td className="p-3">{x.sku}</td>
                <td className="p-3">{x.hsnSacCode}</td>
                <td className="p-3">
                  {x.quantity} {x.uom}
                </td>
                <td className="p-3">{money(x.unitPrice)}</td>
                <td className="p-3">{money(x.lineDiscount)}</td>
                <td className="p-3">{money(x.taxableValue)}</td>
                <td className="p-3">{x.gstRateSnapshot}%</td>
                <td className="p-3">{money(x.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="ml-auto max-w-md space-y-1 rounded border border-slate-300 bg-white p-4 text-sm">
        <p>Taxable subtotal {money(invoice.taxableSubtotal)}</p>
        <p>
          CGST {money(invoice.cgstTotal)} · SGST {money(invoice.sgstTotal)} ·
          IGST {money(invoice.igstTotal)} · Cess {money(invoice.cessTotal)}
        </p>
        <p>
          Freight {money(invoice.freightTotal)} · Packing{" "}
          {money(invoice.packingTotal)} · Other{" "}
          {money(invoice.otherChargesTotal)}
        </p>
        <p>
          Discount {money(invoice.discountTotal)} · Round-off{" "}
          {money(invoice.roundOff)}
        </p>
        <p className="border-t border-slate-300 pt-2 text-base font-semibold">
          Invoice total {money(invoice.grandTotal)}
        </p>
        <p>
          Paid {money(invoice.amountPaid)} · Credit notes{" "}
          {money(invoice.amountCredited)}
        </p>
        <p className="font-medium">
          Outstanding {money(invoice.outstandingAmount)}
        </p>
        {Number(invoice.customerCreditBalance) > 0 && (
          <p className="text-amber-800">
            Customer credit / refund obligation:{" "}
            {money(invoice.customerCreditBalance)}
          </p>
        )}
      </article>
      {isAdmin && invoice.status === "DRAFT" && (
        <article className="rounded border border-slate-300 bg-white p-4">
          <h3 className="font-semibold">Review and issue draft</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="text-sm">
              Tax treatment
              <select
                className="mt-1 block rounded border border-slate-300 p-2 bg-white"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
              >
                <option value="INTRA_STATE">Intra-state</option>
                <option value="INTER_STATE">Inter-state</option>
              </select>
            </label>
            <label className="text-sm">
              Place of supply
              <input
                className="mt-1 block rounded border border-slate-300 p-2 bg-white"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
              />
            </label>
            <label className="text-sm">
              State code
              <input
                maxLength={2}
                className="mt-1 block w-24 rounded border border-slate-300 p-2 bg-white"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Due date
              <input
                type="date"
                className="mt-1 block rounded border border-slate-300 p-2 bg-white"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
              onClick={() =>
                void act(() =>
                  api.patch(`/api/invoices/${invoice.id}`, {
                    treatment,
                    placeOfSupply,
                    stateCode,
                    reverseCharge,
                    charges,
                    dueDate: dueDate || null,
                  }),
                )
              }
              className="self-end rounded border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              Save draft
            </button>
            <button
              disabled={busy}
              onClick={() => void act(saveAndIssue)}
              className="self-end rounded bg-emerald-700 px-3 py-2 text-sm text-white"
            >
              Issue invoice
            </button>
          </div>
          {charges.map((c: any, i: number) => (
            <label
              key={c.configurationId}
              className="mr-3 mt-3 inline-block text-sm"
            >
              Configured charge {i + 1}
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 block rounded border border-slate-300 p-2"
                value={c.amount}
                onChange={(e) =>
                  setCharges(
                    charges.map((item: any, idx: number) =>
                      idx === i ? { ...item, amount: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
          ))}
          <p className="mt-2 text-xs text-slate-500">
            Issuance checks required company/customer configuration and
            preserves this version as a private PDF snapshot.
          </p>
        </article>
      )}
      {isAdmin && issued && invoice.status !== "CANCELLED" && (
        <article className="grid gap-4 rounded border border-slate-300 bg-white p-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Record manual payment</h3>
            <p className="mt-1 text-xs text-slate-500">
              Invoice {money(invoice.grandTotal)} · paid{" "}
              {money(invoice.amountPaid)} · outstanding{" "}
              {money(invoice.outstandingAmount)}
            </p>
            <div className="mt-2 grid gap-2">
              <input
                aria-label="Amount received"
                placeholder="Amount received"
                type="number"
                min="0.01"
                step="0.01"
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
                className="rounded border border-slate-300 p-2"
              />
              <input
                aria-label="Payment date"
                type="date"
                value={payment.paymentDate}
                onChange={(e) =>
                  setPayment({ ...payment, paymentDate: e.target.value })
                }
                className="rounded border border-slate-300 p-2"
              />
              <select
                value={payment.mode}
                onChange={(e) =>
                  setPayment({ ...payment, mode: e.target.value })
                }
                className="rounded border border-slate-300 p-2"
              >
                {["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                placeholder="Transaction reference (optional)"
                value={payment.transactionReference}
                onChange={(e) =>
                  setPayment({
                    ...payment,
                    transactionReference: e.target.value,
                  })
                }
                className="rounded border border-slate-300 p-2"
              />
              <input
                placeholder="Bank / UPI details (optional)"
                value={payment.bankDetails}
                onChange={(e) =>
                  setPayment({ ...payment, bankDetails: e.target.value })
                }
                className="rounded border border-slate-300 p-2"
              />
              <textarea
                placeholder="Internal remarks"
                value={payment.remarks}
                onChange={(e) =>
                  setPayment({ ...payment, remarks: e.target.value })
                }
                className="rounded border border-slate-300 p-2"
              />
              <button
                disabled={busy}
                onClick={() => void recordPayment()}
                className="rounded bg-[#9D174D] px-3 py-2 text-sm text-white"
              >
                Record Payment
              </button>
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Cancel invoice</h3>
            <p className="mt-2 text-sm text-slate-500">
              Cancellation requires a reason. Invoices with payment history are
              blocked.
            </p>
            <button
              disabled={busy}
              onClick={() => {
                const reason = window.prompt("Required cancellation reason");
                if (reason)
                  void act(() =>
                    api.post(`/api/invoices/${invoice.id}/cancel`, { reason }),
                  );
              }}
              className="mt-2 rounded border border-rose-300 px-3 py-2 text-sm text-rose-700"
            >
              Cancel invoice
            </button>
          </div>
        </article>
      )}
      {isAdmin && issued && (
        <article className="rounded border border-slate-300 bg-white p-4">
          <h3 className="font-semibold">Create credit note draft</h3>
          <input
            placeholder="Reason"
            value={creditReason}
            onChange={(e) => setCreditReason(e.target.value)}
            className="mt-2 w-full max-w-lg rounded border border-slate-300 p-2"
          />
          <div className="mt-2 space-y-2">
            {invoice.items.map((x: Row) => (
              <label
                key={x.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                {x.productName} · {x.quantity} issued pieces
                <input
                  type="number"
                  min="0"
                  max={x.quantity}
                  value={creditQty[x.id] ?? 0}
                  onChange={(e) =>
                    setCreditQty({
                      ...creditQty,
                      [x.id]: Number(e.target.value),
                    })
                  }
                  className="w-28 rounded border border-slate-300 p-2"
                />
              </label>
            ))}
          </div>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const r = await api.post("/api/credit-notes", {
                  invoiceId: invoice.id,
                  reason: creditReason,
                  items: Object.entries(creditQty)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([invoiceItemId, quantity]) => ({
                      invoiceItemId,
                      quantity,
                    })),
                });
                window.location.href = `/admin/credit-notes/${r.data.item.id}`;
              })
            }
            className="mt-3 rounded border border-slate-300 px-3 py-2 text-sm"
          >
            Create credit note draft
          </button>
        </article>
      )}
      <article className="rounded border border-slate-300 bg-white p-4">
        <h3 className="font-semibold">Payment history</h3>
        {invoice.payments?.length ? (
          invoice.payments.map((p: Row) => (
            <div key={p.id} className="mt-3 border border-slate-300-t pt-3 text-sm">
              <p>
                {new Date(p.paymentDate).toLocaleDateString()} ·{" "}
                {money(p.amount)} · {p.mode} · {p.status} ·{" "}
                {p.recordedBy.firstName} {p.recordedBy.lastName} · recorded{" "}
                {new Date(p.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">
                {p.transactionReference || "No reference"} ·{" "}
                {p.bankDetails || ""} · {p.remarks || ""}
                {p.reversalReason ? ` · Reversal: ${p.reversalReason}` : ""}
              </p>
              {isAdmin && p.status === "RECORDED" && (
                <button
                  onClick={() => {
                    const reason = window.prompt(
                      "Reason for reversing this payment",
                    );
                    if (reason)
                      void act(() =>
                        api.post(`/api/invoices/payments/${p.id}/reverse`, {
                          reason,
                        }),
                      );
                  }}
                  className="mt-1 text-xs text-rose-700 underline"
                >
                  Reverse with reason
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="mt-2 text-sm text-slate-500">No payments recorded.</p>
        )}
      </article>
      {invoice.creditNotes?.length > 0 && (
        <article className="rounded border border-slate-300 bg-white p-4">
          <h3 className="font-semibold">Credit note history</h3>
          {invoice.creditNotes.map((c: Row) => (
            <p key={c.id} className="mt-2 text-sm">
              <Link
                className="underline"
                href={`${isAdmin ? "/admin" : "/sales"}/credit-notes/${c.id}`}
              >
                {c.creditNoteNumber ?? "Draft credit note"}
              </Link>{" "}
              · {c.status} · {money(c.grandTotal)}
            </p>
          ))}
        </article>
      )}
      {issued && (
        <article className="rounded border border-slate-300 bg-white p-4">
          <h3 className="font-semibold">Stored PDF versions</h3>
          {invoice.documents?.map((doc: Row) => (
            <p key={doc.id} className="mt-2 text-sm">
              Version {doc.version} ·{" "}
              {new Date(doc.generatedAt).toLocaleString()} ·{" "}
              {doc.generatedBy.firstName} {doc.generatedBy.lastName} ·{" "}
              {doc.sizeBytes.toLocaleString()} bytes ·{" "}
              <a
                className="underline"
                href={`/api/invoices/${invoice.id}/pdf?documentId=${doc.id}&download=0`}
                target="_blank"
              >
                View
              </a>
            </p>
          ))}
          {isAdmin && (
            <button
              onClick={() => {
                const reason = window.prompt(
                  "Reason for regenerating the PDF from its saved invoice snapshots",
                );
                if (reason)
                  void act(() =>
                    api.post(`/api/invoices/${invoice.id}/pdf/regenerate`, {
                      reason,
                    }),
                  );
              }}
              className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm"
            >
              Regenerate PDF with reason
            </button>
          )}
        </article>
      )}
      <article className="rounded border border-slate-300 bg-white p-4">
        <h3 className="font-semibold">Audit history</h3>
        {invoice.events?.map((e: Row) => (
          <p key={e.id} className="mt-2 text-sm">
            {new Date(e.createdAt).toLocaleString()} ·{" "}
            {e.action.replaceAll("_", " ")} · {e.actor.firstName}{" "}
            {e.actor.lastName}
          </p>
        ))}
      </article>
    </section>
  );
}
