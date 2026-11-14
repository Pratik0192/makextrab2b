"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import api from "@/lib/axios";
export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const router = useRouter();
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = path.startsWith("/sales") ? "/sales" : "/admin";
  useEffect(() => {
    api
      .get(`/api/customers/${id}`)
      .then((r) => setRecord(r.data))
      .catch((e) =>
        setError(e.response?.data?.error || "Unable to load customer."),
      );
  }, [id]);
  async function updateStatus(status: string) {
    if (!confirm(`Change customer status to ${status}?`)) return;
    setBusy(true);
    try {
      await api.patch(`/api/customers/${id}`, { status });
      const r = await api.get(`/api/customers/${id}`);
      setRecord(r.data);
    } catch (e) {
      setError((e as any).response?.data?.error || "Unable to update status.");
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <p role="alert" className="text-rose-700">
        {error}
      </p>
    );
  if (!record) return <p>Loading customer…</p>;
  const lead = record.convertedFromLead;
  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            <Link href={`${base}/customers`} className="underline">
              Customers
            </Link>{" "}
            / {record.customerCode}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{record.businessName}</h2>
          <p className="text-sm text-slate-500">
            {record.customerCode} · Converted{" "}
            {new Date(record.convertedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`${base}/quotations/create?customerId=${record.id}`}
            className="rounded bg-[#672f35] px-4 py-2 text-sm text-white"
          >
            Create quotation
          </Link>
          {base === "/admin" && (
            <>
              <Link
                href={`/admin/customers/${record.id}/edit`}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                Edit customer
              </Link>
              <select
                disabled={busy}
                aria-label="Change customer status"
                value={record.status}
                onChange={(e) => void updateStatus(e.target.value)}
                className="rounded border border-slate-300 bg-white px-3"
              >
                <option>ACTIVE</option>
                <option>INACTIVE</option>
                <option>BLOCKED</option>
              </select>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="mb-3 font-semibold">Overview</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Buyer", record.buyerName],
              ["Mobile", record.mobile],
              ["WhatsApp", record.whatsappNumber],
              ["Email", record.email],
              ["GSTIN", record.gstin],
              ["Business type", record.businessType],
              ["Location", `${record.city}, ${record.state} ${record.pincode}`],
              ["Address", record.businessAddress],
              [
                "Assigned executive",
                record.assignedSalesExecutive
                  ? `${record.assignedSalesExecutive.firstName} ${record.assignedSalesExecutive.lastName}`
                  : "Unassigned",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="mt-1">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="mb-3 font-semibold">Original lead</h3>
          {lead ? (
            <>
              <p className="text-sm">
                {lead.referenceNumber} · {lead.source} ·{" "}
                {new Date(lead.createdAt).toLocaleDateString()}
              </p>
              <Link
                className="mt-2 inline-block text-sm text-[#672f35] underline"
                href={`/admin/leads/${lead.id}`}
              >
                Open lead details
              </Link>
              <h4 className="mt-4 text-sm font-medium">Product interests</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {lead.leadProducts.map((p: any) => (
                  <li key={p.id}>
                    {p.productNameSnapshot} ({p.skuSnapshot}) · qty{" "}
                    {p.requestedQuantity}
                  </li>
                ))}
              </ul>
              <h4 className="mt-4 text-sm font-medium">Documents</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {lead.documents.map((d: any) => (
                  <li key={d.id}>
                    {d.originalFileName} · {d.documentType}{" "}
                    <a
                      className="ml-2 underline"
                      href={`/api/admin/leads/${lead.id}/documents/${d.id}`}
                    >
                      Secure download
                    </a>
                  </li>
                ))}
                {!lead.documents.length && <li>None attached</li>}
              </ul>
              <h4 className="mt-4 text-sm font-medium">
                Lead and verification activity
              </h4>
              <ul className="mt-2 max-h-52 space-y-2 overflow-auto text-xs">
                {lead.activities.map((a: any) => (
                  <li key={a.id} className="border-b border-slate-300 pb-2">
                    {new Date(a.createdAt).toLocaleString()} · {a.description}
                  </li>
                ))}
                {lead.verificationChecks.map((v: any) => (
                  <li key={v.id} className="border-b border-slate-300 pb-2">
                    {new Date(v.updatedAt).toLocaleString()} · {v.checkType}:{" "}
                    {v.status} {v.remarks || ""}
                  </li>
                ))}
                {lead.assignments.map((a: any) => (
                  <li key={a.id} className="border-b border-slate-300 pb-2">
                    {new Date(a.createdAt).toLocaleString()} · Assigned to{" "}
                    {a.assignedTo.firstName} {a.assignedTo.lastName}
                  </li>
                ))}
                {lead.followUps.map((f: any) => (
                  <li key={f.id} className="border-b border-slate-300 pb-2">
                    Follow-up · due {new Date(f.dueAt).toLocaleString()} ·{" "}
                    {f.status}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm">No lead link</p>
          )}
        </section>
      </div>
      <section className="rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="mb-3 font-semibold">Quotations</h3>
        {record.quotations.length ? (
          <div className="space-y-2">
            {record.quotations.map((q: any) => (
              <Link
                key={q.id}
                href={`${base}/quotations/${q.id}`}
                className="flex justify-between border border-slate-300-b py-2 text-sm"
              >
                <span>
                  {q.quotationNumber} · {q.status}
                </span>
                <span>
                  ₹{Number(q.totalAmount).toLocaleString("en-IN")} ·{" "}
                  {new Date(q.quotationDate).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No quotations yet.</p>
        )}
      </section>
    </div>
  );
}
