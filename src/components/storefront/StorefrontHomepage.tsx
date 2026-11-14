"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getPublicProducts } from "@/services/product.service";
import { listPublicCategories, listPublicCollections } from "@/services/storefront.service";
import type { Product } from "@/types/product";
import type { PublicTaxonomyItem } from "@/types/public-catalogue";
import WholesaleEnquiryForm from "@/components/storefront/WholesaleEnquiryForm";

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14"><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.28em] text-[#9a7547]">{eyebrow}</p><h2 className="font-serif text-3xl leading-tight text-[#342424] sm:text-4xl md:text-[46px]">{title}</h2>{copy && <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#746866]">{copy}</p>}</div>;
}

function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  return <Link href={`/products/${product.id}`} className="group block"><div className="relative aspect-[.78] overflow-hidden bg-[#eee5dc]">{image ? <img src={image.imageUrl} alt={image.altText ?? product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" /> : <div className="grid h-full place-items-center text-xs text-[#8b7a74]">Image coming soon</div>}<span className="absolute left-3 top-3 bg-[#fbf9f5]/95 px-2.5 py-1 text-[9px] uppercase tracking-wider text-[#542d30]">MOQ {product.minimumOrderQuantity}</span></div><p className="mt-3 text-[9px] uppercase tracking-[.15em] text-[#9a7547]">{product.category.name}</p><h3 className="mt-1 font-serif text-lg text-[#402b2b] group-hover:text-[#8b5c4e]">{product.name}</h3><p className="mt-1 text-[10px] text-[#8b7a74]">SKU {product.sku}</p></Link>;
}

function ProductGrid({ items, error, loading, onRetry, emptyText }: { items: Product[]; error: string; loading: boolean; onRetry: () => void; emptyText: string }) {
  if (loading) return <p className="py-10 text-center text-sm text-[#827572]">Loading catalogue…</p>;
  if (error) return <div role="alert" className="mx-auto max-w-xl rounded border border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-900"><p>{error}</p><button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 font-medium"><RefreshCw size={14} /> Try again</button></div>;
  if (!items.length) return <p className="py-10 text-center text-sm text-[#827572]">{emptyText}</p>;
  return <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:gap-x-6 lg:grid-cols-4">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

export default function StorefrontHomepage() {
  const [categories, setCategories] = useState<PublicTaxonomyItem[]>([]);
  const [collections, setCollections] = useState<PublicTaxonomyItem[]>([]);
  const [all, setAll] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [arrivals, setArrivals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [taxonomyError, setTaxonomyError] = useState("");

  async function load() {
    setLoading(true);
    setCatalogueError("");
    setTaxonomyError("");
    const results = await Promise.allSettled([
      getPublicProducts({ page: 1, pageSize: 8 }),
      getPublicProducts({ page: 1, pageSize: 8, featured: true }),
      getPublicProducts({ page: 1, pageSize: 8, newArrival: true }),
      listPublicCategories({ page: 1, pageSize: 100 }),
      listPublicCollections({ page: 1, pageSize: 100 }),
    ] as const);
    if (results.slice(0, 3).some((result) => result.status === "rejected")) setCatalogueError("We couldn't load some products right now. Please try again.");
    if (results[0].status === "fulfilled") setAll(results[0].value.items);
    if (results[1].status === "fulfilled") setFeatured(results[1].value.items);
    if (results[2].status === "fulfilled") setArrivals(results[2].value.items);
    if (results[3].status === "fulfilled") setCategories(results[3].value.items); else setTaxonomyError("Categories are temporarily unavailable.");
    if (results[4].status === "fulfilled") setCollections(results[4].value.items); else setTaxonomyError("Categories and collections are temporarily unavailable.");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const retryCatalogue = () => { void load(); };
  return <main className="overflow-hidden bg-[#fbf9f5] text-[#342424]">
    <section className="relative min-h-[540px] overflow-hidden bg-[#6b5149] md:min-h-[650px]" aria-label="Nextra wholesale sarees">
      <img src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2200&q=85" alt="Traditional Indian saree in warm light" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#25191a]/80 via-[#2d2020]/48 to-transparent" />
      <div className="relative mx-auto flex min-h-[540px] max-w-[1440px] items-center px-6 py-16 md:min-h-[650px] md:px-14"><div className="max-w-[600px] text-white"><p className="mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.3em] text-[#e7c99c]"><span className="h-px w-9 bg-[#c8a36c]" />A considered wholesale collection</p><h1 className="font-serif text-5xl leading-[1.08] sm:text-6xl md:text-[76px]">Weaves that<br />bring people <em className="font-normal text-[#e4c99f]">closer.</em></h1><p className="mt-6 max-w-lg text-sm leading-7 text-white/80">Discover sarees selected for retailers, boutiques and resellers, with an easy catalogue and a team ready to help.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/products" className="inline-flex items-center gap-2 bg-[#f8f2e8] px-6 py-4 text-[10px] font-semibold uppercase tracking-[.14em] text-[#48292b]">Explore products <ArrowRight size={14} /></Link><Link href="/categories" className="inline-flex items-center border border-white/60 px-6 py-4 text-[10px] font-semibold uppercase tracking-[.14em] text-white">Shop categories</Link></div><p className="mt-5 text-[10px] tracking-wide text-white/70">Wholesale orders start at 10 pieces per product.</p></div></div>
    </section>

    <section id="categories" className="mx-auto max-w-[1440px] px-5 py-16 md:px-12 md:py-24"><SectionTitle eyebrow="A world of weaves" title="Find the right story for every shelf." copy="Browse the categories in our current wholesale catalogue." />{taxonomyError && <p role="alert" className="mb-5 text-center text-sm text-rose-800">{taxonomyError}</p>}{loading ? <p className="py-8 text-center text-sm text-[#827572]">Loading categories…</p> : categories.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">{categories.slice(0, 8).map((item) => <Link href={`/products?categoryId=${encodeURIComponent(item.id)}`} key={item.id} className="group"><div className="relative aspect-[.82] overflow-hidden bg-[#eee5dc]">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" /> : <div className="grid h-full place-items-center font-serif text-xl text-[#8b7a74]">{item.name}</div>}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12 font-serif text-lg text-white">{item.name}</span></div></Link>)}</div> : <p className="py-8 text-center text-sm text-[#827572]">No active categories yet.</p>}<div className="mt-8 text-center"><Link href="/categories" className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#542d30]">View all categories <ArrowRight className="ml-2 inline" size={13} /></Link></div></section>

    <section id="collections" className="bg-[#f2ede5] px-5 py-16 md:px-12 md:py-20"><div className="mx-auto max-w-[1320px]"><SectionTitle eyebrow="Curated for your customers" title="Collections with a point of view." />{loading ? <p className="py-8 text-center text-sm text-[#827572]">Loading collections…</p> : collections.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{collections.slice(0, 6).map((item) => <Link key={item.id} href={`/products?collectionId=${encodeURIComponent(item.id)}`} className="group relative min-h-[260px] overflow-hidden bg-[#d9cec0]">{item.imageUrl && <img src={item.imageUrl} alt={item.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />}<div className="absolute inset-0 bg-gradient-to-t from-[#211718]/75 via-[#211718]/10 to-transparent" /><div className="absolute bottom-6 left-6 text-white"><h3 className="font-serif text-2xl">{item.name}</h3>{item.description && <p className="mt-2 line-clamp-2 max-w-sm text-xs text-white/80">{item.description}</p>}<span className="mt-4 inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.18em]">Explore collection <ArrowRight size={13} /></span></div></Link>)}</div> : <p className="py-8 text-center text-sm text-[#827572]">No active collections yet.</p>}<div className="mt-8 text-center"><Link href="/collections" className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#542d30]">View all collections <ArrowRight className="ml-2 inline" size={13} /></Link></div></div></section>

    <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-12 md:py-24"><SectionTitle eyebrow="Chosen for your store" title="Featured products" /><ProductGrid items={featured} loading={loading} error={catalogueError} onRetry={retryCatalogue} emptyText="No featured products are available yet." /><div className="mt-8 text-center"><Link href="/products" className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#542d30]">Browse the catalogue <ArrowRight className="ml-2 inline" size={13} /></Link></div></section>

    <section className="bg-[#f2ede5] px-5 py-16 md:px-12 md:py-20"><div className="mx-auto max-w-[1440px]"><SectionTitle eyebrow="Just added" title="New arrivals" /><ProductGrid items={arrivals} loading={loading} error={catalogueError} onRetry={retryCatalogue} emptyText="There are no new arrivals to show yet." /><div className="mt-8 text-center"><Link href="/products?newArrival=true" className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#542d30]">See new arrivals <ArrowRight className="ml-2 inline" size={13} /></Link></div></div></section>

    <section id="products" className="mx-auto max-w-[1440px] px-5 py-16 md:px-12 md:py-24"><SectionTitle eyebrow="The current catalogue" title="Explore all products" copy="See the products currently available for wholesale enquiry." /><ProductGrid items={all} loading={loading} error={catalogueError} onRetry={retryCatalogue} emptyText="No active products are available yet." /><div className="mt-8 text-center"><Link href="/products" className="inline-flex items-center gap-2 bg-[#542d30] px-6 py-3 text-[10px] font-semibold uppercase tracking-[.14em] text-white">View all products <ArrowRight size={13} /></Link></div></section>

    <section id="contact" className="bg-[#48292b] px-5 py-16 text-center text-white md:py-24"><div className="mx-auto max-w-3xl"><p className="mb-4 text-[10px] font-semibold uppercase tracking-[.3em] text-[#dfc39a]">Wholesale made straightforward</p><h2 className="font-serif text-4xl leading-tight sm:text-5xl">Build an assortment your customers will love.</h2><p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/75">Explore the catalogue for your boutique, retail shop or resale business. Minimum order quantity is 10 pieces per product.</p><WholesaleEnquiryForm trigger={<button type="button" className="mt-8 inline-flex items-center gap-3 bg-[#f8f2e8] px-7 py-4 text-[10px] font-semibold uppercase tracking-[.14em] text-[#48292b]">Send a wholesale enquiry <ArrowRight size={14} /></button>} /></div></section>
  </main>;
}
