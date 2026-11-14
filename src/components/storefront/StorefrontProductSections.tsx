"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { getPublicProducts } from "@/services/product.service";
import { apiErrorMessage } from "@/services/service-utils";
import type { Product } from "@/types/product";

interface SectionState {
  items: Product[];
  loading: boolean;
  error: string;
}

const emptyState: SectionState = { items: [], loading: true, error: "" };

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.28em] text-[#9a7547]">
        {eyebrow}
      </p>
      <h2 className="font-serif text-3xl leading-tight text-[#342424] sm:text-4xl md:text-[46px]">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#746866]">
        {copy}
      </p>
    </div>
  );
}

function ProductCards({
  state,
  label,
}: {
  state: SectionState;
  label: string;
}) {
  if (state.loading)
    return (
      <div className="grid min-h-40 place-items-center text-sm text-[#827572]">
        <span>
          <LoaderCircle className="mr-2 inline animate-spin" size={16} />
          {label} loading…
        </span>
      </div>
    );
  if (state.error)
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded border border-rose-200 bg-rose-50 px-5 py-4 text-center text-sm text-rose-800"
      >
        {state.error}
      </div>
    );
  if (state.items.length === 0)
    return (
      <div className="mx-auto max-w-xl rounded border border-[#e8ded2] bg-white/70 px-5 py-8 text-center">
        <p className="font-serif text-lg text-[#482f2f]">
          New pieces are being prepared.
        </p>
        <p className="mt-2 text-xs leading-5 text-[#827572]">
          Please check back soon or contact our wholesale team for the latest
          catalogue.
        </p>
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {state.items.map((product) => {
        const image =
          product.images.find((item) => item.isPrimary) ?? product.images[0];
        return (
          <article key={product.id} className="group">
            <a
              href="#contact"
              aria-label={"Enquire about " + product.name}
              className="relative block aspect-[.79] overflow-hidden bg-[#eee7df]"
            >
              {image ? (
                <img
                  src={image.imageUrl}
                  alt={image.altText ?? product.name}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="grid h-full place-items-center text-xs text-slate-400">
                  Image coming soon
                </div>
              )}
              <span className="absolute inset-x-3 bottom-3 translate-y-2 bg-[#fbf9f5] py-3 text-center text-[9px] font-semibold uppercase tracking-[.12em] text-[#482a2b] opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                Enquire about this style{" "}
                <ArrowRight className="ml-1 inline" size={13} />
              </span>
            </a>
            <div className="pt-4">
              <p className="font-serif text-base text-[#402b2b] md:text-lg">
                {product.name}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[.13em] text-[#9a7547]">
                {product.sku}
              </p>
              <p className="mt-2 text-[11px] text-[#827572]">
                {[product.fabric, product.workOrDesign]
                  .filter(Boolean)
                  .join(" · ") ||
                  product.shortDescription ||
                  "Curated wholesale design"}
              </p>
              <p className="mt-1 text-[10px] text-[#827572]">
                {product.category.name}
                {product.collection ? " · " + product.collection.name : ""}
              </p>
              <p className="mt-3 text-[10px] text-[#5f745e]">
                Minimum order: {product.minimumOrderQuantity}
                {product.packSize ? " · Pack of " + product.packSize : ""}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function StorefrontProductSections() {
  const [featured, setFeatured] = useState<SectionState>(emptyState);
  const [newArrivals, setNewArrivals] = useState<SectionState>(emptyState);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      getPublicProducts({ featured: true, pageSize: 8 }),
      getPublicProducts({ newArrival: true, pageSize: 8 }),
    ]).then(([featuredResult, arrivalResult]) => {
      if (!active) return;
      const message =
        "The catalogue could not be loaded. Please try again later.";
      setFeatured(
        featuredResult.status === "fulfilled"
          ? { items: featuredResult.value.items, loading: false, error: "" }
          : {
              items: [],
              loading: false,
              error: apiErrorMessage(featuredResult.reason, message),
            },
      );
      setNewArrivals(
        arrivalResult.status === "fulfilled"
          ? { items: arrivalResult.value.items, loading: false, error: "" }
          : {
              items: [],
              loading: false,
              error: apiErrorMessage(arrivalResult.reason, message),
            },
      );
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section
        id="products"
        className="mx-auto max-w-[1440px] px-5 py-20 md:px-12 md:py-24"
      >
        <SectionHeading
          eyebrow="A first look"
          title="Pieces worth discovering."
          copy="A glimpse into the Nextra catalogue. Product availability and order details are shared by our wholesale team."
        />
        <nav
          aria-label="Browse catalogue"
          className="mb-8 flex flex-wrap justify-center gap-3 text-[10px] font-semibold uppercase tracking-[.14em] text-[#672f35]"
        >
          <Link
            href="/products"
            className="border border-[#ead8d9] bg-white px-4 py-2.5"
          >
            All products
          </Link>
          <Link
            href="/categories"
            className="border border-[#ead8d9] bg-white px-4 py-2.5"
          >
            Categories
          </Link>
          <Link
            href="/collections"
            className="border border-[#ead8d9] bg-white px-4 py-2.5"
          >
            Collections
          </Link>
        </nav>
        <ProductCards state={featured} label="Featured collection" />
        <div className="mt-10 text-center">
          <a
            href="#contact"
            className="inline-flex items-center gap-3 border border-[#6b4846] px-7 py-3.5 text-[10px] font-semibold uppercase tracking-[.13em] text-[#4e3030] transition hover:bg-[#4e3030] hover:text-white"
          >
            Request wholesale catalogue <ArrowRight size={14} />
          </a>
        </div>
      </section>
      <section
        id="new-arrivals"
        className="bg-[#f2ede5] px-5 py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto max-w-[1320px]">
          <SectionHeading
            eyebrow="Fresh to the catalogue"
            title="New arrivals."
            copy="Discover the latest additions selected for retailers, boutiques and resellers."
          />
          <ProductCards state={newArrivals} label="New arrivals" />
        </div>
      </section>
    </>
  );
}
