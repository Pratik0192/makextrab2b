"use client";

import {
  Activity, Archive, ArrowDownToLine, BarChart3, Boxes, Building2,
  CalendarDays, ChartNoAxesCombined, ChevronRight, ClipboardList, CreditCard,
  FileClock, FileText, LayoutDashboard, LogOut, Menu, Package, Receipt, FileMinus2,
  Settings, ShoppingBag, ShoppingCart, Store, UserRound, Users, Wallet, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import type { AuthenticatedUser } from "@/types/auth";
import { toast } from "sonner";

type NavigationItem = { label: string; href: string; icon: LucideIcon };
type NavigationGroup = { label: string; items: NavigationItem[] };

const navigation: NavigationGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }] },
  { label: "Customer & Sales", items: [
    { label: "Leads", href: "/admin/leads", icon: Users },
    { label: "Lost Leads", href: "/admin/leads/lost", icon: FileClock },
    { label: "Sales Executives", href: "/admin/sales-executives", icon: UserRound },
    { label: "Customers", href: "/admin/customers", icon: UserRound },
    { label: "Quotations", href: "/admin/quotations", icon: FileText },
    { label: "Sales Orders", href: "/admin/orders", icon: ShoppingCart },
    { label: "Warehouse & Dispatch", href: "/admin/warehouse/orders", icon: Boxes },
  ] },
  { label: "Catalogue & Inventory", items: [
    { label: "Products", href: "/admin/products", icon: Package },
    { label: "Categories", href: "/admin/categories", icon: Boxes },
    { label: "Collections", href: "/admin/collections", icon: Archive },
    { label: "Inventory", href: "/admin/inventory", icon: ClipboardList },
    { label: "Warehouses", href: "/admin/warehouse", icon: Building2 },
  ] },
  { label: "Purchasing & Billing", items: [
    { label: "Suppliers", href: "/admin/suppliers", icon: Store },
    { label: "Purchase Orders", href: "/admin/purchase-orders", icon: ShoppingBag },
    { label: "Goods Receipt", href: "/admin/goods-receipt", icon: ArrowDownToLine },
    { label: "Invoices", href: "/admin/invoices", icon: Receipt },
    { label: "Credit Notes", href: "/admin/credit-notes", icon: FileMinus2 },
    { label: "Payments", href: "/admin/payments", icon: CreditCard },
  ] },
  { label: "Operations", items: [
    { label: "POS", href: "/admin/pos", icon: Store },
    { label: "HRMS", href: "/admin/hrms", icon: Users },
    { label: "Attendance", href: "/admin/attendance", icon: CalendarDays },
    { label: "Leave", href: "/admin/leave", icon: FileClock },
    { label: "Payroll", href: "/admin/payroll", icon: Wallet },
  ] },
  { label: "Finance & Analytics", items: [
    { label: "Expenses", href: "/admin/expenses", icon: CreditCard },
    { label: "Finance", href: "/admin/finance", icon: BarChart3 },
    { label: "Reports", href: "/admin/reports", icon: ChartNoAxesCombined },
  ] },
  { label: "Administration", items: [
    { label: "Users & Access", href: "/admin/users-access", icon: UserRound },
    { label: "Settings", href: "/admin/settings", icon: Settings },
    { label: "Company Profile", href: "/admin/settings/company", icon: Building2 },
    { label: "GST Configuration", href: "/admin/settings/gst", icon: Settings },
    { label: "HSN / SAC Master", href: "/admin/settings/hsn", icon: Settings },
    { label: "Product Tax Mapping", href: "/admin/settings/product-tax", icon: Package },
    { label: "Financial Year & Numbering", href: "/admin/settings/financial-year", icon: CalendarDays },
    { label: "Charges & Rounding", href: "/admin/settings/charges", icon: Settings },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: Activity },
  ] },
];

function titleForPath(pathname: string): string {
  const items = navigation.flatMap((group) => group.items).filter((entry) => entry.href === pathname || (entry.href !== "/admin" && pathname.startsWith(`${entry.href}/`)));
  return items.sort((a,b)=>b.href.length-a.href.length)[0]?.label ?? "Dashboard";
}

function Navigation({ onNavigate, role }: { onNavigate?: () => void; role: AuthenticatedUser["role"] }) {
  const pathname = usePathname();
  const groups = role === "SALES_EXECUTIVE" ? [{ label: "Customer & Sales", items: [{ label: "Leads", href: "/admin/leads", icon: Users }, { label: "Lost Leads", href: "/admin/leads/lost", icon: FileClock }, { label: "My Customers", href: "/sales/customers", icon: UserRound }, { label: "My Quotations", href: "/sales/quotations", icon: FileText }] }] : navigation;
  const activeHref = groups.flatMap((group) => group.items).filter((item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
  return <nav aria-label="Administration navigation" className="space-y-6 px-3 pb-5">
    {groups.map((group) => <div key={group.label}>
      <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.17em] text-slate-400">{group.label}</h2>
      <ul className="space-y-1">{group.items.map((item) => {
        const Icon = item.icon;
        const active = activeHref === item.href;
        return <li key={item.href}><Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition ${active ? "bg-[#f5eaea] font-medium text-[#9D174D]" : "text-slate-600 hover:bg-slate-50 hover:text-[#9D174D]"}`}>
          <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{active && <ChevronRight className="ml-auto" size={14} />}
        </Link></li>;
      })}</ul>
    </div>)}
  </nav>;
}

export default function AdminShell({ user, children }: { user: AuthenticatedUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pageTitle = useMemo(() => titleForPath(pathname), [pathname]);

  useEffect(() => setMobileOpen(false), [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api.post("/api/auth/logout");
      router.replace("/");
      router.refresh();
    } catch {
      setLoggingOut(false);
      toast.error("Logout failed. Please try again.");
    }
  }

  const sidebar = <>
    <div className="border-b border-slate-100 px-6 py-5">
      <Link href={user.role === "SALES_EXECUTIVE" ? "/admin/leads" : "/admin"} className="block text-[13px] font-bold tracking-[.15em] text-[#572b30]">NEXTRA WHOLESALE</Link>
      <p className="mt-1 text-[10px] tracking-wide text-slate-400">Business Management System</p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto pt-5"><Navigation role={user.role} onNavigate={() => setMobileOpen(false)} /></div>
    <div className="border-t border-slate-100 p-4">
      <div className="mb-3 flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5eaea] text-sm font-semibold text-[#9D174D]">{user.firstName.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0"><p className="truncate text-xs font-medium text-slate-800">{user.firstName} {user.lastName}</p><p className="truncate text-[10px] text-slate-500">{user.email}</p></div>
      </div>
      <button type="button" onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
        <LogOut size={16} />{loggingOut ? "Signing out…" : "Log out"}
      </button>
    </div>
  </>;

  return <div className="min-h-screen bg-[#f6f5f3] text-slate-900">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-slate-200 bg-white lg:flex">{sidebar}</aside>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
    <aside aria-label="Mobile administration menu" inert={!mobileOpen} className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,320px)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute right-4 top-5 z-10 rounded p-1 text-slate-500"><X size={20} /></button>{sidebar}
    </aside>
    <div className="min-h-screen lg:pl-[268px]">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" aria-label="Open navigation menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={19}/></button>
          <div><p className="text-[10px] text-slate-400">Nextra Wholesale <span className="px-1">/</span> Administration</p><h1 className="truncate text-[15px] font-semibold text-slate-800">{pageTitle}</h1></div>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-3">
      <span className="hidden rounded-full border border-[#ead8d9] bg-[#fbf4f4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9D174D] sm:inline-flex">{user.role === "SUPER_ADMIN" ? "Super Admin" : "Sales Executive"}</span>
          <div className="hidden text-right md:block"><p className="text-xs font-medium text-slate-800">{user.firstName} {user.lastName}</p><p className="text-[10px] text-slate-500">{user.email}</p></div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#f5eaea] text-sm font-semibold text-[#9D174D] sm:hidden">{user.firstName.slice(0, 1).toUpperCase()}</div>
          <button type="button" onClick={logout} disabled={loggingOut} className="hidden items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 sm:flex disabled:opacity-50"><LogOut size={14}/>{loggingOut ? "Signing out…" : "Log out"}</button>
        </div>
      </header>
      <main className="min-h-[calc(100vh-68px)] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
