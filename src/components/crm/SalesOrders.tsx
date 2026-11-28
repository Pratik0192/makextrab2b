"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import api from "@/lib/axios";
import GenerateDispatchInvoice from "@/components/crm/GenerateDispatchInvoice";
import { usePrompt } from "@/components/common/PromptProvider";
import { toast } from "sonner";

type Order = Record<string, any>;
export default function SalesOrders() {
  const prompt = usePrompt();
  const path = usePathname();
  const params = useParams<{ id?: string }>();
  const base = path.startsWith("/sales") ? "/sales" : "/admin";
  const [items, setItems] = useState<Order[]>([]);
  const [record, setRecord] = useState<Order | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState<Record<string, string>>({});
  const [deliveryUnsaved, setDeliveryUnsaved] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [availability, setAvailability] = useState<any>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await api.get(`/api/sales-orders/${params.id}`);
      setRecord(response.data);
      setDeliveryUnsaved(false);
      const order = response.data;
      setDeliveryDraft({
        deliveryAddress: order.deliveryAddress ?? order.customer.deliveryAddress ?? order.customer.businessAddress ?? "",
        deliveryCity: order.deliveryCity ?? order.customer.deliveryCity ?? order.customer.city ?? "",
        deliveryState: order.deliveryState ?? order.customer.deliveryState ?? order.customer.state ?? "",
        deliveryPincode: order.deliveryPincode ?? order.customer.deliveryPincode ?? order.customer.pincode ?? "",
        deliveryContactName: order.deliveryContactName ?? order.customer.deliveryContactName ?? order.customer.buyerName ?? "",
        deliveryContactPhone: order.deliveryContactPhone ?? order.customer.deliveryContactPhone ?? order.customer.mobile ?? "",
      });
    } catch (e) {
      setError((e as any).response?.data?.error || "Unable to load order.");
    }
  }, [params.id]);
  useEffect(() => {
    if (params.id) {
      void load();
      api
        .get("/api/warehouse/warehouses")
        .then((r) => { if (base === "/admin") setWarehouses(r.data.items ?? []); })
        .catch(() => undefined);
    } else {
      api
        .get("/api/sales-orders")
        .then((r) => setItems(r.data.items))
        .catch((e) =>
          setError(e.response?.data?.error || "Unable to load orders."),
        );
    }
  }, [params.id, base, load]);
  useEffect(() => {
    if (params.id && warehouseId && base === "/admin")
      api
        .get(
          `/api/sales-orders/${params.id}/availability?warehouseId=${encodeURIComponent(warehouseId)}`,
        )
        .then((r) => setAvailability(r.data))
        .catch(() => setAvailability(null));
    else setAvailability(null);
  }, [params.id, warehouseId, base]);
  async function action(name: string) {
    let reason = "";
    if (["CANCEL", "REJECT", "HOLD"].includes(name)) {
      reason =
        (await prompt({
          title: name === "CANCEL" ? "Cancel order" : name === "REJECT" ? "Reject order" : "Place order on hold",
          description: name === "CANCEL"
            ? "Cancellation reason (required)"
            : name === "REJECT"
              ? "Rejection reason (required)"
              : "Reason (optional)",
          required: ["CANCEL", "REJECT"].includes(name), multiline: true,
          confirmText: name === "CANCEL" ? "Cancel order" : name === "REJECT" ? "Reject order" : "Continue",
          variant: ["CANCEL", "REJECT"].includes(name) ? "destructive" : "default",
        })) || "";
      if (["CANCEL", "REJECT"].includes(name) && !reason.trim()) return;
    }
    const selectedWarehouse =
      name === "APPROVE" || name === "RETRY_RESERVATION"
        ? warehouseId || (await prompt({ title: "Select warehouse", description: "Enter the active warehouse ID to reserve stock from.", required: true })) || ""
        : "";
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/sales-orders/${params.id}/actions`, {
        action: name,
        reason,
        warehouseId: selectedWarehouse,
      });
      await load();
      toast.success("Order action completed successfully.");
    } catch (e) {
      toast.error((e as any).response?.data?.error?.message || (e as any).response?.data?.error || "Order action failed.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function saveDeliveryDetails() {
    if (!params.id) return;
    setBusy(true);
    try {
      await api.patch(`/api/sales-orders/${params.id}`, deliveryDraft);
      await load();
      setDeliveryUnsaved(false);
      toast.success("Order delivery details saved.");
    } catch (e) {
      toast.error((e as any).response?.data?.error?.message || (e as any).response?.data?.error || "Delivery details could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  if (error && !record && params.id)
    return <p className="rounded bg-rose-50 p-4 text-rose-700">{error}</p>;
  if (!params.id)
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Sales Orders</h2>
            <p className="text-sm text-slate-500">Orders created directly for customers</p>
          </div>
          <Link href={`${base}/orders/create`} className="rounded bg-[#9D174D] px-3 py-2 text-sm text-white">Create sales order</Link>
          <input
            className="rounded border border-slate-300 bg-white px-3 py-2"
            placeholder="Search order or customer"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-xs">
              <tr>
                {[
                  "Order",
                  "Customer",
                  "Date",
                  "Status",
                  "Reservation",
                  "Value",
                ].map((v) => (
                  <th className="p-3" key={v}>
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items
                .filter((i) =>
                  `${i.orderNumber} ${i.customer.businessName}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
                )
                .map((i) => (
                  <tr key={i.id} className="border-b border-slate-300 last:border border-slate-300-0">
                    <td className="p-3">
                      <Link
                        className="font-medium text-[#9D174D] underline"
                        href={`${base}/orders/${i.id}`}
                      >
                        {i.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3">{i.customer.businessName}</td>
                    <td className="p-3">
                      {new Date(i.orderDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">{i.status}</td>
                    <td className="p-3">
                      {i.reservations.some((r: any) => r.status === "SHORTAGE")
                        ? "SHORTAGE"
                        : i.reservations.some(
                              (r: any) => r.status === "RESERVED",
                            )
                          ? "RESERVED"
                          : "—"}
                    </td>
                    <td className="p-3">
                      ₹
                      {Number(i.totalAmount).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              {items.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-500" colSpan={6}>
                    No sales orders yet. Create an order from a customer to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {error && <p className="text-rose-700">{error}</p>}
      </section>
    );
  if (!record) return <p>Loading sales order…</p>;
  const isAdmin = base === "/admin";
  const canApprove = isAdmin;
  const reserved = record.reservations.some(
    (r: any) => r.status === "RESERVED",
  );
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="text-sm underline" href={`${base}/orders`}>
            Sales Orders
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">{record.orderNumber}</h2>
          <p className="text-sm text-slate-500">{record.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["DRAFT", "REJECTED"].includes(record.status) && (
            <button
              disabled={busy || deliveryUnsaved}
              onClick={() => void action("SUBMIT")}
              className="rounded bg-[#9D174D] px-3 py-2 text-sm text-white"
            >
              {record.status === "REJECTED" ? "Resubmit for approval" : "Submit for approval"}
            </button>
          )}
          {canApprove && record.status === "AWAITING_APPROVAL" && (
            <>
              <button
                disabled={busy}
                onClick={() => void action("APPROVE")}
                className="rounded bg-emerald-700 px-3 py-2 text-sm text-white"
              >
                Approve and reserve
              </button>
              {isAdmin && (
                <button
                  disabled={busy}
                  onClick={() => void action("REJECT")}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Reject
                </button>
              )}
            </>
          )}
          {canApprove && record.status === "ON_HOLD" && (
            <>
              <button
                disabled={busy}
                onClick={() => void action("RETRY_RESERVATION")}
                className="rounded bg-emerald-700 px-3 py-2 text-sm text-white"
              >
                Retry / reserve
              </button>
              {isAdmin && (
                <button
                  disabled={busy}
                  onClick={() => void action("RESUME")}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Resume
                </button>
              )}
            </>
          )}
          {isAdmin &&
            ["DRAFT", "AWAITING_APPROVAL", "CONFIRMED"].includes(
              record.status,
            ) && (
              <button
                disabled={busy}
                onClick={() => void action("HOLD")}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                Put on hold
              </button>
            )}
          {isAdmin && record.status !== "CANCELLED" && (
            <button
              disabled={busy}
              onClick={() => void action("CANCEL")}
              className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      {canApprove && warehouses.length > 0 && (
        <div className="max-w-2xl">
          <label className="block text-sm">
            Warehouse for approval reservation
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 bg-white p-2"
            >
              <option value="">Choose warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.code}
                </option>
              ))}
            </select>
          </label>
          {availability && (
            <div className="mt-2 rounded border border-slate-300 bg-white p-3 text-sm">
              <p
                className={
                  availability.canReserve ? "text-emerald-700" : "text-rose-700"
                }
              >
                {availability.canReserve
                  ? "Stock is available for all items."
                  : "Shortage found. This order will not reserve partial quantities."}
              </p>
              {availability.items.map((i: any) => (
                <p
                  key={`${i.productId}-${i.sku}`}
                  className="mt-1 text-slate-600"
                >
                  {i.name} · {i.sku}: need {i.required}, available {i.available}
                  {i.shortage ? `, short ${i.shortage}` : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">Customer and delivery</h3>
          <p className="mt-2">
            {record.customer.businessName} · {record.customer.customerCode}
          </p>
          <p className="text-sm text-slate-600">
            {record.customer.buyerName} · {record.customer.mobile}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm">
            {[record.deliveryAddress, record.deliveryCity, record.deliveryState, record.deliveryPincode].filter(Boolean).join(", ") || "No delivery address on file"}
          </p>
          {(record.deliveryContactName || record.deliveryContactPhone) && <p className="mt-2 text-sm text-slate-600">Shipping contact: {[record.deliveryContactName, record.deliveryContactPhone].filter(Boolean).join(" · ")}</p>}
          {["DRAFT", "REJECTED"].includes(record.status) && <form className="mt-4 space-y-2 border-t pt-4" onSubmit={(event) => { event.preventDefault(); void saveDeliveryDetails(); }}>
            {([ ["deliveryAddress", "Shipping address"], ["deliveryCity", "Shipping city"], ["deliveryState", "Shipping state"], ["deliveryPincode", "Shipping postal code"], ["deliveryContactName", "Shipping contact person"], ["deliveryContactPhone", "Shipping contact phone"] ] as const).map(([key, label]) => <label key={key} className="block text-xs text-slate-600">{label}<input required={!['deliveryContactName', 'deliveryContactPhone'].includes(key)} value={deliveryDraft[key] ?? ""} onChange={(event) => { setDeliveryUnsaved(true); setDeliveryDraft((current) => ({ ...current, [key]: event.target.value })); }} className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>)}
            <button disabled={busy} className="rounded border px-3 py-2 text-xs disabled:opacity-50">Save delivery details</button>
          </form>}
          <p className="mt-2 text-sm text-slate-600">
            {record.deliveryInstructions || "No delivery instructions"}
          </p>
        </article>
        <article className="rounded-lg border border-slate-300 bg-white p-5">
          <h3 className="font-semibold">Order value</h3>
          <p className="mt-3 text-sm">
            Subtotal ₹
            {Number(record.subtotal).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-sm">
            Discount ₹
            {Number(record.discountAmount).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-sm">
            Tax ₹
            {Number(record.taxAmount).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="mt-2 border-t border-slate-300 pt-2 text-lg font-semibold">
            Total ₹
            {Number(record.totalAmount).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Reservation:{" "}
            {reserved
              ? "Reserved"
              : record.reservations.some((r: any) => r.status === "SHORTAGE")
                ? "Shortage"
                : "Not reserved"}
          </p>
        </article>
      </div>
      <article className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Picking</p>
          <p>{record.pickingList?.status ?? "NOT_STARTED"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Packing</p>
          <p>
            {record.packingRecords.some((x: any) => x.status === "COMPLETED")
              ? "COMPLETED"
              : record.packingRecords.length
                ? "IN_PROGRESS"
                : "NOT_STARTED"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Dispatches</p>
          <p>
            {
              record.dispatches.filter((x: any) => x.status === "CONFIRMED")
                .length
            }{" "}
            confirmed
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Latest delivery</p>
          <p>{record.dispatches.at(-1)?.deliveryStatus ?? "NOT_DISPATCHED"}</p>
        </div>
      </article>
      {isAdmin &&
        record.dispatches.some((x: any) => x.status === "CONFIRMED") && (
          <article className="rounded-lg border border-slate-300 bg-white p-5">
            <h3 className="font-semibold">Dispatch invoices</h3>
            {record.dispatches
              .filter((x: any) => x.status === "CONFIRMED")
              .map((d: any) => (
                <div key={d.id} className="mt-3 border-t border-slate-300 pt-3">
                  <p className="text-sm">
                    {d.reference} ·{" "}
                    {d.invoice?.invoiceNumber ??
                      (d.invoice ? "Draft invoice" : "Not invoiced")}
                  </p>
                  <GenerateDispatchInvoice
                    dispatchId={d.id}
                    existingInvoiceId={d.invoice?.id}
                  />
                </div>
              ))}
          </article>
        )}
      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-300 bg-slate-50 text-xs">
            <tr>
              {[
                "Product",
                "SKU",
                "Qty",
                "Unit price / piece",
                "Discount",
                "Line total",
              ].map((v) => (
                <th className="p-3" key={v}>
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {record.items.map((i: any) => (
              <tr key={i.id} className="border-b border-slate-300">
                <td className="p-3">{i.productNameSnapshot}</td>
                <td className="p-3">{i.skuSnapshot}</td>
                <td className="p-3">{i.quantity}</td>
                <td className="p-3">
                  ₹
                  {Number(i.unitPrice).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="p-3">
                  ₹
                  {Number(i.discount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="p-3">
                  ₹
                  {Number(i.lineTotal).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">Reservation history</h3>
        {record.reservations.length ? (
          record.reservations.map((r: any) => (
            <p key={r.id} className="mt-2 border-b border-slate-300 pb-2 text-sm">
              {r.product.name} · {r.warehouse.name} · {r.status} · qty{" "}
              {r.quantity}
              {r.shortageQuantity ? ` · shortage ${r.shortageQuantity}` : ""}
              {r.releaseReason ? ` · ${r.releaseReason}` : ""}
            </p>
          ))
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No reservation recorded.
          </p>
        )}
      </article>
      <article className="rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">Activity</h3>
        {record.events.map((event: any) => (
          <p key={event.id} className="mt-2 text-sm">
            <span className="font-medium">
              {event.action.replaceAll("_", " ")}
            </span>{" "}
            · {event.actor.firstName} {event.actor.lastName} ·{" "}
            {new Date(event.createdAt).toLocaleString()}
          </p>
        ))}
      </article>
    </section>
  );
}
