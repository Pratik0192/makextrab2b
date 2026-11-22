"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { apiErrorMessage } from "@/services/service-utils";
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
} from "@/services/warehouse.service";
import type { CreateWarehouseRequest, Warehouse } from "@/types/warehouse";

const empty: CreateWarehouseRequest = { name: "", code: "", isActive: true };
export default function WarehousePage() {
  const [rows, setRows] = useState<Warehouse[]>([]),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [totalPages, setTotalPages] = useState(1),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Warehouse | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null),
    [form, setForm] = useState<CreateWarehouseRequest>(empty);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listWarehouses({ page, pageSize: 10, search });
      setRows(result.items);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not load warehouses."));
    } finally {
      setLoading(false);
    }
  }, [page, search]);
  useEffect(() => {
    void load();
  }, [load]);
  const start = (item?: Warehouse) => {
    setEditing(item ?? null);
    setForm(
      item
        ? {
            name: item.name,
            code: item.code,
            description: item.description ?? "",
            address: item.address ?? "",
            city: item.city ?? "",
            state: item.state ?? "",
            pincode: item.pincode ?? "",
            contactPerson: item.contactPerson ?? "",
            contactPhone: item.contactPhone ?? "",
            isActive: item.isActive,
          }
        : { ...empty },
    );
    setOpen(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await updateWarehouse(editing.id, form);
      else await createWarehouse(form);
      toast.success(`Warehouse ${editing ? "updated" : "created"}.`);
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not save warehouse."));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item: Warehouse) => {
    try {
      await deleteWarehouse(item.id);
      toast.success("Warehouse deleted.");
      await load();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not delete warehouse."));
    }
  };
  const field = (
    key: keyof CreateWarehouseRequest,
    label: string,
    required = false,
  ) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        required={required}
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-normal bg-white"
      />
    </label>
  );
  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTarget(null); }} title="Delete warehouse?" description={deleteTarget ? `Delete ${deleteTarget.name}? Warehouses with stock history cannot be deleted.` : "This action cannot be undone."} confirmText="Delete warehouse" variant="destructive" onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); setDeleteTarget(null); }} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-[#9a7547]">
            Catalogue &amp; inventory
          </p>
          <h2 className="mt-1 font-serif text-3xl text-slate-800">Warehouses</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage stock locations and their contact details.
          </p>
        </div>
        <button
          onClick={() => start()}
          className="inline-flex items-center gap-2 rounded-md bg-[#9D174D] px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus size={16} /> Add warehouse
        </button>
      </div>
      <div className="rounded-lg border border-slate-300 bg-white">
        <div className="border-b border-slate-300 p-4">
          <label className="flex max-w-sm items-center gap-2 rounded-md border border-slate-300 px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search warehouses"
              className="h-10 w-full text-sm outline-none bg-white"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Stock records</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <LoaderCircle className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No warehouses found.
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded bg-slate-100 text-slate-500">
                          <Building2 size={18} />
                        </span>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {[item.city, item.state].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="px-5 py-3">{item.stockRecordCount ?? 0}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          aria-label={`Edit ${item.name}`}
                          onClick={() => start(item)}
                          className="rounded p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`Delete ${item.name}`}
                          onClick={() => setDeleteTarget(item)}
                          className="rounded p-2 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form
            onSubmit={(e) => void save(e)}
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div>
              <h3 className="text-lg font-semibold">
                {editing ? "Edit" : "Add"} warehouse
              </h3>
              <p className="text-sm text-slate-500">
                Set location and contact details.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("name", "Name", true)}
              {field("code", "Code", true)}
              {field("description", "Description")}
              {field("address", "Address")}
              {field("city", "City")}
              {field("state", "State")}
              {field("pincode", "Pincode")}
              {field("contactPerson", "Contact person")}
              {field("contactPhone", "Contact phone")}
              <label className="flex items-center gap-2 pt-6 text-sm bg-white">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border border-slate-300-[#9D174D] focus:outline-none focus:ring-1 focus:ring-[#9D174D]"
                />{" "}
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-md bg-[#9D174D] px-4 py-2 text-sm text-white"
              >
                {busy ? "Saving…" : "Save warehouse"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
