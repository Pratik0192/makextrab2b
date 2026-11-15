"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  LoaderCircle,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/services/service-utils";
import { productSaveError } from "@/services/product-form-errors";
import { toast } from "sonner";
import {
  createProduct,
  deleteProduct,
  deleteProductImage,
  getAdminProduct,
  getAdminProducts,
  saveProductImageOrder,
  updateProduct,
  uploadProductImages,
} from "@/services/product.service";
import { listCategories } from "@/services/category.service";
import { listCollections } from "@/services/collection.service";
import type { Category } from "@/types/category";
import type { Collection } from "@/types/collection";
import type {
  AdminProduct,
  AdminProductImage,
  CreateProductRequest,
} from "@/types/product";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#8e5b5c] focus:ring-2 focus:ring-[#8e5b5c]/10 text-gray-600";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

type DraftImage = {
  key: string;
  file?: File;
  existing?: AdminProductImage;
  preview: string;
};

function emptyForm(): CreateProductRequest {
  return {
    name: "",
    sku: "",
    wholesalePrice: "",
    categoryId: "",
    collectionId: null,
    shortDescription: "",
    description: "",
    fabric: "",
    colour: "",
    workOrDesign: "",
    length: "",
    minimumOrderQuantity: 10,
    packSize: null,
    isActive: true,
    isFeatured: false,
    isNewArrival: false,
    displayOrder: 0,
  };
}

function ImagePreview({
  image,
  onRemove,
  onPrimary,
  isPrimary,
  onMoveUp,
  onMoveDown,
}: {
  image: DraftImage;
  onRemove: () => void;
  onPrimary: () => void;
  isPrimary: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="relative w-[112px] shrink-0">
      <div className="relative aspect-[.8] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
        <img
          src={image.preview}
          alt={
            image.existing?.altText ??
            image.file?.name ??
            "Product image preview"
          }
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove image"
          className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-rose-700 shadow"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onPrimary}
          className={
            "inline-flex items-center gap-1 text-[10px] " +
            (isPrimary
              ? "font-semibold text-[#7b4c28]"
              : "text-slate-500 hover:text-[#7b4c28]")
          }
        >
          <Star size={12} fill={isPrimary ? "currentColor" : "none"} />
          {isPrimary ? "Primary" : "Set primary"}
        </button>
        <span className="flex">
          <button
            type="button"
            onClick={onMoveUp}
            aria-label="Move image earlier"
            className="p-1 text-slate-500 hover:text-slate-900"
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            aria-label="Move image later"
            className="p-1 text-slate-500 hover:text-slate-900"
          >
            <ArrowDown size={12} />
          </button>
        </span>
      </div>
      <p className="truncate text-[9px] text-slate-400">
        {image.file?.name ?? "Uploaded image"}
      </p>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<CreateProductRequest>(emptyForm());
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [primaryKey, setPrimaryKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wholesalePriceError, setWholesalePriceError] = useState("");

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await getAdminProducts({
        page,
        pageSize: 20,
        search,
        categoryId: categoryFilter || undefined,
        collectionId: collectionFilter || undefined,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      });
      setProducts(response.items);
      setTotalPages(Math.max(1, response.pagination.totalPages));
    } catch (caught: unknown) {
      setError(apiErrorMessage(caught, "Could not load products."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
    void Promise.all([
      listCategories({ pageSize: 100 }),
      listCollections({ pageSize: 100 }),
    ])
      .then(([categoryPage, collectionPage]) => {
        setCategories(categoryPage.items);
        setCollections(collectionPage.items);
      })
      .catch((caught: unknown) =>
        setError(apiErrorMessage(caught, "Could not load catalogue filters.")),
      );
  }, [page, search, categoryFilter, collectionFilter, activeFilter]);

  const orderedImages = useMemo(() => draftImages, [draftImages]);

  function revokeDraftPreviews(images: DraftImage[]) {
    images.forEach((image) => {
      if (image.file) URL.revokeObjectURL(image.preview);
    });
  }

  function startAdd() {
    setEditing(null);
    setForm(emptyForm());
    setDraftImages([]);
    setRemovedImageIds([]);
    setPrimaryKey("");
    setError("");
    setWholesalePriceError("");
    setDialogOpen(true);
  }

  function startEdit(product: AdminProduct) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      wholesalePrice: product.wholesalePrice ?? "",
      categoryId: product.categoryId,
      collectionId: product.collectionId,
      shortDescription: product.shortDescription,
      description: product.description,
      fabric: product.fabric,
      colour: product.colour,
      workOrDesign: product.workOrDesign,
      length: product.length,
      minimumOrderQuantity: 10,
      packSize: product.packSize,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      displayOrder: product.displayOrder,
    });
    setDraftImages(
      product.images.map((image) => ({
        key: "existing:" + image.id,
        existing: image,
        preview: image.imageUrl,
      })),
    );
    setRemovedImageIds([]);
    const primaryImage =
      product.images.find((image) => image.isPrimary) ?? product.images[0];
    setPrimaryKey(primaryImage ? "existing:" + primaryImage.id : "");
    setError("");
    setWholesalePriceError("");
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    if (!open) revokeDraftPreviews(draftImages);
    setDialogOpen(open);
  }

  function updateField<K extends keyof CreateProductRequest>(
    key: K,
    value: CreateProductRequest[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
    if (key === "wholesalePrice") setWholesalePriceError("");
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const additions = Array.from(fileList);
    const currentCount = draftImages.length;
    if (currentCount + additions.length > 12) {
      setError("A product can have at most 12 images.");
      toast.error("Too many images", { description: "A product can have at most 12 images." });
      return;
    }
    for (const file of additions) {
      const extension = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
      if (file.size > MAX_FILE_BYTES) {
        setError("Each image must be 10 MB or smaller.");
        toast.error("Image too large", { description: "The selected image exceeds the 10 MB file size limit." });
        return;
      }
      if (file.size === 0 || ACCEPTED_TYPES[extension] !== file.type) {
        setError("Choose JPG, JPEG, PNG, or WEBP images.");
        toast.error("Invalid image format", { description: "Please upload JPG, PNG or WEBP images only." });
        return;
      }
    }
    const drafts = additions.map((file) => ({
      key: "new:" + crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    if (!primaryKey && drafts.length) setPrimaryKey(drafts[0].key);
    setDraftImages((previous) => [...previous, ...drafts]);
    setError("");
  }

  function removeDraftImage(image: DraftImage) {
    if (image.file) URL.revokeObjectURL(image.preview);
    if (image.existing)
      setRemovedImageIds((ids) => [...ids, image.existing!.id]);
    const remaining = draftImages.filter((item) => item.key !== image.key);
    setDraftImages(remaining);
    if (primaryKey === image.key) setPrimaryKey(remaining[0]?.key ?? "");
  }

  function moveDraftImage(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draftImages.length) return;
    const reordered = [...draftImages];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    setDraftImages(reordered);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!form.name.trim()) {
      const message = "Please enter a product name.";
      setError(message);
      toast.error("Product name required", { description: message });
      return;
    }
    if (!form.sku.trim()) {
      const message = "Please enter a product SKU.";
      setError(message);
      toast.error("Product SKU required", { description: message });
      return;
    }
    if (!form.categoryId) {
      setError("Please select a category.");
      toast.error("Category required", { description: "Please select a category for this product." });
      return;
    }
    const wholesalePrice = form.wholesalePrice.trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(wholesalePrice) || Number(wholesalePrice) <= 0) {
      const message = "Enter a valid wholesale price greater than zero, with up to two decimal places.";
      setWholesalePriceError(message);
      toast.error("Wholesale price required", { description: message });
      return;
    }
    if (
      form.packSize !== null &&
      form.packSize !== undefined &&
      (!Number.isInteger(form.packSize) || form.packSize < 1)
    ) {
      setError("Pack size must be a positive whole number.");
      return;
    }
    setSaving(true);
    try {
      const payload: CreateProductRequest = {
        ...form,
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        wholesalePrice,
        collectionId: form.collectionId || null,
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        const files = draftImages
          .filter((image) => image.file)
          .map((image) => image.file!);
        if (files.length) await uploadProductImages(editing.id, files);
        for (const imageId of removedImageIds)
          await deleteProductImage(editing.id, imageId);
        const saved = await getAdminProduct(editing.id);
        if (saved.images.length) {
          const originalIds = new Set(editing.images.map((image) => image.id));
          const newImages = saved.images
            .filter((image) => !originalIds.has(image.id))
            .sort((a, b) => a.displayOrder - b.displayOrder);
          let newIndex = 0;
          const finalOrder = draftImages
            .map((draft) => {
              if (draft.existing) return draft.existing.id;
              const newImage = newImages[newIndex++];
              return newImage?.id ?? "";
            })
            .filter(Boolean);
          const selectedPrimaryId = primaryKey.startsWith("existing:")
            ? primaryKey.slice("existing:".length)
            : primaryKey.startsWith("new:")
              ? (newImages[
                  draftImages
                    .filter((draft) => draft.file)
                    .findIndex((draft) => draft.key === primaryKey)
                ]?.id ?? "")
              : "";
          const allIds = new Set(saved.images.map((image) => image.id));
          const normalizedOrder = finalOrder.filter((id) => allIds.has(id));
          for (const image of saved.images)
            if (!normalizedOrder.includes(image.id))
              normalizedOrder.push(image.id);
          const chosenPrimary = allIds.has(selectedPrimaryId)
            ? selectedPrimaryId
            : normalizedOrder[0];
          await saveProductImageOrder(
            editing.id,
            normalizedOrder.map((id, index) => ({
              id,
              displayOrder: index,
              isPrimary: id === chosenPrimary,
            })),
          );
        }
      } else {
        const files = draftImages
          .filter((image) => image.file)
          .map((image) => image.file!);
        const primaryIndex = Math.max(
          0,
          files.findIndex(
            (file) =>
              draftImages.find((image) => image.file === file)?.key ===
              primaryKey,
          ),
        );
        await createProduct(payload, files, primaryIndex);
      }
      revokeDraftPreviews(draftImages);
      setDialogOpen(false);
      setEditing(null);
      setDraftImages([]);
      setForm(emptyForm());
      await loadProducts();
      toast.success(editing ? "Product updated" : "Product created", { description: editing ? "Your product changes have been saved." : "The product has been added to the catalogue." });
    } catch (caught: unknown) {
      const result = productSaveError(caught, Boolean(editing), form.sku.trim().toUpperCase());
      setError(result.message);
      const response = (caught as { response?: { data?: { error?: { field?: string; message?: string } } } }).response?.data?.error;
      if (response?.field === "wholesalePrice") setWholesalePriceError(response.message ?? result.message);
      toast.error(result.title, { description: result.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteOne(product: AdminProduct) {
    const confirmed = window.confirm(
      "Delete “" +
        product.name +
        "”? Products with stock history will be deactivated instead.",
    );
    if (!confirmed) return;
    try {
      const result = await deleteProduct(product.id);
      window.alert(
        result.deactivated
          ? "Product deactivated because stock records must be preserved."
          : "Product deleted.",
      );
      await loadProducts();
    } catch (caught: unknown) {
      setError(apiErrorMessage(caught, "The product could not be deleted."));
    }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-[#9a7547]">
            Catalogue management
          </p>
          <h2 className="mt-1 font-serif text-3xl text-slate-800">Products</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage product details, images and storefront visibility.
          </p>
        </div>
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#542d30] px-4 text-sm font-medium text-white hover:bg-[#6b3b3d]"
        >
          <Plus size={16} />
          Add product
        </button>
      </div>
      {error && !dialogOpen && (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 md:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-label="Search products"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search by product name or SKU"
            className="h-10 w-full rounded-md border bg-white border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#8e5b5c]"
          />
        </div>
        <select
          aria-label="Filter category"
          value={categoryFilter}
          onChange={(event) => {
            setPage(1);
            setCategoryFilter(event.target.value);
          }}
          className={inputClass + " md:w-48"}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter collection"
          value={collectionFilter}
          onChange={(event) => {
            setPage(1);
            setCollectionFilter(event.target.value);
          }}
          className={inputClass + " md:w-48"}
        >
          <option value="">All collections</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter product status"
          value={activeFilter}
          onChange={(event) => {
            setPage(1);
            setActiveFilter(event.target.value);
          }}
          className={inputClass + " md:w-36"}
        >
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Wholesale price / piece</th>
                <th className="px-4 py-3">Category / Collection</th>
                <th className="px-4 py-3">MOQ</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-16 text-center text-slate-500"
                  >
                    <LoaderCircle
                      className="mr-2 inline animate-spin"
                      size={16}
                    />
                    Loading products…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-16 text-center text-slate-500"
                  >
                    No products found. Add a product or adjust your filters.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-10 overflow-hidden rounded bg-slate-100">
                          {product.images[0] ? (
                            <img
                              src={product.images[0].imageUrl}
                              alt={product.images[0].altText ?? product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-slate-300">
                              <ImagePlus size={16} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {product.name}
                          </p>
                          <p className="max-w-52 truncate text-xs text-slate-500">
                            {product.fabric || product.workOrDesign || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {product.sku}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {product.wholesalePrice === null
                        ? <span className="text-amber-700">Not configured</span>
                        : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(product.wholesalePrice))}
                    </td>
                    <td className="px-4 py-3">
                      <p>{product.category.name}</p>
                      <p className="text-xs text-slate-500">
                        {product.collection?.name ?? "No collection"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {product.minimumOrderQuantity}
                      {product.packSize ? (
                        <span className="text-xs text-slate-500">
                          {" "}
                          / pack {product.packSize}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {product.isFeatured && (
                          <span className="rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                            Featured
                          </span>
                        )}
                        {product.isNewArrival && (
                          <span className="rounded bg-blue-50 px-2 py-1 text-[10px] text-blue-800">
                            New
                          </span>
                        )}
                        {!product.isFeatured && !product.isNewArrival && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "rounded-full px-2.5 py-1 text-[10px] font-medium " +
                          (product.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600")
                        }
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(product)}
                        className="mr-3 text-xs font-medium text-[#6b3438] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { window.location.href = `/admin/products/${product.id}/price-history`; }}
                        className="mr-3 text-xs font-medium text-slate-600 hover:underline"
                      >
                        Price history
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteOne(product)}
                        className="text-xs font-medium text-rose-700 hover:underline"
                      >
                        Delete / deactivate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
              className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
              className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-lg bg-[#fbf9f5] p-5 sm:p-7">
          <DialogHeader className="text-left">
            <p className="text-[10px] uppercase tracking-[.2em] text-[#9a7547]">
              Catalogue record
            </p>
            <DialogTitle className="font-serif text-2xl font-normal text-[#452d2d]">
              {editing ? "Edit product" : "Add product"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Wholesale pricing is internal and is never shown on the public storefront.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label>
                <span className={labelClass}>Product name *</span>
                <input
                  maxLength={180}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>SKU *</span>
                <input
                  maxLength={80}
                  value={form.sku}
                  onChange={(event) => updateField("sku", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Wholesale Price (Per Piece) *</span>
                <input
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Enter price per piece"
                  value={form.wholesalePrice}
                  onChange={(event) => updateField("wholesalePrice", event.target.value)}
                  aria-invalid={Boolean(wholesalePriceError)}
                  aria-describedby="wholesale-price-help wholesale-price-error"
                  className={inputClass + (wholesalePriceError ? " border-rose-500" : "")}
                />
                <span id="wholesale-price-help" className="mt-1 block text-[10px] leading-4 text-slate-500">
                  This is the wholesale selling price for one piece. It will be used as the default price when creating quotations. It will not be displayed on the public storefront.
                </span>
                {wholesalePriceError && <span id="wholesale-price-error" role="alert" className="mt-1 block text-xs text-rose-700">{wholesalePriceError}</span>}
              </label>
              <label>
                <span className={labelClass}>Category *</span>
                <select
                  value={form.categoryId}
                  onChange={(event) =>
                    updateField("categoryId", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Collection</span>
                <select
                  value={form.collectionId ?? ""}
                  onChange={(event) =>
                    updateField("collectionId", event.target.value || null)
                  }
                  className={inputClass}
                >
                  <option value="">No collection</option>
                  {collections
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Fabric</span>
                <input
                  maxLength={120}
                  value={form.fabric ?? ""}
                  onChange={(event) =>
                    updateField("fabric", event.target.value)
                  }
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Colour</span>
                <input
                  maxLength={120}
                  value={form.colour ?? ""}
                  onChange={(event) =>
                    updateField("colour", event.target.value)
                  }
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Work / design</span>
                <input
                  maxLength={200}
                  value={form.workOrDesign ?? ""}
                  onChange={(event) =>
                    updateField("workOrDesign", event.target.value)
                  }
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Length</span>
                <input
                  maxLength={80}
                  value={form.length ?? ""}
                  onChange={(event) =>
                    updateField("length", event.target.value)
                  }
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Minimum order quantity</span>
                <input
                  type="number"
                  value={10}
                  readOnly
                  className={inputClass + " bg-slate-50 text-slate-500"}
                />
              </label>
              <label>
                <span className={labelClass}>Pack size</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.packSize ?? ""}
                  onChange={(event) =>
                    updateField(
                      "packSize",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Display order</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.displayOrder ?? 0}
                  onChange={(event) =>
                    updateField("displayOrder", Number(event.target.value))
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Short description</span>
                <textarea
                  maxLength={300}
                  rows={2}
                  value={form.shortDescription ?? ""}
                  onChange={(event) =>
                    updateField("shortDescription", event.target.value)
                  }
                  className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#8e5b5c]"
                />
              </label>
              <label>
                <span className={labelClass}>Full description</span>
                <textarea
                  maxLength={10000}
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#8e5b5c]"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(
                [
                  ["isActive", "Active"],
                  ["isFeatured", "Featured"],
                  ["isNewArrival", "New arrival"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="inline-flex items-center gap-2 text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(form[key])}
                    onChange={(event) => updateField(key, event.target.checked)}
                    className="accent-[#9D174D]"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Product images
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    JPG, PNG, WEBP · max 10 MB each · up to 12 images
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <ImagePlus size={15} />
                  Choose images
                  <input
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {orderedImages.length ? (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {orderedImages.map((image, index) => (
                    <ImagePreview
                      key={image.key}
                      image={image}
                      isPrimary={primaryKey === image.key}
                      onPrimary={() => setPrimaryKey(image.key)}
                      onRemove={() => removeDraftImage(image)}
                      onMoveUp={() => moveDraftImage(index, -1)}
                      onMoveDown={() => moveDraftImage(index, 1)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 py-8 text-center text-xs text-slate-500">
                  No images selected. You can save the product and add images
                  later.
                </div>
              )}
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => closeDialog(false)}
                disabled={saving}
                className="rounded-md border border-slate-300 px-4 py-2 text-xs text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-[#542d30] px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving && <LoaderCircle size={14} className="animate-spin" />}
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create product"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
