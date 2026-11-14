"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  LoaderCircle,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/service-utils";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteCategoryImage,
  uploadCategoryImage,
} from "@/services/category.service";
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  deleteCollectionImage,
  uploadCollectionImage,
} from "@/services/collection.service";
import type { Category, CreateCategoryRequest } from "@/types/category";
import type { Collection, CreateCollectionRequest } from "@/types/collection";

type Entry = Category | Collection;
type Props = { kind: "categories" | "collections" };
const blank: CreateCategoryRequest = {
  name: "",
  description: "",
  isActive: true,
  displayOrder: 0,
};

export default function CatalogueTaxonomyManager({ kind }: Props) {
  const singular = kind === "categories" ? "Category" : "Collection";
  const [rows, setRows] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState<CreateCategoryRequest>(blank);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result =
        kind === "categories"
          ? await listCategories({ page, pageSize: 10, search })
          : await listCollections({ page, pageSize: 10, search });
      setRows(result.items);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      toast.error(apiErrorMessage(error, `Could not load ${kind}.`));
    } finally {
      setLoading(false);
    }
  }, [kind, page, search]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  const start = (entry?: Entry) => {
    setEditing(entry ?? null);
    setImageFile(null);
    setRemoveImage(false);
    setModalOpen(true);
    setForm(
      entry
        ? {
            name: entry.name,
            description: entry.description ?? "",
            isActive: entry.isActive,
            displayOrder: entry.displayOrder,
          }
        : { ...blank },
    );
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        isActive: form.isActive,
        displayOrder: form.displayOrder,
      };
      let saved: Entry;
      if (kind === "categories") {
        saved = editing
          ? await updateCategory(editing.id, payload)
          : await createCategory(payload);
        setEditing(saved);
        if (imageFile) await uploadCategoryImage(saved.id, imageFile);
        else if (removeImage && editing) await deleteCategoryImage(saved.id);
      } else {
        saved = editing
          ? await updateCollection(
              editing.id,
              payload as CreateCollectionRequest,
            )
          : await createCollection(payload as CreateCollectionRequest);
        setEditing(saved);
        if (imageFile) await uploadCollectionImage(saved.id, imageFile);
        else if (removeImage && editing) await deleteCollectionImage(saved.id);
      }
      toast.success(`${singular} ${editing ? "updated" : "created"}.`);
      setEditing(null);
      setModalOpen(false);
      await load();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Could not save ${singular.toLowerCase()}.`),
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (entry: Entry) => {
    if (!window.confirm(`Delete “${entry.name}”?`)) return;
    try {
      if (kind === "categories") await deleteCategory(entry.id);
      else await deleteCollection(entry.id);
      toast.success(`${singular} deleted.`);
      await load();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Could not delete ${singular.toLowerCase()}.`),
      );
    }
  };
  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-[#9a7547]">
            Catalogue
          </p>
          <h2 className="mt-1 font-serif text-3xl text-slate-800">{kind}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage storefront grouping and visibility.
          </p>
        </div>
        <button
          onClick={() => start()}
          className="inline-flex items-center gap-2 rounded-md bg-[#672f35] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#51252b]"
        >
          <Plus size={16} /> Add {singular}
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <label className="flex max-w-sm items-center gap-2 rounded-md border border-slate-200 px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder={`Search ${kind}`}
              className="h-10 w-full text-sm outline-none bg-white"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Products</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <LoaderCircle className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No {kind} found.
                  </td>
                </tr>
              ) : (
                rows.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {entry.imageUrl ? (
                          <img
                            src={entry.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded bg-slate-100 text-slate-400">
                            <ImageIcon size={17} />
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-slate-800">
                            {entry.name}
                          </p>
                          <p className="max-w-md truncate text-xs text-slate-500">
                            {entry.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{entry.productCount ?? 0}</td>
                    <td className="px-5 py-3">{entry.displayOrder}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${entry.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {entry.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          aria-label={`Edit ${entry.name}`}
                          onClick={() => start(entry)}
                          className="rounded p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`Delete ${entry.name}`}
                          onClick={() => void remove(entry)}
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
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border px-3 py-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded border px-3 py-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setModalOpen(false);
          }}
        >
          <form
            onSubmit={(event) => void save(event)}
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <div>
              <h3 className="text-lg font-semibold">
                {editing ? "Edit" : "Add"} {singular}
              </h3>
              <p className="text-sm text-slate-500">
                Set its storefront details.
              </p>
            </div>
            <label className="block text-sm font-medium">
              Name
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-md border px-3 font-normal bg-white"
              />
            </label>
            <label className="block text-sm font-medium">
              Description
              <textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="mt-1.5 w-full rounded-md border p-3 font-normal bg-white"
              />
            </label>
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Image upload
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (
                      file &&
                      (file.size > 10 * 1024 * 1024 ||
                        !/^image\/(jpeg|png|webp)$/.test(file.type))
                    ) {
                      toast.error(
                        "Choose a JPG, PNG, or WEBP image up to 10 MB.",
                      );
                      e.currentTarget.value = "";
                      return;
                    }
                    setImageFile(file);
                    setRemoveImage(false);
                  }}
                  className="mt-1.5 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 text-gray-600"
                />
              </label>
              {((imageFile && imagePreview) ||
                (editing?.imageUrl && !removeImage)) && (
                <div className="flex items-center gap-3">
                  <img
                    src={imagePreview || editing?.imageUrl || ""}
                    alt="Image preview"
                    className="h-20 w-16 rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setRemoveImage(true);
                    }}
                    className="text-xs text-rose-700"
                  >
                    Remove image
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500">
                JPG, PNG, or WEBP; maximum 10 MB.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">
                Display order
                <input
                  type="number"
                  min={0}
                  value={form.displayOrder ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, displayOrder: Number(e.target.value) })
                  }
                  className="bg-white mt-1.5 h-10 w-full rounded-md border px-3 font-normal"
                />
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />{" "}
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setModalOpen(false)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-md bg-[#672f35] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
