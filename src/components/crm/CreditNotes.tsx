"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
const money = (n: unknown) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
export function CreditNoteWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    api
      .get(
        `/api/credit-notes?page=1&pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      )
      .then((r) => setItems(r.data.items))
      .catch((e) => toast.error(e.response?.data?.error?.message || e.response?.data?.error || "Unable to load credit notes."));
  }, [q]);
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold">Credit Notes</h2>
        <p className="text-sm text-slate-500">
          Authorised adjustments linked to original invoices.
        </p>
      </header>
      <input
        className="rounded border border-slate-300 bg-white p-2 w-[50%]"
        placeholder="Search credit note or invoice"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs">
            <tr>
              {[
                "Credit Note",
                "Invoice",
                "Customer",
                "Reason",
                "Date",
                "Amount",
                "Status",
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
                    className="underline"
                    href={`${isAdmin ? "/admin" : "/sales"}/credit-notes/${x.id}`}
                  >
                    {x.creditNoteNumber ?? "Draft"}
                  </Link>
                </td>
                <td className="p-3">{x.invoice.invoiceNumber}</td>
                <td className="p-3">{x.invoice.customer.businessName}</td>
                <td className="p-3">{x.reason}</td>
                <td className="p-3">
                  {x.issueDate
                    ? new Date(x.issueDate).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-3">{money(x.grandTotal)}</td>
                <td className="p-3">{x.status}</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={7} className="p-5 text-slate-500">
                  No credit notes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function CreditNoteDetail({ isAdmin }: { isAdmin: boolean }) {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  async function load() {
    try {
      const result = (await api.get(`/api/credit-notes/${params.id}`)).data
        .item;
      setItem(result);
      setReason(result.reason);
      setNotes(result.notes ?? "");
      setQuantities(
        Object.fromEntries(
          result.items.map((x: any) => [x.invoiceItemId, x.quantity]),
        ),
      );
    } catch (e: any) {
      setError(e.response?.data?.error || "Unable to load credit note.");
    }
  }
  useEffect(() => {
    void load();
  }, [params.id]);
  async function saveAndIssue() {
    const payload = {
      reason,
      notes,
      items: Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity })),
    };
    await api.patch(`/api/credit-notes/${params.id}`, payload);
    await api.post(`/api/credit-notes/${params.id}/issue`, {});
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/api/credit-notes/${params.id}`, {
        reason,
        notes,
        items: Object.entries(quantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity })),
      });
      await load();
      toast.success("Credit note draft saved successfully.");
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || e.response?.data?.error || "Draft update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function issue() {
    setBusy(true);
    setError("");
    try {
      await saveAndIssue();
      await load();
      toast.success("Credit note issued successfully.");
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || e.response?.data?.error || "Could not issue credit note.");
    } finally {
      setBusy(false);
    }
  }
  if (!item) return <p>{error || "Loading credit note…"}</p>;
  const isDraft = item.status === "DRAFT";
  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <ConfirmDialog open={issueConfirmOpen} onOpenChange={setIssueConfirmOpen} title="Issue credit note?" description="This will issue the credit note against the original invoice and update its credited balance." confirmText="Issue credit note" onConfirm={issue} />
      <Link
        className="text-sm underline"
        href={`${isAdmin ? "/admin" : "/sales"}/credit-notes`}
      >
        Credit notes
      </Link>
      <header>
        <h2 className="text-2xl font-semibold">
          {item.creditNoteNumber ?? "Credit note draft"}
        </h2>
        <p className="text-sm text-slate-500">
          {item.status} · invoice {item.invoice.invoiceNumber} ·{" "}
          {item.invoice.customer.businessName}
        </p>
      </header>
      <article className="space-y-2 rounded border border-slate-300 bg-white p-4">
        <label className="block text-sm">
          Reason
          <input
            disabled={!isAdmin || !isDraft}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
          />
        </label>
        <label className="block text-sm">
          Supporting notes
          <textarea
            disabled={!isAdmin || !isDraft}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
          />
        </label>
        <p className="text-sm">
          <strong>Date:</strong>{" "}
          {item.issueDate
            ? new Date(item.issueDate).toLocaleDateString()
            : "Not issued"}
        </p>
      </article>
      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs">
            <tr>
              {[
                "Invoice line",
                "Quantity credited",
                "Taxable",
                "CGST",
                "SGST",
                "IGST",
                "Cess",
                "Credit",
              ].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {item.items.map((x: any) => (
              <tr key={x.id} className="border-t border-slate-300">
                <td className="p-3">{x.invoiceItem.productName}</td>
                <td className="p-3">
                  {isAdmin && isDraft ? (
                    <input
                      type="number"
                      min="0"
                      max={x.invoiceItem.quantity}
                      value={quantities[x.invoiceItemId] ?? 0}
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [x.invoiceItemId]: Number(e.target.value),
                        })
                      }
                      className="w-24 rounded border border-slate-300 p-2 bg-white"
                    />
                  ) : (
                    x.quantity
                  )}
                </td>
                <td className="p-3">{money(x.taxableValue)}</td>
                <td className="p-3">{money(x.cgstAmount)}</td>
                <td className="p-3">{money(x.sgstAmount)}</td>
                <td className="p-3">{money(x.igstAmount)}</td>
                <td className="p-3">{money(x.cessAmount)}</td>
                <td className="p-3">{money(x.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-lg font-semibold">
        Credit total: {money(item.grandTotal)}
      </p>
      {isAdmin && isDraft && (
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded border border-slate-300 px-4 py-2 text-sm"
          >
            Save draft
          </button>
          <button
            disabled={busy}
            onClick={() => setIssueConfirmOpen(true)}
            className="rounded bg-emerald-700 px-4 py-2 text-sm text-white"
          >
            Issue Credit Note
          </button>
        </div>
      )}
      <article className="rounded border border-slate-300 bg-white p-4">
        <h3 className="font-semibold">Credit note audit</h3>
        {item.events.map((e: any) => (
          <p key={e.id} className="mt-2 text-sm">
            {new Date(e.createdAt).toLocaleString()} · {e.action} ·{" "}
            {e.actor.firstName} {e.actor.lastName}
          </p>
        ))}
      </article>
    </section>
  );
}
