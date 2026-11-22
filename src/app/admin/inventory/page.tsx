"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  History,
  LoaderCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { apiErrorMessage } from "@/services/service-utils";
import {
  adjustStock,
  createStockTransfer,
  listInventory,
  listStockLedger,
  listStockTransfers,
  stockIn,
  stockOut,
} from "@/services/inventory.service";
import { listWarehouses } from "@/services/warehouse.service";
import { getAdminProducts } from "@/services/product.service";
import type {
  StockBalance,
  StockLedger,
  StockMovementType,
  StockTransfer,
} from "@/types/inventory";
import type { Warehouse } from "@/types/warehouse";
import type { AdminProduct } from "@/types/product";

type Mode = "in" | "out" | "adjustment";
const movementNames: Record<StockMovementType, string> = {
  OPENING_STOCK: "Opening stock",
  STOCK_IN: "Stock in",
  STOCK_OUT: "Stock out",
  ADJUSTMENT_IN: "Adjustment in",
  ADJUSTMENT_OUT: "Adjustment out",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};
export default function InventoryPage() {
  const [rows, setRows] = useState<StockBalance[]>([]),
    [warehouses, setWarehouses] = useState<Warehouse[]>([]),
    [products, setProducts] = useState<AdminProduct[]>([]),
    [search, setSearch] = useState(""),
    [warehouseId, setWarehouseId] = useState(""),
    [lowStock, setLowStock] = useState(false),
    [page, setPage] = useState(1),
    [totalPages, setTotalPages] = useState(1),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState<Mode | null>(null),
    [busy, setBusy] = useState(false),
    [ledger, setLedger] = useState<StockLedger[] | null>(null),
    [transferOpen, setTransferOpen] = useState(false),
    [transferConfirmOpen, setTransferConfirmOpen] = useState(false),
    [transferRows, setTransferRows] = useState<StockTransfer[] | null>(null),
    [transferPage, setTransferPage] = useState(1),
    [transferPages, setTransferPages] = useState(1),
    [adjustDirection, setAdjustDirection] = useState<"increase" | "decrease">(
      "increase",
    ),
    [transferForm, setTransferForm] = useState({
      productId: "",
      sourceWarehouseId: "",
      destinationWarehouseId: "",
      quantity: "",
      reference: "",
      notes: "",
    }),
    [form, setForm] = useState({
      productId: "",
      warehouseId: "",
      quantity: "",
      reason: "",
      reference: "",
      notes: "",
      reorderLevel: "",
    });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listInventory({
        page,
        pageSize: 20,
        search,
        warehouseId: warehouseId || undefined,
        lowStock,
      });
      setRows(result.items);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load inventory."));
    } finally {
      setLoading(false);
    }
  }, [page, search, warehouseId, lowStock]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    Promise.all([
      listWarehouses({ pageSize: 100, active: true }),
      getAdminProducts({ pageSize: 100, active: true }),
    ])
      .then(([w, p]) => {
        setWarehouses(w.items);
        setProducts(p.items);
      })
      .catch((error) =>
        toast.error(
          apiErrorMessage(
            error,
            "Could not load product and warehouse options.",
          ),
        ),
      );
  }, []);
  const start = (action: Mode) => {
    setForm({
      productId: "",
      warehouseId: warehouseId || "",
      quantity: "",
      reason: "",
      reference: "",
      notes: "",
      reorderLevel: "",
    });
    setAdjustDirection("increase");
    setMode(action);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const qty = Number(form.quantity);
      const data = {
        productId: form.productId,
        warehouseId: form.warehouseId,
        quantity:
          mode === "adjustment" && adjustDirection === "decrease"
            ? -Math.abs(qty)
            : qty,
        reason: form.reason.trim(),
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        ...(form.reorderLevel === ""
          ? {}
          : { reorderLevel: Number(form.reorderLevel) }),
      };
      if (mode === "in") await stockIn(data);
      else if (mode === "out") await stockOut(data);
      else await adjustStock(data);
      toast.success("Stock movement recorded.");
      setMode(null);
      await load();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "Could not record the stock movement."),
      );
    } finally {
      setBusy(false);
    }
  };
  const showLedger = async (balance?: StockBalance) => {
    try {
      const result = await listStockLedger({
        page: 1,
        pageSize: 50,
        productId: balance?.productId,
        warehouseId: balance?.warehouseId,
      });
      setLedger(result.items);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load stock ledger."));
    }
  };
  const showTransfers = async (nextPage = 1) => {
    try {
      const result = await listStockTransfers({ page: nextPage, pageSize: 20 });
      setTransferRows(result.items);
      setTransferPage(nextPage);
      setTransferPages(Math.max(1, result.pagination.totalPages));
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load transfer history."));
    }
  };
  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.id === transferForm.productId);
    const source = warehouses.find(
      (w) => w.id === transferForm.sourceWarehouseId,
    );
    const destination = warehouses.find(
      (w) => w.id === transferForm.destinationWarehouseId,
    );
    if (!product || !source || !destination) {
      toast.error("Choose a product and two warehouses.");
      return;
    }
    setTransferConfirmOpen(true);
  };
  const completeTransfer = async () => {
    const product = products.find((p) => p.id === transferForm.productId);
    const source = warehouses.find((w) => w.id === transferForm.sourceWarehouseId);
    const destination = warehouses.find((w) => w.id === transferForm.destinationWarehouseId);
    if (!product || !source || !destination) return;
    setTransferConfirmOpen(false);
    setBusy(true);
    try {
      await createStockTransfer({
        productId: product.id,
        sourceWarehouseId: source.id,
        destinationWarehouseId: destination.id,
        quantity: Number(transferForm.quantity),
        reference: transferForm.reference || undefined,
        notes: transferForm.notes || undefined,
      });
      toast.success("Warehouse transfer completed and recorded.");
      setTransferOpen(false);
      await load();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "Could not complete warehouse transfer."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <ConfirmDialog open={transferConfirmOpen} onOpenChange={setTransferConfirmOpen} title="Confirm warehouse transfer?" description={`Transfer ${transferForm.quantity} × ${products.find(p => p.id === transferForm.productId)?.name ?? "product"} from ${warehouses.find(w => w.id === transferForm.sourceWarehouseId)?.name ?? "source warehouse"} to ${warehouses.find(w => w.id === transferForm.destinationWarehouseId)?.name ?? "destination warehouse"}?`} confirmText="Transfer stock" onConfirm={completeTransfer} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-[#9a7547]">
            Catalogue &amp; inventory
          </p>
          <h2 className="mt-1 font-serif text-3xl text-slate-800">Inventory</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review available stock and record traceable movements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => start("in")}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <ArrowDownToLine size={16} /> Stock in
          </button>
          <button
            onClick={() => start("out")}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <ArrowUpFromLine size={16} /> Stock out
          </button>
          <button
            onClick={() => start("adjustment")}
            className="inline-flex items-center gap-2 rounded-md bg-[#9D174D] px-3 py-2.5 text-sm text-white"
          >
            <SlidersHorizontal size={16} /> Adjustment
          </button>
          <button
            onClick={() => {
              setTransferForm({
                productId: "",
                sourceWarehouseId: "",
                destinationWarehouseId: "",
                quantity: "",
                reference: "",
                notes: "",
              });
              setTransferOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <ArrowLeftRight size={16} /> Transfer
          </button>
          <button
            onClick={() => void showLedger()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <History size={16} /> Ledger
          </button>
          <button
            onClick={() => void showTransfers()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            Transfer history
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-slate-300 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-300 p-4">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-slate-300 px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product or SKU"
              className="bg-white h-10 w-full text-sm outline-none"
            />
          </label>
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm bg-white"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={lowStock}
              onChange={(e) => {
                setLowStock(e.target.checked);
                setPage(1);
              }}
            />{" "}
            Low stock only
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Reserved</th>
                <th className="px-4 py-3">Blocked</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Reorder at</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <LoaderCircle className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No stock balances match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.product.name}</p>
                      <p className="text-xs text-slate-500">{b.product.sku}</p>
                    </td>
                    <td className="px-4 py-3">
                      {b.warehouse.name}
                      <p className="text-xs text-slate-500">
                        {b.warehouse.code}
                      </p>
                    </td>
                    <td className="px-4 py-3">{b.quantityOnHand}</td>
                    <td className="px-4 py-3">{b.quantityReserved}</td>
                    <td className="px-4 py-3">{b.quantityBlocked}</td>
                    <td className="px-4 py-3 font-semibold">
                      {b.availableQuantity}
                    </td>
                    <td className="px-4 py-3">{b.reorderLevel ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${b.stockStatus === "IN_STOCK" ? "bg-emerald-50 text-emerald-700" : b.stockStatus === "LOW_STOCK" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}
                      >
                        {b.stockStatus.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void showLedger(b)}
                        className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      >
                        History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-300 px-5 py-3 text-xs text-slate-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {mode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form
            onSubmit={(e) => void submit(e)}
            className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div>
              <h3 className="text-lg font-semibold">
                {mode === "in"
                  ? "Stock in"
                  : mode === "out"
                    ? "Stock out"
                    : "Stock adjustment"}
              </h3>
              <p className="text-sm text-slate-500">
                Every operation is recorded in the stock ledger.
              </p>
            </div>
            <label className="block text-sm font-medium">
              Product
              <select
                required
                value={form.productId}
                onChange={(e) =>
                  setForm({ ...form, productId: e.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.sku}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Warehouse
              <select
                required
                value={form.warehouseId}
                onChange={(e) =>
                  setForm({ ...form, warehouseId: e.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {w.code}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                {mode === "adjustment" ? "Quantity difference" : "Quantity"}
                <input
                  required
                  type="number"
                  min={1}
                  step="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
                />
                {mode === "adjustment" && (
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Choose whether the correction adds or removes stock.
                  </span>
                )}
              </label>
              {mode === "adjustment" && (
                <label className="block text-sm font-medium">
                  Adjustment direction
                  <select
                    value={adjustDirection}
                    onChange={(e) =>
                      setAdjustDirection(
                        e.target.value as "increase" | "decrease",
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
                  >
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </select>
                </label>
              )}
              {mode === "in" && (
                <label className="block text-sm font-medium">
                  Reorder level (optional)
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={form.reorderLevel}
                    onChange={(e) =>
                      setForm({ ...form, reorderLevel: e.target.value })
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
                  />
                </label>
              )}
            </div>
            <label className="block text-sm font-medium">
              Reason {mode === "in" ? "(optional)" : "*"}
              <input
                required={mode !== "in"}
                minLength={mode === "in" ? undefined : 2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder={
                  mode === "adjustment"
                    ? "Why is the stock being corrected?"
                    : mode === "out"
                      ? "Reason for stock out"
                      : "Reason for receipt (optional)"
                }
                className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
              />
            </label>
            <label className="block text-sm font-medium">
              Reference (optional)
              <input
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
              />
            </label>
            <label className="block text-sm font-medium">
              Notes (optional)
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-slate-300 p-3 font-normal bg-white"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-md bg-[#9D174D] px-4 py-2 text-sm text-white"
              >
                {busy ? "Recording…" : "Record movement"}
              </button>
            </div>
          </form>
        </div>
      )}
      {transferOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form
            onSubmit={(e) => void submitTransfer(e)}
            className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div>
              <h3 className="text-lg font-semibold">Transfer stock</h3>
              <p className="text-sm text-slate-500">
                Move available stock between active warehouses. You will confirm
                the transfer details before recording.
              </p>
            </div>
            <label className="block text-sm font-medium">
              Product
              <select
                required
                value={transferForm.productId}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    productId: e.target.value,
                  })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
              >
                <option value="">Select product</option>
                {products
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.sku}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                From warehouse
                <select
                  required
                  value={transferForm.sourceWarehouseId}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      sourceWarehouseId: e.target.value,
                    })
                  }
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
                >
                  <option value="">Select source</option>
                  {warehouses
                    .filter((w) => w.isActive)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} · {w.code}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                To warehouse
                <select
                  required
                  value={transferForm.destinationWarehouseId}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      destinationWarehouseId: e.target.value,
                    })
                  }
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
                >
                  <option value="">Select destination</option>
                  {warehouses
                    .filter(
                      (w) =>
                        w.isActive && w.id !== transferForm.sourceWarehouseId,
                    )
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} · {w.code}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              Quantity
              <input
                required
                type="number"
                min={1}
                step={1}
                value={transferForm.quantity}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, quantity: e.target.value })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
              />
            </label>
            <label className="block text-sm font-medium">
              Reference (optional)
              <input
                value={transferForm.reference}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    reference: e.target.value,
                  })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
              />
            </label>
            <label className="block text-sm font-medium">
              Notes (optional)
              <textarea
                rows={2}
                value={transferForm.notes}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, notes: e.target.value })
                }
                className="mt-1.5 w-full rounded-md border border-slate-300 p-3 font-normal bg-white"
              />
            </label>
            <div className="rounded-md bg-[#fbf5f3] p-3 text-sm text-slate-700">
              <strong>Review:</strong>{" "}
              {products.find((p) => p.id === transferForm.productId)?.name ??
                "Select a product"}{" "}
              · {transferForm.quantity || "0"} units
              <br />
              From:{" "}
              {warehouses.find((w) => w.id === transferForm.sourceWarehouseId)
                ?.name ?? "Choose source"}{" "}
              → To:{" "}
              {warehouses.find(
                (w) => w.id === transferForm.destinationWarehouseId,
              )?.name ?? "Choose destination"}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setTransferOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-md bg-[#9D174D] px-4 py-2 text-sm text-white"
              >
                {busy ? "Transferring…" : "Review and transfer"}
              </button>
            </div>
          </form>
        </div>
      )}
      {transferRows && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTransferRows(null);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-300 p-5">
              <div>
                <h3 className="text-lg font-semibold">Transfer history</h3>
                <p className="text-sm text-slate-500">
                  Each row represents one completed transfer and its paired
                  ledger entries.
                </p>
              </div>
              <button
                onClick={() => setTransferRows(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Transfer</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Created by</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transferRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-slate-500"
                      >
                        No transfers recorded.
                      </td>
                    </tr>
                  ) : (
                    transferRows.map((item) => (
                      <tr key={item.transferGroupId}>
                        <td className="px-4 py-3 font-mono text-xs">
                          {item.transferGroupId}
                        </td>
                        <td className="px-4 py-3">
                          {item.product.name}
                          <p className="text-xs text-slate-500">
                            {item.product.sku}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {item.sourceWarehouse.name} →{" "}
                          {item.destinationWarehouse?.name ??
                            "Destination unavailable"}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3">
                          {item.createdBy.firstName} {item.createdBy.lastName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-300 p-3">
              <button
                disabled={transferPage <= 1}
                onClick={() => void showTransfers(transferPage - 1)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 py-1.5 text-xs text-slate-500">
                Page {transferPage} of {transferPages}
              </span>
              <button
                disabled={transferPage >= transferPages}
                onClick={() => void showTransfers(transferPage + 1)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      {ledger && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLedger(null);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-300 p-5">
              <div>
                <h3 className="text-lg font-semibold">Stock ledger</h3>
                <p className="text-sm text-slate-500">
                  Most recent 50 recorded movements.
                </p>
              </div>
              <button
                onClick={() => setLedger(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Warehouse</th>
                    <th className="px-4 py-3">Movement</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Reason / reference</th>
                    <th className="px-4 py-3">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-slate-500"
                      >
                        No ledger records.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((item) => (
                      <tr key={item.id}>
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {item.product.name}
                          <p className="text-xs text-slate-500">
                            {item.product.sku}
                          </p>
                        </td>
                        <td className="px-4 py-3">{item.warehouse.name}</td>
                        <td className="px-4 py-3">
                          {movementNames[item.movementType]}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {item.movementType.endsWith("OUT") ? "−" : "+"}
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3">
                          {item.reason || item.reference || item.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {item.createdBy.firstName} {item.createdBy.lastName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
