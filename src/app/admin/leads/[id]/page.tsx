"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { getAdminLead } from "@/services/lead.service";
import api from "@/lib/axios";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/service-utils";
import type { LeadDetail } from "@/types/lead";

const labelFor = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="mb-4 border-b border-slate-100 pb-3 font-serif text-xl text-[#452d2d]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Value({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-800">
        {value || <span className="text-slate-400">Not provided</span>}
      </dd>
    </div>
  );
}

export default function AdminLeadDetailPage({
  basePath = "/admin/leads",
}: {
  basePath?: string;
}) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityType, setActivityType] = useState("PHONE_CALL");
  const [activityText, setActivityText] = useState("");
  const [contactMade, setContactMade] = useState(false);
  const [followDate, setFollowDate] = useState("");
  const [followNote, setFollowNote] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [conversionOpen, setConversionOpen] = useState(false);
  const [conversionBusy, setConversionBusy] = useState(false);
  const [conversionError, setConversionError] = useState("");
  const [conversionData, setConversionData] = useState<Record<string, string>>(
    {},
  );
  const [duplicateMatches, setDuplicateMatches] = useState<
    Array<{
      id: string;
      status: string;
      confidence: string;
      reasons: string[];
      reviewNote: string | null;
      candidate: {
        id: string;
        referenceNumber: string;
        businessName: string;
        buyerName: string;
        mobile: string;
        email: string;
        gstin: string | null;
        createdAt: string;
        stage: string;
        assignedToId: string | null;
        assignedTo: { firstName: string; lastName: string } | null;
      };
    }>
  >([]);
  const [restrictedDuplicates, setRestrictedDuplicates] = useState(false);
  const [mergeMatch, setMergeMatch] = useState<string>("");
  const [mergePrimaryId, setMergePrimaryId] = useState("");
  const [mergeAssignedToId, setMergeAssignedToId] = useState("");
  const [mergeChoices, setMergeChoices] = useState<
    Record<string, "PRIMARY" | "SECONDARY">
  >({});
  const [executiveChoices, setExecutiveChoices] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  const [editProfile, setEditProfile] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [lostDialog, setLostDialog] = useState(false);
  const [lostNotes, setLostNotes] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [priceObjection, setPriceObjection] = useState("");
  const [reactivationDueAt, setReactivationDueAt] = useState("");
  const [reactivationNote, setReactivationNote] = useState("");
  const [reactivationStage, setReactivationStage] = useState("CONTACTED");
  const [reactivationFollowUpAt, setReactivationFollowUpAt] = useState("");
  const [reactivationFollowUpNote, setReactivationFollowUpNote] = useState("");
  const [mergeOtherLead, setMergeOtherLead] = useState<LeadDetail | null>(null);

  useEffect(() => {
    void api
      .get("/api/auth/session")
      .then((r) => setIsSuperAdmin(r.data.data.role === "SUPER_ADMIN"))
      .catch(() => {});
    let active = true;
    setLoading(true);
    getAdminLead(id)
      .then((result) => {
        if (active) setLead(result);
      })
      .catch((caught) => {
        const mergedId =
          caught && typeof caught === "object"
            ? (
                caught as {
                  response?: {
                    data?: {
                      error?: { details?: { mergedIntoLeadId?: string } };
                    };
                  };
                }
              ).response?.data?.error?.details?.mergedIntoLeadId
            : undefined;
        if (mergedId) {
          router.replace(`${basePath}/${mergedId}`);
          return;
        }
        if (active)
          setError(
            apiErrorMessage(caught, "Lead details could not be loaded."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void api
      .get(`/api/admin/leads/${id}/duplicates`)
      .then((r) => {
        if (active) {
          setDuplicateMatches(r.data.data.items);
          setRestrictedDuplicates(r.data.data.restrictedMatches);
        }
      })
      .catch(() => {});
    void api
      .get("/api/admin/sales-executives")
      .then((r) => {
        if (active)
          setExecutiveChoices(
            r.data.data.items.filter((u: { isActive: boolean }) => u.isActive),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, basePath, router]);

  async function reloadLeadAndDuplicates() {
    const [fresh, matches] = await Promise.all([
      getAdminLead(id),
      api.get(`/api/admin/leads/${id}/duplicates`),
    ]);
    setLead(fresh);
    setDuplicateMatches(matches.data.data.items);
    setRestrictedDuplicates(matches.data.data.restrictedMatches);
  }
  async function beginMerge(matchId: string, candidateId: string) {
    try {
      const other = await getAdminLead(candidateId);
      setMergeOtherLead(other);
      setMergeMatch(matchId);
      setMergePrimaryId(id);
      setMergeAssignedToId(
        lead?.assignedToId === other.assignedToId
          ? (lead?.assignedToId ?? "same")
          : "",
      );
      const fields = [
        "businessName",
        "businessType",
        "gstin",
        "website",
        "socialMediaUrl",
        "buyerName",
        "mobile",
        "whatsappNumber",
        "email",
        "preferredContactMethod",
        "city",
        "state",
        "pincode",
        "country",
        "businessAddress",
        "deliveryAddress",
        "notes",
        "estimatedTotalQuantity",
        "estimatedOrderValue",
        "preferredPaymentMode",
      ];
      const choices: Record<string, "PRIMARY" | "SECONDARY"> = {};
      for (const f of fields) {
        const a = (lead as unknown as Record<string, unknown>)?.[f];
        const b = (other as unknown as Record<string, unknown>)[f];
        if (a !== b && b !== null && b !== undefined && b !== "")
          choices[f] = "PRIMARY";
      }
      setMergeChoices(choices);
    } catch {
      toast.error("The candidate lead could not be loaded for comparison.");
    }
  }
  async function submitMerge() {
    if (!mergeOtherLead || !mergeMatch) return;
    const primaryId = mergePrimaryId;
    const secondaryId = primaryId === id ? mergeOtherLead.id : id;
    const primaryAssigned =
      primaryId === id ? lead?.assignedToId : mergeOtherLead.assignedToId;
    const secondaryAssigned =
      primaryId === id ? mergeOtherLead.assignedToId : lead?.assignedToId;
    let assignedToId: string | null | undefined = undefined;
    if (primaryAssigned !== secondaryAssigned) {
      if (!mergeAssignedToId) {
        toast.error("Choose the surviving lead's assignment.");
        return;
      }
      assignedToId =
        mergeAssignedToId === "__UNASSIGNED__" ? null : mergeAssignedToId;
    }
    try {
      await api.post(`/api/admin/leads/${id}/merge`, {
        primaryLeadId: primaryId,
        secondaryLeadId: secondaryId,
        ...(assignedToId !== undefined ? { assignedToId } : {}),
        fieldChoices: mergeChoices,
      });
      toast.success(
        "Leads merged. The secondary record remains available in its merge history.",
      );
      router.replace(`${basePath}/${primaryId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        apiErrorMessage(
          error,
          "The leads could not be merged. Resolve all field and assignment choices first.",
        ),
      );
    }
  }

  if (loading)
    return (
      <div className="grid min-h-64 place-items-center text-sm text-slate-500">
        <LoaderCircle className="mr-2 inline animate-spin" size={16} />
        Loading lead…
      </div>
    );
  if (error || !lead)
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-xs text-[#9D174D]"
        >
          <ArrowLeft size={14} /> Back to leads
        </Link>
        <div
          role="alert"
          className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
        >
          {error || "This lead could not be found."}
        </div>
      </div>
    );

  const estimatedValue =
    lead.estimatedOrderValue === null
      ? null
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
        }).format(Number(lead.estimatedOrderValue));
  const totalQuantity = lead.leadProducts.reduce(
    (sum, item) => sum + item.requestedQuantity,
    0,
  );
  async function convertLead() {
    if (!lead) return;
    const currentLead = lead;
    setConversionBusy(true);
    setConversionError("");
    try {
      const response = await api.post(
        `/api/admin/leads/${currentLead.id}/convert`,
        conversionData,
      );
      toast.success("Lead converted to customer.");
      router.push(`/admin/customers/${response.data.customer.id}`);
    } catch (e) {
      setConversionError(apiErrorMessage(e, "Lead could not be converted."));
    } finally {
      setConversionBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#9D174D] hover:underline"
        >
          <ArrowLeft size={14} /> Back to leads
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#9a7547]">
              Lead details
            </p>
            <h2 className="mt-1 font-serif text-3xl text-[#452d2d]">
              {lead.businessName}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {lead.referenceNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && lead.stage === "QUALIFIED" && (
              <button
                type="button"
                onClick={() => {
                  setConversionData({
                    businessName: lead.businessName,
                    buyerName: lead.buyerName,
                    mobile: lead.mobile,
                    whatsappNumber: lead.whatsappNumber || "",
                    email: lead.email,
                    gstin: lead.gstin || "",
                    city: lead.city,
                    state: lead.state,
                    pincode: lead.pincode,
                  });
                  setConversionOpen(true);
                }}
                className="rounded-md bg-[#9D174D] px-3 py-2 text-xs font-semibold text-white"
              >
                Convert to Customer
              </button>
            )}
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
              {labelFor(lead.stage)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {labelFor(lead.source)}
            </span>
          </div>
        </div>
      </div>

      {conversionOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="convert-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6">
            <h2 id="convert-title" className="text-xl font-semibold">
              Review customer details
            </h2>
            <p className="my-2 text-sm text-slate-500">
              Corrected values are saved on the Customer record. The original
              lead remains unchanged.
            </p>
            <p className="mb-3 text-xs">
              Lead: {lead.referenceNumber} · Approval:{" "}
              {lead.buyerApprovalStatus || "PENDING"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["businessName", "Business name"],
                  ["buyerName", "Buyer name"],
                  ["mobile", "Mobile"],
                  ["whatsappNumber", "WhatsApp"],
                  ["email", "Email"],
                  ["gstin", "GSTIN"],
                  ["city", "City"],
                  ["state", "State"],
                  ["pincode", "Pincode"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs text-slate-600">
                  {label}
                  <input
                    value={conversionData[key] || ""}
                    onChange={(e) =>
                      setConversionData((current) => ({
                        ...current,
                        [key]: e.target.value,
                      }))
                    }
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 rounded bg-slate-50 p-3 text-xs">
              <strong>Verification checklist</strong>
              {(lead.verificationChecks || []).map((check) => (
                <p key={check.checkType}>
                  {labelFor(check.checkType)}: {labelFor(check.status)}
                </p>
              ))}
              <p>
                Buyer approval:{" "}
                {labelFor(lead.buyerApprovalStatus || "PENDING")}
              </p>
            </div>
            {conversionError && (
              <p role="alert" className="mt-3 text-sm text-rose-700">
                {conversionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConversionOpen(false)}
                className="rounded border px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                disabled={conversionBusy}
                onClick={() => void convertLead()}
                className="rounded bg-[#9D174D] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {conversionBusy ? "Converting…" : "Confirm conversion"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailSection title="Business information">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Value label="Business name" value={lead.businessName} />
          <Value label="Business type" value={labelFor(lead.businessType)} />
          <Value label="GSTIN" value={lead.gstin} />
          <Value
            label="Website"
            value={
              lead.website ? (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#9D174D] underline"
                >
                  {lead.website}
                </a>
              ) : null
            }
          />
          <Value
            label="Social media"
            value={
              lead.socialMediaUrl ? (
                <a
                  href={lead.socialMediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#9D174D] underline"
                >
                  {lead.socialMediaUrl}
                </a>
              ) : null
            }
          />
        </dl>
        <button
          type="button"
          onClick={() => setEditProfile((v) => !v)}
          className="mt-4 rounded border px-3 py-2 text-xs"
        >
          {editProfile
            ? "Close identity editor"
            : "Edit business/contact identity"}
        </button>
        {editProfile && (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const data = Object.fromEntries(fd.entries());
              try {
                const result = await api.patch(
                  `/api/admin/leads/${lead.id}`,
                  data,
                );
                await reloadLeadAndDuplicates();
                setEditProfile(false);
                toast.success(
                  `Details updated. ${result.data.data.newPossibleMatches} possible match(es) detected.`,
                );
              } catch {
                toast.error("Details could not be updated.");
              }
            }}
          >
            {(
              [
                ["businessName", "Business name", lead.businessName],
                ["buyerName", "Buyer name", lead.buyerName],
                ["mobile", "Mobile", lead.mobile],
                [
                  "whatsappNumber",
                  "WhatsApp number",
                  lead.whatsappNumber ?? "",
                ],
                ["email", "Email", lead.email],
                ["gstin", "GSTIN", lead.gstin ?? ""],
                ["city", "City", lead.city],
                ["state", "State", lead.state],
                ["website", "Website", lead.website ?? ""],
                [
                  "socialMediaUrl",
                  "Social media URL",
                  lead.socialMediaUrl ?? "",
                ],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name} className="text-[10px] text-slate-500">
                {label}
                <input
                  name={name}
                  defaultValue={value}
                  className="mt-1 h-9 w-full rounded border px-2 text-xs text-slate-800"
                />
              </label>
            ))}
            <div className="flex items-end">
              <button className="rounded bg-[#542d30] px-4 py-2 text-xs text-white">
                Save and check for duplicates
              </button>
            </div>
          </form>
        )}
      </DetailSection>

      <DetailSection title="Contact information">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Value label="Buyer name" value={lead.buyerName} />
          <Value
            label="Mobile"
            value={
              <a href={`tel:${lead.mobile}`} className="text-[#9D174D]">
                {lead.mobile}
              </a>
            }
          />
          <Value
            label="WhatsApp number"
            value={
              lead.whatsappNumber ? (
                <a
                  href={`tel:${lead.whatsappNumber}`}
                  className="text-[#9D174D]"
                >
                  {lead.whatsappNumber}
                </a>
              ) : null
            }
          />
          <Value
            label="Email"
            value={
              <a href={`mailto:${lead.email}`} className="text-[#9D174D]">
                {lead.email}
              </a>
            }
          />
          <Value
            label="Preferred contact"
            value={labelFor(lead.preferredContactMethod)}
          />
        </dl>
      </DetailSection>

      <DetailSection title="Business address">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Value label="City" value={lead.city} />
          <Value label="State" value={lead.state} />
          <Value label="PIN code" value={lead.pincode} />
          <Value label="Country" value={lead.country} />
          <div className="sm:col-span-2">
            <Value label="Business address" value={lead.businessAddress} />
          </div>
        </dl>
      </DetailSection>

      <DetailSection title="Product interest">
        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <p className="text-slate-500">
            Interested products:{" "}
            <strong className="text-slate-800">
              {lead.leadProducts.length}
            </strong>
          </p>
          <p className="text-slate-500">
            Total requested quantity:{" "}
            <strong className="text-slate-800">
              {totalQuantity ? totalQuantity.toLocaleString("en-IN") : "—"}
            </strong>
          </p>
        </div>
        {lead.leadProducts.length ? (
          <div className="space-y-3">
            {lead.leadProducts.map((item) => {
              const image = item.product?.images[0];
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-md border border-slate-100 p-3"
                >
                  {image ? (
                    <img
                      src={image.imageUrl}
                      alt={image.altText ?? item.productNameSnapshot}
                      className="h-16 w-14 rounded object-cover"
                    />
                  ) : (
                    <div className="h-16 w-14 rounded bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">
                      {item.productNameSnapshot}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                      SKU {item.skuSnapshot}
                    </p>
                    {!item.product && (
                      <p className="mt-1 text-[10px] text-amber-700">
                        Product has since been removed; submitted details are
                        preserved.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-slate-400">
                      Requested
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {item.requestedQuantity.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-500">
            General enquiry. No products were selected.
          </p>
        )}
      </DetailSection>

      <DetailSection title="Possible Duplicate Leads">
        {duplicateMatches.length === 0 && !restrictedDuplicates ? (
          <p className="text-sm text-slate-500">
            No possible duplicate leads have been detected.
          </p>
        ) : (
          <div className="space-y-3">
            {restrictedDuplicates && (
              <p className="rounded bg-amber-50 p-3 text-xs text-amber-800">
                A possible duplicate warning exists, but its lead is outside
                your assigned workspace. Ask a Super Admin to review it.
              </p>
            )}
            {duplicateMatches.map((match) => (
              <article key={match.id} className="rounded border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#9D174D]">
                      <Link
                        href={`${basePath}/${match.candidate.id}`}
                        className="underline"
                      >
                        {match.candidate.referenceNumber} ·{" "}
                        {match.candidate.businessName}
                      </Link>
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {match.candidate.buyerName} · {match.candidate.mobile} ·{" "}
                      {match.candidate.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      GSTIN: {match.candidate.gstin || "Not provided"} ·{" "}
                      {labelFor(match.candidate.stage)} · Created{" "}
                      {dateLabel(match.candidate.createdAt)} ·{" "}
                      {match.candidate.assignedTo
                        ? `${match.candidate.assignedTo.firstName} ${match.candidate.assignedTo.lastName}`
                        : "Unassigned"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px]">
                      {labelFor(match.confidence)} confidence
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px]">
                      {labelFor(match.status)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Matched by: {match.reasons.map(labelFor).join(", ")}
                  {match.reviewNote
                    ? ` · Review note: ${match.reviewNote}`
                    : ""}
                </p>
                {isSuperAdmin && match.status === "PENDING" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const note =
                          window.prompt("Optional review note") ?? "";
                        try {
                          await api.patch(
                            `/api/admin/leads/${id}/duplicates/${match.id}`,
                            { status: "CONFIRMED_DUPLICATE", note },
                          );
                          await reloadLeadAndDuplicates();
                          toast.success("Duplicate confirmed.");
                        } catch {
                          toast.error("Could not confirm this duplicate.");
                        }
                      }}
                      className="rounded bg-[#542d30] px-3 py-2 text-xs text-white"
                    >
                      Confirm duplicate
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const note =
                          window.prompt("Optional dismissal note") ?? "";
                        try {
                          await api.patch(
                            `/api/admin/leads/${id}/duplicates/${match.id}`,
                            { status: "DISMISSED", note },
                          );
                          await reloadLeadAndDuplicates();
                          toast.success("Match dismissed.");
                        } catch {
                          toast.error("Could not dismiss this match.");
                        }
                      }}
                      className="rounded border px-3 py-2 text-xs"
                    >
                      Dismiss false positive
                    </button>
                  </div>
                )}
                {isSuperAdmin && match.status === "CONFIRMED_DUPLICATE" && (
                  <button
                    type="button"
                    onClick={() =>
                      void beginMerge(match.id, match.candidate.id)
                    }
                    className="mt-3 rounded border border-rose-300 px-3 py-2 text-xs text-rose-800"
                  >
                    Compare and merge…
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        {mergeOtherLead && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
              <h3 className="font-serif text-xl">Compare before merging</h3>
              <p className="mt-1 text-xs text-slate-600">
                The primary record and its reference number survive. The
                secondary lead is retained as a merged record with its original
                snapshot.
              </p>
              <label className="mt-4 block text-xs">
                Primary lead
                <select
                  value={mergePrimaryId}
                  onChange={(e) => setMergePrimaryId(e.target.value)}
                  className="ml-2 rounded border bg-white p-2"
                >
                  <option value={id}>
                    {lead.referenceNumber} · {lead.businessName}
                  </option>
                  <option value={mergeOtherLead.id}>
                    {mergeOtherLead.referenceNumber} ·{" "}
                    {mergeOtherLead.businessName}
                  </option>
                </select>
              </label>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead>
                    <tr>
                      <th className="p-2">Field</th>
                      <th className="p-2">
                        {mergePrimaryId === id
                          ? lead.referenceNumber
                          : mergeOtherLead.referenceNumber}{" "}
                        · Primary
                      </th>
                      <th className="p-2">
                        {mergePrimaryId === id
                          ? mergeOtherLead.referenceNumber
                          : lead.referenceNumber}{" "}
                        · Secondary
                      </th>
                      <th className="p-2">Keep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        "businessName",
                        "businessType",
                        "gstin",
                        "website",
                        "socialMediaUrl",
                        "buyerName",
                        "mobile",
                        "whatsappNumber",
                        "email",
                        "preferredContactMethod",
                        "city",
                        "state",
                        "pincode",
                        "country",
                        "businessAddress",
                        "deliveryAddress",
                        "notes",
                        "estimatedTotalQuantity",
                        "estimatedOrderValue",
                        "preferredPaymentMode",
                      ] as const
                    ).map((field) => {
                      const current = (
                        lead as unknown as Record<string, unknown>
                      )[field];
                      const other = (
                        mergeOtherLead as unknown as Record<string, unknown>
                      )[field];
                      const primary = mergePrimaryId === id ? current : other;
                      const secondary = mergePrimaryId === id ? other : current;
                      const differs =
                        JSON.stringify(primary ?? null) !==
                          JSON.stringify(secondary ?? null) &&
                        primary !== null &&
                        primary !== undefined &&
                        primary !== "" &&
                        secondary !== null &&
                        secondary !== undefined &&
                        secondary !== "";
                      return (
                        <tr key={field} className="border-t">
                          <td className="p-2 font-medium">{labelFor(field)}</td>
                          <td className="max-w-64 break-words p-2">
                            {String(primary ?? "—")}
                          </td>
                          <td className="max-w-64 break-words p-2">
                            {String(secondary ?? "—")}
                          </td>
                          <td className="p-2">
                            {differs ? (
                              <select
                                value={mergeChoices[field] ?? "PRIMARY"}
                                onChange={(e) =>
                                  setMergeChoices({
                                    ...mergeChoices,
                                    [field]: e.target.value as
                                      | "PRIMARY"
                                      | "SECONDARY",
                                  })
                                }
                                className="rounded border bg-white p-1"
                              >
                                <option value="PRIMARY">Primary</option>
                                <option value="SECONDARY">Secondary</option>
                              </select>
                            ) : (
                              "Primary / fill empty"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(mergePrimaryId === id
                ? lead.assignedToId
                : mergeOtherLead.assignedToId) !==
                (mergePrimaryId === id
                  ? mergeOtherLead.assignedToId
                  : lead.assignedToId) && (
                <label className="mt-4 block text-xs">
                  Surviving assignment
                  <select
                    value={mergeAssignedToId}
                    onChange={(e) => setMergeAssignedToId(e.target.value)}
                    className="ml-2 rounded border bg-white p-2"
                  >
                    <option value="">Choose explicitly…</option>
                    <option value="__UNASSIGNED__">Leave unassigned</option>
                    {executiveChoices.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMergeOtherLead(null);
                    setMergeMatch("");
                  }}
                  className="rounded border px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Merge ${mergePrimaryId === id ? mergeOtherLead.referenceNumber : lead.referenceNumber} into ${mergePrimaryId === id ? lead.referenceNumber : mergeOtherLead.referenceNumber}? This cannot be undone.`,
                      )
                    )
                      void submitMerge();
                  }}
                  className="rounded bg-rose-800 px-4 py-2 text-xs text-white"
                >
                  Confirm merge
                </button>
              </div>
            </div>
          </div>
        )}
      </DetailSection>

      {!!lead.mergedLeads?.length && (
        <DetailSection title="Merged lead history">
          <div className="space-y-3">
            {lead.mergedLeads.map((merged) => (
              <article key={merged.id} className="rounded border p-3 text-xs">
                <p className="font-semibold">
                  {merged.referenceNumber} · merged{" "}
                  {merged.mergedAt
                    ? dateLabel(merged.mergedAt)
                    : "date unavailable"}
                </p>
                <p className="mt-1 text-slate-600">
                  The original lead record and its values are retained here for
                  audit. Documents, activities, follow-ups, assignment records,
                  product interests, tags and lost cycles are available through
                  the surviving lead.
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[#9D174D]">
                    View preserved original values
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-3 text-[10px]">
                    {JSON.stringify(merged.mergeSnapshot, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title="Order intent">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Value
            label="Estimated total quantity"
            value={lead.estimatedTotalQuantity?.toLocaleString("en-IN")}
          />
          <Value label="Estimated order value" value={estimatedValue} />
          <Value
            label="Preferred payment mode"
            value={
              lead.preferredPaymentMode
                ? labelFor(lead.preferredPaymentMode)
                : null
            }
          />
          <div className="sm:col-span-2">
            <Value label="Delivery address" value={lead.deliveryAddress} />
          </div>
          <div className="sm:col-span-2">
            <Value label="Additional notes" value={lead.notes} />
          </div>
        </dl>
      </DetailSection>

      <DetailSection title="Submission details">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Value label="Lead reference" value={lead.referenceNumber} />
          <Value label="Source" value={labelFor(lead.source)} />
          <Value label="Current stage" value={labelFor(lead.stage)} />
          <Value label="Priority" value={labelFor(lead.priority)} />
          <Value label="Submitted" value={dateLabel(lead.createdAt)} />
          <Value
            label="Privacy and contact consent"
            value={
              lead.consentToPrivacyPolicy && lead.consentToContact
                ? "Accepted"
                : "Not accepted"
            }
          />
          <Value
            label="Information accuracy confirmed"
            value={
              lead.informationAccuracyConfirmed ? "Confirmed" : "Not confirmed"
            }
          />
          <Value
            label="Consent timestamp"
            value={dateLabel(lead.consentedAt)}
          />
        </dl>
      </DetailSection>

      <DetailSection title="Lead tags and priority">
        <div className="flex flex-wrap items-center gap-2">
          {lead.leadTags?.map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs"
            >
              {tag.name}
              <button
                type="button"
                aria-label={`Remove ${tag.name}`}
                onClick={async () => {
                  try {
                    await api.patch(`/api/admin/leads/${lead.id}/tags`, {
                      remove: [tag.name],
                    });
                    const result = await getAdminLead(lead.id);
                    setLead(result);
                    toast.success("Tag removed.");
                  } catch {
                    toast.error("Tag could not be removed.");
                  }
                }}
                className="font-bold text-slate-500"
              >
                ×
              </button>
            </span>
          ))}
          {!lead.leadTags?.length && (
            <span className="text-xs text-slate-500">No tags</span>
          )}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.patch(`/api/admin/leads/${lead.id}/tags`, {
                add: [tagInput],
              });
              setLead(await getAdminLead(lead.id));
              setTagInput("");
              toast.success("Tag added.");
            } catch {
              toast.error("Tag could not be added.");
            }
          }}
        >
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            maxLength={64}
            placeholder="Add a tag"
            className="rounded border bg-white px-3 py-2 text-xs"
          />
          <button className="rounded border px-3 py-2 text-xs">Add tag</button>
        </form>
        {isSuperAdmin && (
          <label className="mt-4 flex items-center gap-2 text-xs">
            Priority
            <select
              value={lead.priority}
              onChange={async (e) => {
                try {
                  await api.patch(`/api/admin/leads/${lead.id}/priority`, {
                    priority: e.target.value,
                  });
                  setLead({
                    ...lead,
                    priority: e.target.value as LeadDetail["priority"],
                  });
                  toast.success("Priority updated.");
                } catch {
                  toast.error("Priority update failed.");
                }
              }}
              className="rounded border bg-white p-2"
            >
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        )}
      </DetailSection>

      <DetailSection title="Uploaded Documents">
        {!lead.documents?.length ? (
          <p className="rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No GST certificate uploaded.
          </p>
        ) : (
          lead.documents.map((doc) => {
            const review = lead.verificationChecks?.find(
              (check) => check.checkType === "GST_CERTIFICATE",
            );
            return (
              <div
                key={doc.id}
                className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {labelFor(doc.documentType)} · {doc.originalFileName}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Filename: {doc.originalFileName} · Uploaded{" "}
                    {dateLabel(doc.uploadedAt)} · Scan:{" "}
                    {labelFor(doc.scanStatus)} · Review:{" "}
                    {labelFor(review?.status ?? "PENDING")}
                  </p>
                  {review && (
                    <p className="mt-1 text-slate-500">
                      Reviewed by {review.updatedBy.firstName}{" "}
                      {review.updatedBy.lastName} ·{" "}
                      {dateLabel(review.updatedAt)}
                      {review.remarks ? ` · ${review.remarks}` : ""}
                    </p>
                  )}
                </div>
                <a
                  className="shrink-0 rounded border px-3 py-2 text-[#9D174D]"
                  href={`/api/admin/leads/${lead.id}/documents/${doc.id}`}
                >
                  View / Download
                </a>
              </div>
            );
          })
        )}
      </DetailSection>

      <DetailSection title="Business verification">
        <p className="mb-3 text-sm">
          GSTIN: <strong>{lead.gstin || "Not provided"}</strong> · Buyer status:{" "}
          <strong>{labelFor(lead.buyerApprovalStatus ?? "PENDING")}</strong>
        </p>
        <div className="space-y-2">
          {[
            "BUSINESS_DETAILS",
            "CONTACT_DETAILS",
            "GST_CERTIFICATE",
            "GSTIN",
            "BUSINESS_LEGITIMACY",
          ].map((type) => {
            const check = lead.verificationChecks?.find(
              (c) => c.checkType === type,
            );
            return (
              <div
                key={type}
                className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs"
              >
                <span className="min-w-40">{labelFor(type)}</span>
                <select
                  defaultValue={check?.status ?? "PENDING"}
                  onChange={async (e) => {
                    try {
                      await api.patch(
                        `/api/admin/leads/${lead.id}/verification`,
                        {
                          checkType: type,
                          status: e.target.value,
                          remarks: check?.remarks ?? "",
                        },
                      );
                      toast.success("Verification updated.");
                    } catch {
                      toast.error("Verification update failed.");
                    }
                  }}
                  className="rounded border p-2 bg-white"
                >
                  {[
                    "PENDING",
                    "VERIFIED",
                    "NEEDS_MORE_INFORMATION",
                    "NOT_APPLICABLE",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {labelFor(s)}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500">
                  {check
                    ? `By ${check.updatedBy.firstName} ${check.updatedBy.lastName} · ${dateLabel(check.updatedAt)}`
                    : "Not reviewed"}
                </span>
                {check?.remarks && <span>{check.remarks}</span>}
              </div>
            );
          })}
        </div>
        {isSuperAdmin && (
          <div className="mt-4 flex flex-wrap gap-2">
            <select
              id="buyer-decision"
              className="rounded border p-2 text-xs bg-white"
            >
              <option value="APPROVED">Approve buyer</option>
              <option value="MORE_INFORMATION_REQUESTED">
                Request more information
              </option>
              <option value="REJECTED">Reject buyer</option>
            </select>
            <input
              id="buyer-reason"
              placeholder="Decision note (rejection reason required)"
              className="min-w-64 flex-1 rounded border p-2 text-xs bg-white"
            />
            <button
              onClick={async () => {
                const status = (
                  document.getElementById("buyer-decision") as HTMLSelectElement
                ).value;
                const reason = (
                  document.getElementById("buyer-reason") as HTMLInputElement
                ).value;
                try {
                  await api.patch(`/api/admin/leads/${lead.id}/verification`, {
                    action: "approval",
                    status,
                    reason,
                  });
                  toast.success("Buyer status updated.");
                } catch {
                  toast.error(
                    "Buyer decision failed. A rejection reason is required.",
                  );
                }
              }}
              className="rounded bg-[#542d30] px-3 py-2 text-xs text-white"
            >
              Save buyer decision
            </button>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Lead stage and follow-ups">
        <div className="flex flex-wrap gap-2">
          {lead.stage !== "LOST" && (
            <select
              value={lead.stage}
              onChange={async (e) => {
                if (e.target.value === "LOST") {
                  setLostReason("");
                  setLostNotes("");
                  setCompetitorName("");
                  setPriceObjection("");
                  setReactivationDueAt("");
                  setLostDialog(true);
                  return;
                }
                try {
                  await api.patch(`/api/admin/leads/${lead.id}/stage`, {
                    stage: e.target.value,
                  });
                  setLead({
                    ...lead,
                    stage: e.target.value as LeadDetail["stage"],
                  });
                  toast.success("Lead stage updated.");
                } catch {
                  toast.error("Stage update failed or is not permitted.");
                }
              }}
              className="rounded border p-2 text-xs bg-white"
            >
              {[
                "NEW",
                "ASSIGNED",
                "CONTACT_ATTEMPTED",
                "CONTACTED",
                "VERIFICATION_PENDING",
                "QUALIFIED",
                "QUOTATION_ORDER_DISCUSSION",
                "LOST",
                "ON_HOLD",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          {lead.stage !== "LOST" && (
            <button
              type="button"
              onClick={() => {
                setLostReason("");
                setLostDialog(true);
              }}
              className="rounded border border-rose-300 px-3 py-2 text-xs text-rose-800"
            >
              Mark as lost…
            </button>
          )}
          <span className="self-center text-xs text-slate-500 bg-white">
            Last contact:{" "}
            {lead.lastContactAt
              ? dateLabel(lead.lastContactAt)
              : "Not recorded"}
          </span>
        </div>
        {lead.stage === "LOST" && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-medium text-amber-900">Reactivate this lead</h3>
            <p className="mt-1 text-xs text-amber-800">
              Reopens this same lead and retains its loss history and reference.
            </p>
            <form
              className="mt-3 grid gap-2 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post(`/api/admin/leads/${lead.id}/reactivate`, {
                    stage: reactivationStage,
                    note: reactivationNote,
                    ...(reactivationFollowUpAt
                      ? {
                          followUpDueAt: new Date(
                            reactivationFollowUpAt,
                          ).toISOString(),
                          followUpNote: reactivationFollowUpNote,
                        }
                      : {}),
                  });
                  setLead(await getAdminLead(lead.id));
                  setReactivationNote("");
                  toast.success("Lead reactivated.");
                } catch (error) {
                  toast.error(
                    apiErrorMessage(error, "Lead could not be reactivated."),
                  );
                }
              }}
            >
              <select
                value={reactivationStage}
                onChange={(e) => setReactivationStage(e.target.value)}
                className="rounded border bg-white p-2 text-xs"
              >
                {[
                  "CONTACT_ATTEMPTED",
                  "CONTACTED",
                  "VERIFICATION_PENDING",
                  "QUALIFIED",
                  "QUOTATION_ORDER_DISCUSSION",
                  "ON_HOLD",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                required
                value={reactivationNote}
                onChange={(e) => setReactivationNote(e.target.value)}
                placeholder="Required reason for reactivation"
                className="rounded border bg-white p-2 text-xs"
              />
              <label className="text-[10px] text-slate-600">
                Optional follow-up
                <input
                  type="datetime-local"
                  value={reactivationFollowUpAt}
                  onChange={(e) => setReactivationFollowUpAt(e.target.value)}
                  className="mt-1 block rounded border bg-white p-2 text-xs"
                />
              </label>
              {reactivationFollowUpAt && (
                <input
                  required
                  value={reactivationFollowUpNote}
                  onChange={(e) => setReactivationFollowUpNote(e.target.value)}
                  placeholder="Follow-up note"
                  className="self-end rounded border bg-white p-2 text-xs"
                />
              )}
              <div>
                <button className="rounded bg-[#542d30] px-4 py-2 text-xs text-white">
                  Confirm reactivation
                </button>
              </div>
            </form>
          </div>
        )}
        {lead.lostHistory?.length ? (
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold">
              Lost and reactivation history
            </h3>
            {lead.lostHistory.map((cycle) => (
              <div key={cycle.id} className="rounded border p-3 text-xs">
                <p className="font-medium">
                  {labelFor(cycle.reason)} · {dateLabel(cycle.lostAt)}
                </p>
                {cycle.notes && (
                  <p className="mt-1 text-slate-600">{cycle.notes}</p>
                )}
                {cycle.competitorName && (
                  <p className="mt-1">Competitor: {cycle.competitorName}</p>
                )}
                {cycle.priceObjection && (
                  <p className="mt-1">
                    Price objection: {cycle.priceObjection}
                  </p>
                )}
                {cycle.reactivationDueAt && (
                  <p className="mt-1">
                    Review date: {dateLabel(cycle.reactivationDueAt)}
                  </p>
                )}
                {cycle.reactivatedAt && (
                  <p className="mt-1 text-emerald-700">
                    Reactivated {dateLabel(cycle.reactivatedAt)} into{" "}
                    {labelFor(cycle.reactivationStage ?? "")}:{" "}
                    {cycle.reactivationNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : null}
        {lostDialog && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <form
              className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-lg bg-white p-5"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.patch(`/api/admin/leads/${lead.id}/stage`, {
                    stage: "LOST",
                    lostReason,
                    lostNotes,
                    competitorName,
                    priceObjection,
                    ...(reactivationDueAt
                      ? {
                          reactivationDueAt: new Date(
                            reactivationDueAt,
                          ).toISOString(),
                        }
                      : {}),
                  });
                  setLead(await getAdminLead(lead.id));
                  setLostReason("");
                  setLostDialog(false);
                  toast.success(
                    "Lead marked as lost with its reason recorded.",
                  );
                } catch (error) {
                  toast.error(
                    apiErrorMessage(error, "Lead could not be marked lost."),
                  );
                }
              }}
            >
              <h3 className="font-serif text-xl">Mark lead as lost</h3>
              <p className="text-xs text-slate-500">
                The lead remains in the CRM and can be reactivated later.
              </p>
              <label className="block text-xs">
                Reason
                <select
                  required
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="mt-1 w-full rounded border bg-white p-2"
                >
                  {[
                    "",
                    "PRICE_TOO_HIGH",
                    "COMPETITOR_SELECTED",
                    "NO_RESPONSE",
                    "REQUIREMENT_CANCELLED",
                    "PAYMENT_ISSUE",
                    "PRODUCT_UNAVAILABLE",
                    "BUYER_NOT_INTERESTED",
                    "BUSINESS_NOT_VERIFIED",
                    "DUPLICATE_LEAD",
                    "OTHER",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {x ? labelFor(x) : "Choose a reason"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                Notes
                {lostReason === "OTHER" && (
                  <span className="text-rose-700"> · Required for Other</span>
                )}
                <textarea
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  required={lostReason === "OTHER"}
                  maxLength={2000}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  Competitor (optional)
                  <input
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    maxLength={160}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label className="text-xs">
                  Price objection (optional)
                  <input
                    value={priceObjection}
                    onChange={(e) => setPriceObjection(e.target.value)}
                    maxLength={500}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
              </div>
              <label className="block text-xs">
                Reactivation review date (optional)
                <input
                  type="datetime-local"
                  value={reactivationDueAt}
                  onChange={(e) => setReactivationDueAt(e.target.value)}
                  className="mt-1 block rounded border p-2"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLostDialog(false)}
                  className="rounded border px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  disabled={
                    !lostReason || (lostReason === "OTHER" && !lostNotes.trim())
                  }
                  className="rounded bg-rose-800 px-4 py-2 text-xs text-white disabled:opacity-40"
                >
                  Confirm LOST
                </button>
              </div>
            </form>
          </div>
        )}
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.post(`/api/admin/leads/${lead.id}/follow-ups`, {
                dueAt: followDate,
                note: followNote,
              });
              toast.success("Follow-up scheduled.");
              setFollowNote("");
            } catch {
              toast.error("Follow-up could not be scheduled.");
            }
          }}
        >
          <input
            type="datetime-local"
            required
            value={followDate}
            onChange={(e) => setFollowDate(e.target.value)}
            className="rounded border p-2 text-xs bg-white"
          />
          <input
            required
            placeholder="Follow-up note"
            value={followNote}
            onChange={(e) => setFollowNote(e.target.value)}
            className="min-w-48 flex-1 rounded border p-2 text-xs bg-white"
          />
          <button className="rounded border px-3 text-xs">Schedule</button>
        </form>
        <div className="mt-3 space-y-2">
          {lead.followUps?.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between rounded border p-2 text-xs"
            >
              <span>
                {dateLabel(item.dueAt)} · {item.note} · {labelFor(item.status)}
              </span>
              {item.status === "PENDING" && (
                <button
                  onClick={async () => {
                    const outcome = window.prompt("Follow-up outcome");
                    if (!outcome) return;
                    try {
                      await api.patch(
                        `/api/admin/leads/${lead.id}/follow-ups/${item.id}`,
                        { status: "COMPLETED", outcome },
                      );
                      toast.success("Follow-up completed.");
                    } catch {
                      toast.error("Could not update follow-up.");
                    }
                  }}
                  className="rounded border px-2 py-1"
                >
                  Complete
                </button>
              )}
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Activity timeline">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.post(`/api/admin/leads/${lead.id}/activities`, {
                activityType,
                description: activityText,
                contactMade,
              });
              toast.success("Activity recorded.");
              setActivityText("");
            } catch {
              toast.error("Activity could not be recorded.");
            }
          }}
        >
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="rounded border p-2 text-xs bg-white"
          >
            {["PHONE_CALL", "WHATSAPP", "EMAIL", "MEETING", "NOTE"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            required
            placeholder="Contact note"
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
            className="min-w-48 flex-1 rounded border p-2 text-xs bg-white"
          />
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={contactMade}
              onChange={(e) => setContactMade(e.target.checked)}
            />{" "}
            Contact made
          </label>
          <button className="rounded bg-[#542d30] px-3 text-xs text-white">
            Add activity
          </button>
        </form>
        <ol className="mt-4 space-y-2">
          {lead.activities?.map((item) => (
            <li
              key={item.id}
              className="border-l-2 border-[#ead8d9] pl-3 text-xs"
            >
              <p>{item.description}</p>
              <p className="mt-1 text-slate-500">
                {labelFor(item.activityType)} ·{" "}
                {item.createdBy
                  ? `${item.createdBy.firstName} ${item.createdBy.lastName}`
                  : "System"}{" "}
                · {dateLabel(item.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      </DetailSection>
    </div>
  );
}
