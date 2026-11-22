"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import api from "@/lib/axios";
import GenerateDispatchInvoice from "@/components/crm/GenerateDispatchInvoice";
import { usePrompt } from "@/components/common/PromptProvider";
import { toast } from "sonner";

type Row = Record<string, any>;
const stages = [
  "NOT_DISPATCHED",
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNED",
];
export default function WarehouseOperations() {
  const prompt = usePrompt();
  const params = useParams<{ id?: string }>();
  const path = usePathname();
  const base = path.startsWith("/admin") ? "/admin" : "/sales";
  const [rows, setRows] = useState<Row[]>([]);
  const [order, setOrder] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [pack, setPack] = useState<Record<string, number>>({});
  const [dispatch, setDispatch] = useState<Record<string, number>>({});
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("IN_TRANSIT");
  const loadOrder = useCallback(async () => {
    try {
      const r = await api.get(`/api/sales-orders/${params.id}`);
      setOrder(r.data);
    } catch (e: any) {
      setError(e.response?.data?.error || "Unable to load fulfilment details.");
    }
  }, [params.id]);
  useEffect(() => {
    if (params.id) void loadOrder();
    else
      api
        .get(`/api/warehouse/orders?page=${page}&q=${encodeURIComponent(q)}`)
        .then((r) => {
          setRows(r.data.items);
          setTotalPages(r.data.totalPages);
        })
        .catch((e) =>
          setError(
            e.response?.data?.error || "Unable to load warehouse queue.",
          ),
        );
  }, [params.id, loadOrder, q, page]);
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await loadOrder();
      toast.success("Warehouse operation completed successfully.");
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || e.response?.data?.error || "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!params.id)
    return (
      <section className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold">Warehouse Orders</h2>
          <p className="text-sm text-slate-500">
            Confirmed orders with active reservations
          </p>
        </header>
        <input
          className="w-full max-w-md rounded border border-slate-300 bg-white p-2"
          placeholder="Search order or customer"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr>
                {[
                  "Order",
                  "Customer",
                  "Date",
                  "Qty",
                  "Warehouse",
                  "Picking",
                  "Packing",
                  "Delivery",
                ].map((x) => (
                  <th className="p-3" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) =>
                  `${r.orderNumber} ${r.customer.businessName}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
                )
                .map((r) => (
                  <tr className="border-t border-slate-300" key={r.id}>
                    <td className="p-3">
                      <Link
                        className="underline text-[#9D174D]"
                        href={`${base}/warehouse/orders/${r.id}`}
                      >
                        {r.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3">{r.customer.businessName}</td>
                    <td className="p-3">
                      {new Date(r.orderDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {r.items.reduce((n: number, i: Row) => n + i.quantity, 0)}
                    </td>
                    <td className="p-3">
                      {[
                        ...new Map(
                          r.reservations.map((x: Row) => [
                            x.warehouse.id,
                            x.warehouse,
                          ]),
                        ).values(),
                      ]
                        .map((w: any) => w.name)
                        .join(", ")}
                    </td>
                    <td className="p-3">
                      {r.pickingList?.status ?? "NOT_STARTED"}
                    </td>
                    <td className="p-3">
                      {r.packingRecords.some(
                        (x: Row) => x.status === "COMPLETED",
                      )
                        ? "COMPLETED"
                        : r.packingRecords.length
                          ? "IN_PROGRESS"
                          : "NOT_STARTED"}
                    </td>
                    <td className="p-3">
                      {r.dispatches.at(-1)?.deliveryStatus ?? "NOT_DISPATCHED"}
                    </td>
                  </tr>
                ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-5 text-slate-500" colSpan={8}>
                    No confirmed orders need warehouse fulfilment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
        {error && <p className="text-rose-700">{error}</p>}
      </section>
    );
  if (!order)
    return <p className="text-slate-600">Loading order fulfilment…</p>;
  const picking = order.pickingList as Row | null;
  const alreadyPacked = new Map<string, number>();
  for (const record of order.packingRecords)
    for (const pkg of record.packages)
      for (const item of pkg.items)
        alreadyPacked.set(
          item.salesOrderItemId,
          (alreadyPacked.get(item.salesOrderItemId) ?? 0) + item.packedQuantity,
        );
  const dispatched = new Map<string, number>();
  for (const shipment of order.dispatches)
    if (shipment.status === "CONFIRMED")
      for (const line of shipment.items)
        dispatched.set(
          line.packageItemId,
          (dispatched.get(line.packageItemId) ?? 0) + line.quantity,
        );
  const dispatchables: Array<{ id: string; label: string; remaining: number }> =
    order.packingRecords
      .filter((r: Row) => r.status === "COMPLETED")
      .flatMap((r: Row) =>
        r.packages.flatMap((pkg: Row) =>
          pkg.items.map((item: Row) => ({
            id: item.id,
            label: `${item.salesOrderItem.productNameSnapshot ?? item.salesOrderItem.skuSnapshot} · Package ${pkg.packageNumber}`,
            remaining: item.packedQuantity - (dispatched.get(item.id) ?? 0),
          })),
        ),
      )
      .filter((x: any) => x.remaining > 0);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <Link href={`${base}/warehouse/orders`} className="text-sm underline">
            Warehouse Orders
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">
            {order.orderNumber} · {order.customer.businessName}
          </h2>
          <p className="text-sm text-slate-500">
            Order {order.status} ·{" "}
            {order.reservations[0]?.warehouse.name ?? "No active reservation"}
          </p>
        </div>
        <Link href={`${base}/orders/${order.id}`} className="text-sm underline">
          Sales order details
        </Link>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <section className="rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">1. Picking</h3>
        {!picking ? (
          <button
            disabled={busy}
            onClick={() =>
              void run(() =>
                api.post(`/api/warehouse/orders/${order.id}/picking`),
              )
            }
            className="mt-3 rounded bg-[#9D174D] px-4 py-2 text-sm text-white"
          >
            Create picking list
          </button>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">
              {picking.reference} · {picking.status}
            </p>
            {picking.status !== "COMPLETED" && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      api.patch(`/api/warehouse/picking/${picking.id}`, {
                        action: "START",
                      }),
                    )
                  }
                  className="mt-3 rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Start picking
                </button>
                <div className="mt-3 space-y-2">
                  {picking.items.map((line: Row) => (
                    <div
                      className="grid items-center gap-2 md:grid-cols-[1fr_120px_150px]"
                      key={line.id}
                    >
                      <span className="text-sm">
                        {
                          order.items.find(
                            (i: Row) => i.id === line.salesOrderItemId,
                          )?.productNameSnapshot
                        }{" "}
                        · {line.reservedQuantity} reserved
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={line.reservedQuantity}
                        value={pick[line.id] ?? line.pickedQuantity}
                        onChange={(e) =>
                          setPick({
                            ...pick,
                            [line.id]: Number(e.target.value),
                          })
                        }
                        className="rounded border border-slate-300 p-2 bg-white"
                      />
                      <button
                        disabled={busy}
                        onClick={async () => {
                          const quantity = pick[line.id] ?? line.pickedQuantity;
                          const note =
                            quantity < line.reservedQuantity
                              ? (await prompt({ title: "Pick discrepancy", description: "Enter the required reason for the quantity discrepancy.", required: true, multiline: true })) || ""
                              : "";
                          if (quantity < line.reservedQuantity && !note) return;
                          void run(() =>
                            api.patch(`/api/warehouse/picking/${picking.id}`, {
                              action: "UPDATE_ITEM",
                              itemId: line.id,
                              quantity,
                              discrepancyNote: note,
                            }),
                          );
                        }}
                        className="rounded border border-slate-300 px-3 py-2 text-sm"
                      >
                        Save picked qty
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      api.patch(`/api/warehouse/picking/${picking.id}`, {
                        action: "COMPLETE",
                      }),
                    )
                  }
                  className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm text-white"
                >
                  Complete picking
                </button>
              </>
            )}
          </>
        )}
      </section>
      <section className="rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">2. Packing</h3>
        <p className="text-xs text-slate-500">
          Create a packing record with one package; add package details and
          quantities.
        </p>
        {picking?.status === "COMPLETED" && (
          <>
            <div className="mt-3 space-y-2">
              {picking.items.map((line: Row) => {
                const item = order.items.find(
                  (i: Row) => i.id === line.salesOrderItemId,
                );
                const rem =
                  line.pickedQuantity -
                  (alreadyPacked.get(line.salesOrderItemId) ?? 0);
                return (
                  <label
                    className="grid grid-cols-[1fr_120px] items-center gap-2 text-sm"
                    key={line.id}
                  >
                    {item?.productNameSnapshot} · {rem} picked qty remaining to
                    pack
                    <input
                      type="number"
                      min="0"
                      max={rem}
                      value={pack[line.salesOrderItemId] ?? (rem > 0 ? rem : 0)}
                      onChange={(e) =>
                        setPack({
                          ...pack,
                          [line.salesOrderItemId]: Number(e.target.value),
                        })
                      }
                      className="rounded border border-slate-300 p-2 bg-white"
                    />
                  </label>
                );
              })}
            </div>
            <button
              disabled={busy}
              onClick={async () => {
                const items = Object.entries(pack)
                  .filter(([, quantity]) => quantity > 0)
                  .map(([salesOrderItemId, quantity]) => ({
                    salesOrderItemId,
                    quantity,
                  }));
                if (!items.length) {
                  toast.error("Enter packed quantities first.");
                  return;
                }
                const description = await prompt({ title: "Package description", description: "Optional description for this package." });
                if (description === null) return;
                void run(async () => {
                  const r = await api.post(
                    `/api/warehouse/orders/${order.id}/packing`,
                    {
                      packages: [
                        {
                          description,
                          items,
                        },
                      ],
                    },
                  );
                  await api.patch(`/api/warehouse/packing/${r.data.id}`, {
                    action: "COMPLETE",
                  });
                  setPack({});
                });
              }}
              className="mt-3 rounded bg-[#9D174D] px-3 py-2 text-sm text-white"
            >
              Create and complete package
            </button>
          </>
        )}
      </section>
      <section className="rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">3. Dispatch</h3>
        {dispatchables.length > 0 && (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="Transport / courier name"
                className="rounded border border-slate-300 p-2 text-sm bg-white"
              />
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Tracking / consignment number"
                className="rounded border border-slate-300 p-2 text-sm bg-white"
              />
            </div>
            <div className="mt-3 space-y-2">
              {dispatchables.map((item) => (
                <label
                  className="grid grid-cols-[1fr_120px] items-center gap-2 text-sm"
                  key={item.id}
                >
                  {item.label} · {item.remaining} packed
                  <input
                    type="number"
                    min="0"
                    max={item.remaining}
                    value={dispatch[item.id] ?? 0}
                    onChange={(e) =>
                      setDispatch({
                        ...dispatch,
                        [item.id]: Number(e.target.value),
                      })
                    }
                    className="rounded border border-slate-300 p-2 bg-white"
                  />
                </label>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const items = Object.entries(dispatch)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([packageItemId, quantity]) => ({
                      packageItemId,
                      quantity,
                    }));
                  if (!items.length)
                    throw new Error("Enter a dispatch quantity.");
                  const r = await api.post(
                    `/api/warehouse/orders/${order.id}/dispatches`,
                    {
                      courierName: courier,
                      trackingNumber: tracking,
                      packageCount: 1,
                      items,
                    },
                  );
                  await api.patch(`/api/warehouse/dispatches/${r.data.id}`, {
                    action: "CONFIRM",
                  });
                  setDispatch({});
                })
              }
              className="mt-3 rounded bg-[#9D174D] px-3 py-2 text-sm text-white"
            >
              Create and confirm dispatch
            </button>
          </>
        )}
      </section>
      <section className="rounded-lg border border-slate-300 bg-white p-5">
        <h3 className="font-semibold">4. Dispatch and delivery timeline</h3>
        {order.dispatches.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No dispatches yet.</p>
        ) : (
          order.dispatches.map((d: Row) => (
            <div key={d.id} className="mt-3 border-t border-slate-300 pt-3 text-sm">
              <p className="font-medium">
                {d.reference} · {d.status} · {d.deliveryStatus}
              </p>
              <p className="text-slate-600">
                {d.courierName || "Transport not set"} ·{" "}
                {d.trackingNumber || "No tracking number"} ·{" "}
                {d.items.reduce((n: number, i: Row) => n + i.quantity, 0)}{" "}
                pieces
              </p>
              {base === "/admin" && d.status === "CONFIRMED" && (
                <GenerateDispatchInvoice
                  dispatchId={d.id}
                  existingInvoiceId={d.invoice?.id}
                />
              )}
              {d.status === "CONFIRMED" &&
                !["DELIVERED", "RETURNED"].includes(d.deliveryStatus) && (
                  <div className="mt-2 flex gap-2">
                    <select
                      value={deliveryStatus}
                      onChange={(e) => setDeliveryStatus(e.target.value)}
                      className="rounded border border-slate-300 p-2 bg-white"
                    >
                      {stages
                        .filter(
                          (s) =>
                            s !== "NOT_DISPATCHED" && s !== d.deliveryStatus,
                        )
                        .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                    </select>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        const failureReason = deliveryStatus === "DELIVERY_FAILED" ? await prompt({ title: "Delivery failed", description: "Enter the delivery failure reason.", required: true, multiline: true }) : undefined;
                        if (deliveryStatus === "DELIVERY_FAILED" && !failureReason) return;
                        void run(() =>
                          api.post(
                            `/api/warehouse/dispatches/${d.id}/delivery`,
                            {
                              status: deliveryStatus,
                              ...(deliveryStatus === "DELIVERY_FAILED"
                                ? {
                                    failureReason,
                                  }
                                : {}),
                            },
                          ),
                        );
                      }}
                      className="rounded bg-[#9D174D] text-white px-3 py-2"
                    >
                      Update delivery
                    </button>
                  </div>
                )}
              {d.deliveryEvents?.map((ev: Row) => (
                <p key={ev.id} className="mt-2 text-xs text-slate-500">
                  {ev.previousStatus} → {ev.newStatus} ·{" "}
                  {new Date(ev.createdAt).toLocaleString()}
                  {ev.notes ? ` · ${ev.notes}` : ""}
                  {ev.failureReason ? ` · ${ev.failureReason}` : ""}
                </p>
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
