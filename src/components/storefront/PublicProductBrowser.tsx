"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { getPublicProducts } from "@/services/product.service";
import {
  listPublicCategories,
  listPublicCollections,
} from "@/services/storefront.service";
import { apiErrorMessage } from "@/services/service-utils";
import type { Product } from "@/types/product";
import type { PublicTaxonomyItem } from "@/types/public-catalogue";
import type { Pagination } from "@/types/api";
import { toast } from "sonner";

export default function PublicProductBrowser() {
  const [items, setItems] = useState<Product[]>([]),
    [categories, setCategories] = useState<PublicTaxonomyItem[]>([]),
    [collections, setCollections] = useState<PublicTaxonomyItem[]>([]),
    [search, setSearch] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [collectionId, setCollectionId] = useState(""),
    [newArrival, setNewArrival] = useState(false),
    [page, setPage] = useState(1),
    [pagination, setPagination] = useState<Pagination>({
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 0,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filtersReady, setFiltersReady] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getPublicProducts({
        page,
        pageSize: 12,
        search: search || undefined,
        categoryId: categoryId || undefined,
        collectionId: collectionId || undefined,
        newArrival: newArrival || undefined,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch (caught) {
      const message = apiErrorMessage(caught, "Could not load the catalogue.");
      setError(message);
      toast.error("Catalogue could not be loaded", { description: message });
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, collectionId, newArrival]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("categoryId")) setCategoryId(params.get("categoryId") ?? "");
    if (params.has("collectionId"))
      setCollectionId(params.get("collectionId") ?? "");
    if (params.get("newArrival") === "true") setNewArrival(true);
    setFiltersReady(true);
  }, []);
  useEffect(() => {
    if (!filtersReady) return;
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load, filtersReady]);
  useEffect(() => {
    Promise.all([
      listPublicCategories({ pageSize: 100 }),
      listPublicCollections({ pageSize: 100 }),
    ])
      .then(([c, k]) => {
        setCategories(c.items);
        setCollections(k.items);
      })
      .catch(() => {});
  }, []);
  return (
    <main className="min-h-screen bg-[#fbf9f5] px-5 py-12 text-[#342424] md:px-12">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-xs uppercase tracking-[.2em] text-[#8b555b]"
        >
          Nextra Wholesale
        </Link>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-[#9a7547]">
              Wholesale catalogue
            </p>
            <h1 className="mt-2 font-serif text-4xl">Explore the collection</h1>
          </div>
          <p className="max-w-lg text-sm leading-6 text-[#746866]">
            Browse current styles selected for boutiques and resellers.
            Wholesale enquiries are welcome.
          </p>
        </div>
        <div className="mt-8 grid gap-3 rounded-lg border border-[#e8ded2] bg-white p-4 md:grid-cols-[1fr_220px_220px_auto]">
          <label className="flex items-center gap-2 rounded-md border px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search product name or SKU"
              className="h-10 w-full text-sm outline-none bg-white"
            />
          </label>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border px-3 text-sm bg-white"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 text-xs text-[#644d4a]">
            <input type="checkbox" checked={newArrival} onChange={(event) => { setNewArrival(event.target.checked); setPage(1); }} className="accent-[#9D174D]" />
            New arrivals
          </label>
          <select
            value={collectionId}
            onChange={(e) => {
              setCollectionId(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border px-3 text-sm bg-white"
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="grid min-h-64 place-items-center text-sm text-slate-500">
            <LoaderCircle className="animate-spin" /> Loading catalogue…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-8 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
          >
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-md border border-[#e8ded2] bg-white p-12 text-center">
            <h2 className="font-serif text-2xl">No styles found</h2>
            <p className="mt-2 text-sm text-slate-500">
              Try a different search or browse all products.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((product) => {
              const image =
                product.images.find((img) => img.isPrimary) ??
                product.images[0];
              return (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  className="group"
                >
                  <div className="aspect-[.78] overflow-hidden bg-[#eee7df]">
                    {image ? (
                      <img
                        src={image.imageUrl}
                        alt={image.altText ?? product.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-slate-400">
                        Image coming soon
                      </div>
                    )}
                  </div>
                  <p className="mt-3 font-serif text-lg">{product.name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-[#9a7547]">
                    {product.sku}
                  </p>
                  <p className="mt-2 text-xs text-[#746866]">
                    {product.category.name}
                    {product.collection ? ` · ${product.collection.name}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#746866]">MOQ: 10 units</p>
                </Link>
              );
            })}
          </div>
        )}
        <div className="mt-8 flex items-center justify-between text-sm text-slate-500">
          <span>{pagination.total} products</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              className="rounded border bg-white px-3 py-2 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 py-2">
              {page} / {Math.max(1, pagination.totalPages)}
            </span>
            <button
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage(page + 1)}
              className="rounded border bg-white px-3 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
