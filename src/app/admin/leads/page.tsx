"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axios";
import { toast } from "sonner";
import { ArrowRight, LoaderCircle, Search, X } from "lucide-react";
import { getAdminLeads } from "@/services/lead.service";
import { apiErrorMessage } from "@/services/service-utils";
import type { Pagination } from "@/types/api";
import type { LeadListItem, LeadSource, LeadStage } from "@/types/lead";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

const sources: LeadSource[] = [
  "WEBSITE",
  "WHATSAPP",
  "MANUAL",
  "PHONE",
  "SOCIAL_CAMPAIGN",
  "REFERRAL",
  "WALK_IN",
  "EXISTING_CUSTOMER",
  "IMPORT",
];
const stages: LeadStage[] = [
  "NEW",
  "ASSIGNED",
  "CONTACT_ATTEMPTED",
  "CONTACTED",
  "VERIFICATION_PENDING",
  "QUALIFIED",
  "QUOTATION_ORDER_DISCUSSION",
  "CONVERTED",
  "LOST",
  "ON_HOLD",
];
const labelFor = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminLeadsPage({
  basePath = "/admin/leads",
}: {
  basePath?: string;
}) {
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<LeadSource | "">("");
  const [stage, setStage] = useState<LeadStage | "">("");
  const [priority, setPriority] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [executives, setExecutives] = useState<
    Array<{ id: string; firstName: string; lastName: string; email: string }>
  >([]);
  const [assignedToId, setAssignedToId] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [tag, setTag] = useState("");
  const [lastContactFrom, setLastContactFrom] = useState("");
  const [lastContactTo, setLastContactTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOperation, setBulkOperation] = useState("ASSIGN");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [followUpFrom, setFollowUpFrom] = useState("");
  const [followUpTo, setFollowUpTo] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<
    Array<{ id: string; name: string; sku: string }>
  >([]);
  const [duplicateStatus, setDuplicateStatus] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setPage(Number(q.get("page")) || 1);
    setPageSize(Number(q.get("pageSize")) || 20);
    setSearch(q.get("search") ?? "");
    setSource((q.get("source") as LeadSource) ?? "");
    setStage((q.get("stage") as LeadStage) ?? "");
    setPriority(q.get("priority") ?? "");
    setFrom(q.get("from") ?? "");
    setTo(q.get("to") ?? "");
    setAssignedToId(q.get("assignedToId") ?? "");
    setAssignmentStatus(q.get("assignmentStatus") ?? "");
    setState(q.get("state") ?? "");
    setCity(q.get("city") ?? "");
    setAge(q.get("age") ?? "");
    setFollowUpStatus(q.get("followUpStatus") ?? "");
    setTag(q.get("tag") ?? "");
    setLastContactFrom(q.get("lastContactFrom") ?? "");
    setLastContactTo(q.get("lastContactTo") ?? "");
    setSortBy(q.get("sortBy") ?? "createdAt");
    setSortDirection(q.get("sortDirection") ?? "desc");
    setVerificationStatus(q.get("verificationStatus") ?? "");
    setProductId(q.get("productId") ?? "");
    setFollowUpFrom(q.get("followUpFrom") ?? "");
    setFollowUpTo(q.get("followUpTo") ?? "");
    setDuplicateStatus(q.get("duplicateStatus") ?? "");
    setHydrated(true);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (productSearch.trim()) params.set("search", productSearch.trim());
      void api
        .get(`/api/products?${params}`)
        .then((r) => setProductOptions(r.data.data.items))
        .catch(() => setProductOptions([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [productSearch]);
  useEffect(() => {
    void api
      .get("/api/admin/sales-executives")
      .then((r) =>
        setExecutives(
          r.data.data.items.filter((u: { isActive: boolean }) => u.isActive),
        ),
      )
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminLeads({
        page,
        pageSize,
        search,
        source,
        stage,
        priority,
        from,
        to,
        assignedToId,
        assignmentStatus,
        state,
        city,
        age,
        followUpStatus,
        tag,
        lastContactFrom,
        lastContactTo,
        sortBy,
        sortDirection,
        verificationStatus,
        productId,
        followUpFrom,
        followUpTo,
        duplicateStatus,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch (caught) {
      setError(apiErrorMessage(caught, "Leads could not be loaded right now."));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    search,
    source,
    stage,
    priority,
    from,
    to,
    assignedToId,
    assignmentStatus,
    state,
    city,
    age,
    followUpStatus,
    tag,
    lastContactFrom,
    lastContactTo,
    sortBy,
    sortDirection,
    verificationStatus,
    productId,
    followUpFrom,
    followUpTo,
    duplicateStatus,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search, hydrated]);

  function clearFilters() {
    setSearch("");
    setSource("");
    setStage("");
    setPriority("");
    setFrom("");
    setTo("");
    setAssignedToId("");
    setAssignmentStatus("");
    setState("");
    setCity("");
    setAge("");
    setFollowUpStatus("");
    setTag("");
    setLastContactFrom("");
    setLastContactTo("");
    setVerificationStatus("");
    setProductId("");
    setFollowUpFrom("");
    setFollowUpTo("");
    setDuplicateStatus("");
    setPage(1);
  }

  const hasFilters = Boolean(
    search ||
    source ||
    stage ||
    priority ||
    from ||
    to ||
    assignedToId ||
    assignmentStatus ||
    state ||
    city ||
    age ||
    followUpStatus ||
    tag ||
    lastContactFrom ||
    lastContactTo ||
    verificationStatus ||
    productId ||
    followUpFrom ||
    followUpTo,
  );
  const activeFilterCount = [
    search,
    source,
    stage,
    priority,
    from,
    to,
    assignedToId,
    assignmentStatus,
    state,
    city,
    age,
    followUpStatus,
    tag,
    lastContactFrom,
    lastContactTo,
    verificationStatus,
    productId,
    followUpFrom,
    followUpTo,
    duplicateStatus,
  ].filter(Boolean).length;
  useEffect(() => {
    if (!hydrated) return;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({
      page,
      pageSize,
      search,
      source,
      stage,
      priority,
      from,
      to,
      assignedToId,
      assignmentStatus,
      state,
      city,
      age,
      followUpStatus,
      tag,
      lastContactFrom,
      lastContactTo,
      sortBy,
      sortDirection,
      verificationStatus,
      productId,
      followUpFrom,
      followUpTo,
      duplicateStatus,
    }))
      if (value) query.set(key, String(value));
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${query}`,
    );
  }, [
    hydrated,
    page,
    pageSize,
    search,
    source,
    stage,
    priority,
    from,
    to,
    assignedToId,
    assignmentStatus,
    state,
    city,
    age,
    followUpStatus,
    tag,
    lastContactFrom,
    lastContactTo,
    sortBy,
    sortDirection,
    verificationStatus,
    productId,
    followUpFrom,
    followUpTo,
    duplicateStatus,
  ]);
  function runBulk() {
    if (
      !selected.length ||
      (!bulkValue &&
        bulkOperation !== "ADD_TAGS" &&
        bulkOperation !== "REMOVE_TAGS") ||
      (!bulkTag && ["ADD_TAGS", "REMOVE_TAGS"].includes(bulkOperation))
    )
      return;
    setBulkConfirmOpen(true);
  }
  async function performBulk() {
    setBulkConfirmOpen(false);
    try {
      const field =
        bulkOperation === "ASSIGN"
          ? { assignedToId: bulkValue }
          : bulkOperation === "PRIORITY"
            ? { priority: bulkValue }
            : bulkOperation === "STAGE"
              ? { stage: bulkValue }
              : { tags: [bulkTag] };
      const result = await api.post("/api/admin/leads/bulk", {
        leadIds: selected,
        operation: bulkOperation,
        ...field,
      });
      const data = result.data.data;
      toast.success(
        `${data.updated} updated, ${data.unchanged} unchanged, ${data.failed} rejected.`,
      );
      if (data.failed)
        toast.error(
          data.results
            .filter((r: { status: string }) => r.status === "REJECTED")
            .map(
              (r: { leadId: string; message: string }) =>
                `${r.leadId}: ${r.message}`,
            )
            .join("\n"),
        );
      setSelected([]);
      void load();
    } catch {
      toast.error("Bulk action failed.");
    }
  }
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <ConfirmDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen} title="Apply bulk action?" description={`Apply ${bulkOperation.toLowerCase()} to ${selected.length} selected leads?`} confirmText="Apply action" onConfirm={performBulk} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-[#9a7547]">
            Customer &amp; sales
          </p>
          <h2 className="mt-1 font-serif text-3xl text-[#452d2d]">Leads</h2>
          <p className="mt-2 text-sm text-slate-500">
            Wholesale enquiries submitted through the storefront.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            Total leads
          </p>
          <p className="text-lg font-semibold text-slate-800">
            {pagination.total.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <section
        aria-label="Lead filters"
        className="grid gap-3 rounded-lg border border-[#F3DCE7] shadow-[0_4px_14px_rgba(131,24,67,0.14)] bg-white  p-4 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_160px_160px_160px_auto]"
      >
        <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search business, buyer, phone, email or reference"
            className="min-w-0 flex-1 text-xs outline-none bg-white"
            aria-label="Search leads"
          />
        </label>
        <select
          value={source}
          onChange={(event) => {
            setSource(event.target.value as LeadSource | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs"
        >
          <option value="">All sources</option>
          {sources.map((item) => (
            <option key={item} value={item}>
              {labelFor(item)}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs"
        >
          <option value="">All priorities</option>
          {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
            <option key={p} value={p}>
              {labelFor(p)}
            </option>
          ))}
        </select>
        <select
          value={stage}
          onChange={(event) => {
            setStage(event.target.value as LeadStage | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs"
        >
          <option value="">All stages</option>
          {stages.map((item) => (
            <option key={item} value={item}>
              {labelFor(item)}
            </option>
          ))}
        </select>
        <label className="text-[10px] text-slate-500">
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="mt-1 h-8 w-full rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white"
          />
        </label>
        <label className="text-[10px] text-slate-500">
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="mt-1 h-8 w-full rounded border border-slate-200 px-2 text-xs text-slate-700 bg-white"
          />
        </label>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <X size={14} /> Clear
        </button>
      </section>

      <details className="rounded-lg border border-[#F3DCE7] shadow-[0_4px_14px_rgba(131,24,67,0.14)] bg-white p-4" open>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          More filters and sorting{" "}
          {activeFilterCount > 0 && (
            <span className="ml-2 rounded-full bg-[#f5eeee] px-2 py-1 text-[10px] text-[#9D174D]">
              {activeFilterCount} active
            </span>
          )}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
            placeholder="State"
            className="h-9 rounded border px-3 text-xs bg-white"
          />
          <input
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            placeholder="City"
            className="h-9 rounded border px-3 text-xs bg-white"
          />
          <select
            value={age}
            onChange={(e) => {
              setAge(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded border bg-white px-3 text-xs"
          >
            <option value="">Any lead age</option>
            {["0-7", "8-15", "16-30", "30+"].map((x) => (
              <option key={x} value={x}>
                {x} days
              </option>
            ))}
          </select>
          <select
            value={followUpStatus}
            onChange={(e) => {
              setFollowUpStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded border bg-white px-3 text-xs"
          >
            <option value="">Any follow-up</option>
            {["PENDING", "OVERDUE", "COMPLETED"].map((x) => (
              <option key={x} value={x}>
                {labelFor(x)}
              </option>
            ))}
          </select>
          <input
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setPage(1);
            }}
            placeholder="Tag"
            className="h-9 rounded border px-3 text-xs bg-white"
          />
          <div className="flex gap-1">
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Find product"
              className="h-9 min-w-0 rounded border px-2 text-xs bg-white"
            />
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPage(1);
              }}
              className="h-9 min-w-0 flex-1 rounded border bg-white px-2 text-xs"
            >
              <option value="">Any product</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku}
                </option>
              ))}
            </select>
          </div>
          <select
            value={verificationStatus}
            onChange={(e) => {
              setVerificationStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded border bg-white px-3 text-xs"
          >
            <option value="">Any verification status</option>
            {[
              "PENDING",
              "VERIFIED",
              "NEEDS_MORE_INFORMATION",
              "NOT_APPLICABLE",
            ].map((x) => (
              <option key={x} value={x}>
                {labelFor(x)}
              </option>
            ))}
          </select>
          <select
            value={duplicateStatus}
            onChange={(e) => {
              setDuplicateStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded border bg-white px-3 text-xs"
          >
            <option value="">Any duplicate status</option>
            {["PENDING", "CONFIRMED_DUPLICATE", "DISMISSED", "NONE"].map(
              (x) => (
                <option key={x} value={x}>
                  {labelFor(x)}
                </option>
              ),
            )}
          </select>
          <label className="text-[10px] text-slate-500">
            Follow-up from
            <input
              type="date"
              value={followUpFrom}
              onChange={(e) => {
                setFollowUpFrom(e.target.value);
                setPage(1);
              }}
              className="mt-1 block h-8 rounded border px-2 text-xs bg-white"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            Follow-up to
            <input
              type="date"
              value={followUpTo}
              onChange={(e) => {
                setFollowUpTo(e.target.value);
                setPage(1);
              }}
              className="mt-1 block h-8 rounded border px-2 text-xs bg-white"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            Last contact from
            <input
              type="date"
              value={lastContactFrom}
              onChange={(e) => {
                setLastContactFrom(e.target.value);
                setPage(1);
              }}
              className="mt-1 block h-8 rounded border px-2 text-xs bg-white"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            Last contact to
            <input
              type="date"
              value={lastContactTo}
              onChange={(e) => {
                setLastContactTo(e.target.value);
                setPage(1);
              }}
              className="mt-1 block h-8 rounded border px-2 text-xs bg-white"
            />
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 rounded border bg-white px-3 text-xs"
          >
            {[
              "createdAt",
              "updatedAt",
              "priority",
              "nextFollowUpDate",
              "lastContactAt",
              "leadAge",
              "businessName",
            ].map((x) => (
              <option key={x} value={x}>
                Sort: {labelFor(x)}
              </option>
            ))}
          </select>
          <select
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value)}
            className="h-9 rounded border bg-white px-3 text-xs"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </details>

      {basePath.startsWith("/admin") && (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#F3DCE7] shadow-[0_4px_14px_rgba(131,24,67,0.14)] bg-white p-3 text-xs">
          <strong>{selected.length} selected</strong>
          <select
            value={bulkOperation}
            onChange={(e) => {
              setBulkOperation(e.target.value);
              setBulkValue("");
            }}
            className="rounded border bg-white p-2"
          >
            <option value="ASSIGN">Assign</option>
            <option value="PRIORITY">Priority</option>
            <option value="STAGE">Stage</option>
            <option value="ADD_TAGS">Add tag</option>
            <option value="REMOVE_TAGS">Remove tag</option>
          </select>
          {["ADD_TAGS", "REMOVE_TAGS"].includes(bulkOperation) ? (
            <input
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              placeholder="Tag name"
              className="rounded border p-2"
            />
          ) : bulkOperation === "ASSIGN" ? (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="rounded border bg-white p-2"
            >
              <option value="">Select executive</option>
              {executives.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="rounded border bg-white p-2"
            >
              <option value="">Choose value</option>
              {(bulkOperation === "PRIORITY"
                ? ["LOW", "MEDIUM", "HIGH", "URGENT"]
                : stages.filter((s) => s !== "CONVERTED" && s !== "LOST")
              ).map((x) => (
                <option key={x} value={x}>
                  {labelFor(x)}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={!selected.length}
            onClick={() => void runBulk()}
            className="rounded bg-[#9D174D] px-3 py-2 text-white disabled:opacity-40"
          >
            Apply
          </button>
        </section>
      )}

      {executives.length > 0 && (
        <section className="flex flex-wrap gap-3 rounded-lg border border-[#F3DCE7] shadow-[0_4px_14px_rgba(131,24,67,0.14)] bg-white  p-4">
          <select
            value={assignmentStatus}
            onChange={(e) => {
              setAssignmentStatus(e.target.value);
              setAssignedToId("");
              setPage(1);
            }}
            className="h-10 rounded border px-3 text-xs bg-white"
          >
            <option value="">All assignment states</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
          </select>
          <select
            value={assignedToId}
            onChange={(e) => {
              setAssignedToId(e.target.value);
              setAssignmentStatus("");
              setPage(1);
            }}
            className="h-10 rounded border px-3 text-xs bg-white"
          >
            <option value="">All Sales Executives</option>
            {executives.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-[#F3DCE7] shadow-[0_5px_18px_rgba(131,24,67,0.20)] bg-white">
        {error ? (
          <div
            role="alert"
            className="m-5 rounded-md border border-[#F3DCE7] shadow-[0_5px_18px_rgba(131,24,67,0.20)] bg-rose-50 p-4 text-sm text-rose-800"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 font-medium underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto ">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs ">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {["Lead Reference", "Business Name", "City / State", "Priority", "Stage", "Created", "Actions"].map((heading) => (
                    <th key={heading} scope="col" className="border-b border-slate-200 px-3 py-3 font-semibold">
                      <span className="inline-flex items-center gap-2">{heading}{heading === "Actions" && basePath.startsWith("/admin") && <input aria-label="Select all leads on this page" type="checkbox" checked={items.length > 0 && items.every((item) => selected.includes(item.id))} onChange={(e) => setSelected((cur) => {
                        const next = e.target.checked ? [...new Set([...cur, ...items.map((item) => item.id)])] : cur.filter((id) => !items.some((item) => item.id === id));
                        if (next.length > 100) { toast.error("Bulk actions are limited to 100 leads."); return cur; }
                        return next;
                      })} />}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="h-48 text-center text-slate-500"><LoaderCircle className="mr-2 inline animate-spin" size={16} />Loading leads…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center"><p className="font-serif text-xl text-slate-700">No leads found</p><p className="mt-2 text-xs text-slate-500">New website enquiries will appear here.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-3 text-xs font-medium text-[#9D174D] underline">Clear filters</button>}</td></tr>
                ) : items.map((lead) => (
                  <tr key={lead.id} className="align-middle hover:bg-[#fcfaf8]">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#9D174D]">{lead.referenceNumber}</td>
                    <td className="max-w-64 px-3 py-3"><p className="truncate font-medium text-slate-800" title={lead.businessName}>{lead.businessName}</p></td>
                    <td className="whitespace-nowrap px-3 py-3">{lead.city}<span className="block text-[10px] text-slate-400">{lead.state}</span></td>
                    <td className="whitespace-nowrap px-3 py-3"><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px]">{labelFor(lead.priority)}</span></td>
                    <td className="whitespace-nowrap px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${lead.stage === "NEW" ? "bg-sky-50 text-sky-700" : lead.stage === "QUALIFIED" ? "bg-emerald-50 text-emerald-700" : lead.stage === "LOST" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{labelFor(lead.stage)}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-500">{dateLabel(lead.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-36 flex-wrap items-center gap-2">
                        {basePath.startsWith("/admin") && <input aria-label={`Select ${lead.referenceNumber}`} type="checkbox" checked={selected.includes(lead.id)} onChange={(e) => setSelected((cur) => {
                          if (e.target.checked && cur.length >= 100) { toast.error("Bulk actions are limited to 100 leads."); return cur; }
                          return e.target.checked ? [...cur, lead.id] : cur.filter((id) => id !== lead.id);
                        })} />}
                        <Link href={`${basePath}/${lead.id}`} className="inline-flex items-center gap-1 font-medium text-[#9D174D] hover:underline">View <ArrowRight size={13} /></Link>
                        {executives.length > 0 && <select aria-label={`Assign ${lead.referenceNumber}`} className="max-w-32 rounded border px-2 py-1 text-[10px] bg-white" value={lead.assignedTo?.id ?? ""} onChange={async (e) => {
                          const assignedToId = e.target.value;
                          if (!assignedToId) return;
                          try { await api.patch(`/api/admin/leads/${lead.id}/assign`, { assignedToId }); toast.success("Lead assigned."); void load(); }
                          catch { toast.error("Assignment failed."); }
                        }}><option value="">{lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : "Assign…"}</option>{executives.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}</select>}
                        {[...(lead.duplicateMatchesAsA ?? []), ...(lead.duplicateMatchesAsB ?? [])].some((m) => m.status !== "DISMISSED") && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-800">Possible duplicate</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <label>
              Rows{" "}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="ml-1 rounded border bg-white px-2 py-1"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <span>
              {pagination.total
                ? `Page ${page} of ${pagination.totalPages}`
                : "No results"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
