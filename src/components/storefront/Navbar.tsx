"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import LoginModal from "@/components/auth/LoginModal";
import WholesaleEnquiryForm from "@/components/storefront/WholesaleEnquiryForm";

const links = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/collections", label: "Collections" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <div className="flex min-h-8 items-center justify-center bg-[#452627] px-4 text-center text-[9px] font-medium uppercase tracking-[.19em] text-[#f9f3e9] sm:text-[10px]">
        Wholesale sarees, thoughtfully sourced <span className="mx-2 text-[#c7a776]">✦</span> Pan-India delivery support
      </div>
      <header className="relative z-20 border-b border-[#e9e2d9] bg-[#fbf9f5] text-[#342424]">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 md:px-10 lg:px-14">
          <Link href="/" aria-label="Nextra Wholesale home" className="flex items-center gap-2.5 text-[#3e2424]">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-[#b28b52]/70 font-serif text-lg text-[#b28b52]">N</span>
            <span className="leading-none"><span className="block font-serif text-[21px] tracking-[.04em]">Nextra</span><span className="mt-1 block text-[8px] font-medium uppercase tracking-[.31em] opacity-65">Wholesale · India</span></span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
            {links.map((link) => <Link key={link.href} href={link.href} className={`text-[10px] uppercase tracking-[.12em] transition hover:text-[#9a7547] ${pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href)) ? "text-[#9a7547]" : "text-[#644d4a]"}`}>{link.label}</Link>)}
          </nav>
          <div className="hidden items-center gap-5 lg:flex"><LoginModal /><WholesaleEnquiryForm trigger={<button type="button" className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#542d30]">Wholesale enquiry</button>} /><Link href="/products" className="rounded-sm bg-[#542d30] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-white transition hover:bg-[#6b3b3d]">Browse catalogue</Link></div>
          <button type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="storefront-mobile-nav" onClick={() => setMenuOpen((open) => !open)} className="grid h-10 w-10 place-items-center text-[#513c3b] lg:hidden">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
        {menuOpen && <nav id="storefront-mobile-nav" aria-label="Mobile navigation" className="border-t border-[#e9e2d9] bg-[#fbf9f5] px-5 py-3 lg:hidden">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block border-b border-[#eee7df] py-3 text-xs uppercase tracking-[.12em] text-[#644d4a]">{link.label}</Link>)}<div className="flex items-center gap-5 py-3"><LoginModal /><WholesaleEnquiryForm trigger={<button type="button" className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#542d30]">Wholesale enquiry</button>} /></div></nav>}
      </header>
    </>
  );
}
