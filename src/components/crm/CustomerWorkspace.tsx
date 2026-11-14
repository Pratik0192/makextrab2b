"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";

type Row = {
  id: string;
  customerCode: string;
  businessName: string;
  buyerName: string;
  mobile: string;
  email: string;
  gstin: string | null;
  city: string;
  state: string;
  status: string;
  convertedAt: string;
  assignedSalesExecutive?: { firstName: string; lastName: string } | null;
  convertedFromLead?: { referenceNumber: string } | null;
};
export default function CustomerWorkspace() {
  const pathname = usePathname();
  const base = pathname.startsWith("/sales") ? "/sales" : "/admin";
  const [items, setItems] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("newest");
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .get("/api/customers", {
          params: {
            q,
            status,
            city,
            state,
            businessType,
            from,
            to,
            assignedTo,
            page,
            pageSize,
            sort,
          },
        })
        .then((r) => {
          setItems(r.data.items);
          setTotal(r.data.total);
          setError("");
        })
        .catch(() => setError("Unable to load customers."));
    }, 200);
    return () => clearTimeout(timer);
  }, [
    q,
    status,
    city,
    state,
    businessType,
    from,
    to,
    assignedTo,
    page,
    pageSize,
    sort,
  ]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Customers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Customer master records created from qualified leads.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            aria-label="Search customers"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search code, business, buyer, phone…"
            className="w-72 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
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
            <option>ACTIVE</option>
            <option>INACTIVE</option>
            <option>BLOCKED</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Filter city"
            placeholder="City"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            aria-label="Filter state"
            placeholder="State"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            aria-label="Business type"
            value={businessType}
            onChange={(e) => {
              setBusinessType(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All business types</option>
            {[
              "WHOLESALER",
              "RETAILER",
              "BOUTIQUE",
              "DISTRIBUTOR",
              "RESELLER",
              "OTHER",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Sort customers"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="business">Business name</option>
            <option value="code">Customer code</option>
          </select>
          <input
            aria-label="Assigned executive ID"
            placeholder="Executive ID"
            value={assignedTo}
            onChange={(e) => {
              setAssignedTo(e.target.value);
              setPage(1);
            }}
            className="w-36 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            aria-label="Converted from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
          <input
            aria-label="Converted to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 bg-white px-2 py-2 text-sm"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {[
                "Customer",
                "Buyer",
                "Contact",
                "GSTIN",
                "Location",
                "Executive",
                "Status",
                "Converted",
              ].map((x) => (
                <th key={x} className="px-4 py-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {error ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-rose-700">
                  {error}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No customers found.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-[#672f35]"
                      href={`${base}/customers/${c.id}`}
                    >
                      {c.customerCode}
                    </Link>
                    <span className="block text-slate-600">
                      {c.businessName}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c.buyerName}</td>
                  <td className="px-4 py-3">
                    {c.mobile}
                    <span className="block text-xs text-slate-500">
                      {c.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c.gstin || "—"}</td>
                  <td className="px-4 py-3">
                    {c.city}, {c.state}
                  </td>
                  <td className="px-4 py-3">
                    {c.assignedSalesExecutive
                      ? `${c.assignedSalesExecutive.firstName} ${c.assignedSalesExecutive.lastName}`
                      : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3">
                    {new Date(c.convertedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-300 p-3 text-xs text-slate-500">
          <span>
            {total} customers · Page {page} of{" "}
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
