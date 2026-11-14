"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listPublicCategories,
  listPublicCollections,
} from "@/services/storefront.service";
import { apiErrorMessage } from "@/services/service-utils";
import type { PublicTaxonomyItem } from "@/types/public-catalogue";

export default function PublicTaxonomyListing({
  kind,
}: {
  kind: "categories" | "collections";
}) {
  const [items, setItems] = useState<PublicTaxonomyItem[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const load =
      kind === "categories"
        ? listPublicCategories({ pageSize: 100 })
        : listPublicCollections({ pageSize: 100 });
    load
      .then((data) => setItems(data.items))
      .catch((e) =>
        setError(apiErrorMessage(e, "Could not load the catalogue groups.")),
      );
  }, [kind]);
  const title =
    kind === "categories" ? "Shop by category" : "Explore collections";
  return (
    <main className="min-h-screen bg-[#fbf9f5] px-5 py-12 text-[#342424] md:px-12">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-xs uppercase tracking-[.2em] text-[#8b555b]"
        >
          Nextra Wholesale
        </Link>
        <h1 className="mt-8 font-serif text-4xl">{title}</h1>
        {error ? (
          <p
            role="alert"
            className="mt-8 rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">
            Catalogue groups will appear here soon.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/products?${kind === "categories" ? "categoryId" : "collectionId"}=${encodeURIComponent(item.id)}`}
                className="group"
              >
                <div className="aspect-[.85] overflow-hidden bg-[#eee7df]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#f4ece3] to-[#e6d8cf]" />
                  )}
                </div>
                <h2 className="mt-3 font-serif text-xl">{item.name}</h2>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-[#746866]">
                    {item.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
