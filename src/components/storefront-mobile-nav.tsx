"use client";

import { useState } from "react";
import { Menu, Search, UserRound, X } from "lucide-react";
import LoginModal from "@/components/auth/LoginModal";

const links = [
  ["Home", "#home"],
  ["Shop by Category", "#categories"],
  ["New Arrivals", "#products"],
  ["Collections", "#collections"],
  ["About Us", "#about"],
  ["Contact", "#contact"],
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-4 lg:hidden">
      <LoginModal className="rounded-sm border border-[#542d30] px-3 py-2 text-[9px] font-semibold uppercase tracking-[.1em] text-[#542d30]" />
      <a href="#products" aria-label="Search catalogue" className="text-[#513c3b]"><Search size={18} /></a>
      <a href="#contact" aria-label="Business account enquiries" className="text-[#513c3b]"><UserRound size={18} /></a>
      <button type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)} className="text-[#513c3b]">
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && <div id="mobile-navigation" className="absolute inset-x-0 top-full border-t border-[#e9e2d9] bg-[#fbf9f5] px-6 pb-7 pt-4 shadow-lg">
        <nav aria-label="Mobile navigation" className="flex flex-col">
          {links.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)} className="border-b border-[#eee8df] py-3 font-serif text-lg text-[#452f30]">{label}</a>)}
        </nav>
        <a href="#contact" onClick={() => setOpen(false)} className="mt-5 flex items-center justify-center bg-[#542d30] px-5 py-4 text-[10px] font-semibold uppercase tracking-[.12em] text-white">Get the wholesale catalogue</a>
      </div>}
    </div>
  );
}
