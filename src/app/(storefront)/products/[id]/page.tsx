"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getProductById } from "@/services/product.service";
import { apiErrorMessage } from "@/services/service-utils";
import type { Product } from "@/types/product";
import WholesaleEnquiryForm from "@/components/storefront/WholesaleEnquiryForm";

export default function ProductDetailPage(){
 const params=useParams<{id:string}>();const [product,setProduct]=useState<Product|null>(null),[error,setError]=useState("");
 useEffect(()=>{if(!params.id)return;getProductById(params.id).then(setProduct).catch(e=>setError(apiErrorMessage(e,"Product not found.")))},[params.id]);
 if(error)return <main className="min-h-screen bg-[#fbf9f5] p-10 text-center"><p role="alert" className="text-rose-800">{error}</p><Link href="/products" className="mt-4 inline-block text-sm underline">Return to products</Link></main>;
 if(!product)return <main className="grid min-h-screen place-items-center bg-[#fbf9f5] text-sm text-slate-500">Loading product…</main>;
 const images=[...product.images].sort((a,b)=>Number(b.isPrimary)-Number(a.isPrimary)||a.displayOrder-b.displayOrder);
 return <main className="min-h-screen bg-[#fbf9f5] px-5 py-10 text-[#342424] md:px-12"><div className="mx-auto max-w-6xl"><Link href="/products" className="text-xs uppercase tracking-[.2em] text-[#8b555b]">← Back to catalogue</Link><div className="mt-8 grid gap-10 md:grid-cols-2"><div className="grid grid-cols-2 gap-3">{images.length?images.map(img=><img key={img.id} src={img.imageUrl} alt={img.altText??product.name} className="aspect-[.8] w-full bg-[#eee7df] object-cover"/>):<div className="aspect-[.8] bg-[#eee7df]"/>}</div><div className="md:sticky md:top-10 md:self-start"><p className="text-xs uppercase tracking-[.2em] text-[#9a7547]">{product.category.name}{product.collection?` · ${product.collection.name}`:""}</p><h1 className="mt-3 font-serif text-4xl">{product.name}</h1><p className="mt-2 text-xs uppercase tracking-wider text-[#9a7547]">SKU {product.sku}</p>{product.shortDescription&&<p className="mt-6 text-base leading-7 text-[#746866]">{product.shortDescription}</p>}<dl className="mt-8 grid grid-cols-2 gap-4 border-y border-[#e8ded2] py-5 text-sm"><div><dt className="text-xs text-slate-500">Fabric</dt><dd className="mt-1">{product.fabric||"—"}</dd></div><div><dt className="text-xs text-slate-500">Colour</dt><dd className="mt-1">{product.colour||"—"}</dd></div><div><dt className="text-xs text-slate-500">Work / design</dt><dd className="mt-1">{product.workOrDesign||"—"}</dd></div><div><dt className="text-xs text-slate-500">Length</dt><dd className="mt-1">{product.length||"—"}</dd></div><div><dt className="text-xs text-slate-500">Minimum order</dt><dd className="mt-1">10 units</dd></div></dl>{product.description&&<p className="mt-6 whitespace-pre-line text-sm leading-7 text-[#746866]">{product.description}</p>}<WholesaleEnquiryForm initialProduct={product} trigger={<button type="button" className="mt-8 inline-flex items-center border border-[#6b4846] bg-[#542d30] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white">Enquire Now</button>} /></div></div></div></main>
}
