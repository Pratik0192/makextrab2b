"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, BriefcaseBusiness,
  CalendarDays, CheckCircle2, ChevronDown, Clock3, FileText, HandCoins, IndianRupee, Layers3,
  Package, RefreshCw, ShoppingCart, Target, Users, Wallet,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import api from "@/lib/axios";
import { toast } from "sonner";

type LowStockRow = { id: string; productName: string; sku: string; warehouseName: string; available: number; reorderLevel: number };
type ExecutiveRow = { id: string; name: string; leads: number; converted: number; conversionRate: number; orders: number; invoiced: number };
type ProductRow = { name: string; sku: string; quantity: number; amount: number };
type FollowUpRow = { id: string; dueAt: string; note: string; status: string; lead: { id: string; referenceNumber: string; businessName: string }; assignee: string; overdue: boolean; href: string };
type ActivityRow = { id: string; kind: string; title: string; detail: string; actor: string; at: string; href: string };
type RecentLeadRow = { id: string; referenceNumber: string; businessName: string; city: string; stage: string; createdAt: string };
type RecentQuotationRow = { id: string; quotationNumber: string; status: string; quotationDate: string; totalAmount: number; customer: { businessName: string } };
type RecentOrderRow = { id: string; orderNumber: string; status: string; orderDate: string; totalAmount: number; customer: { businessName: string } };
type RecentInvoiceRow = { id: string; invoiceNumber: string; status: string; issuedAt: string; grandTotal: number; customer: { businessName: string } };
type RecentRow = { id: string; reference: string; business: string; status: string; date: string; amount?: number };
type DashboardData = {
  generatedAt: string; isDemoData: boolean;
  kpis: { leads: { total: number; created: number; previousCreated: number; qualified: number; converted: number; previousConverted: number }; customers: number; newCustomers: number; quotations: number; pendingQuotations: number; confirmedOrders: number; invoiced: { amount: number; previousAmount: number; count: number }; collected: { amount: number; count: number }; outstanding: { amount: number | string; invoices: number }; creditNotes: { amount: number; count: number } };
  crm: { pipeline: Record<string, number>; priorities: Record<string, number>; conversionRate: number; trend: Array<{ date: string; leads: number; converted: number; invoiced: number }> };
  quotations: Record<string, number>; orders: Record<string, number>;
  sales: { trend: Array<{ date: string; leads: number; converted: number; invoiced: number }>; topProducts: ProductRow[]; executives: ExecutiveRow[] };
  inventory: { activeProducts: number; activeWarehouses: number; onHand: number; reserved: number; blocked: number; available: number; lowStock: LowStockRow[] };
  followUps: FollowUpRow[]; activity: ActivityRow[]; recent: { leads: RecentLeadRow[]; quotations: RecentQuotationRow[]; orders: RecentOrderRow[]; invoices: RecentInvoiceRow[] };
};

const colors = ["#9D174D", "#C05B7B", "#D9A1B1", "#78675E", "#A7A29E", "#D5D0CB", "#E7D9DD", "#6E8192", "#8F9A83", "#B7A88D"];
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("en-IN");
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function indiaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function shiftDay(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
function rangeFor(preset: string) {
  const today = indiaDate();
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") return { from: shiftDay(today, -6), to: today };
  if (preset === "30d") return { from: shiftDay(today, -29), to: today };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "lastMonth") { const first = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); first.setUTCMonth(first.getUTCMonth() - 1); const from = first.toISOString().slice(0, 10); const last = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); last.setUTCDate(0); return { from, to: last.toISOString().slice(0, 10) }; }
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: shiftDay(today, -29), to: today };
}
function money(value: number | string) { return currency.format(Number(value) || 0); }
function pct(current: number, previous: number) { if (!previous) return current ? 100 : 0; return (current - previous) / Math.abs(previous) * 100; }
function titleCase(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,.025)] ${className}`}>
    <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action}</header>
    <div className="p-5 sm:p-6">{children}</div>
  </section>;
}

function Kpi({ title, value, helper, icon: Icon, href, change, prefix = "", accent = "rose" }: { title: string; value: string; helper: string; icon: typeof Users; href: string; change?: number; prefix?: string; accent?: "rose" | "stone" | "green" | "blue" }) {
  const tint = { rose: "bg-[#fbf0f3] text-[#9D174D]", stone: "bg-stone-100 text-stone-700", green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700" }[accent];
  return <Link href={href} className="group rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#d8a7b8] hover:shadow-md sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}><Icon size={18} strokeWidth={1.8}/></div><ArrowRight size={15} className="mt-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#9D174D]" /></div>
    <p className="mt-4 text-[11px] font-medium text-slate-500">{title}</p><p className="mt-1 text-[25px] font-semibold tracking-tight text-slate-900 sm:text-[28px]">{prefix}{value}</p>
    <div className="mt-2 flex min-h-4 items-center gap-1.5 text-[10px] text-slate-500">{typeof change === "number" && <span className={`inline-flex items-center gap-0.5 font-semibold ${change >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{change >= 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} {Math.abs(change).toFixed(1)}%</span>}{helper}</div>
  </Link>;
}

function LoadingDashboard() { return <div className="space-y-6 animate-pulse"><div className="h-28 rounded-2xl bg-white"/><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-36 rounded-2xl bg-white" />)}</div><div className="grid gap-5 lg:grid-cols-2"><div className="h-80 rounded-2xl bg-white"/><div className="h-80 rounded-2xl bg-white"/></div></div>; }

export default function AdminDashboard({ adminName }: { adminName: string }) {
  const router = useRouter();
  const [preset, setPreset] = useState("30d");
  const [custom, setCustom] = useState(() => rangeFor("30d"));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recentTab, setRecentTab] = useState("leads");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const range = preset === "custom" ? custom : rangeFor(preset);

  const load = useCallback(async () => {
    if (!range.from || !range.to) return;
    setLoading(true);
    setError(false);
    try {
      const response = await api.get<DashboardData>(`/api/admin/dashboard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
      setData(response.data); setUpdatedAt(new Date());
    } catch (reason: unknown) {
      setError(true);
      const message = typeof reason === "object" && reason !== null && "response" in reason
        ? (reason as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(message || "Dashboard data could not be loaded.");
    } finally { setLoading(false); }
  }, [range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  const pipelineData = useMemo(() => Object.entries(data?.crm.pipeline ?? {}).map(([stage, count]) => ({ stage, name: titleCase(stage), count })), [data]);
  const priorityData = useMemo(() => Object.entries(data?.crm.priorities ?? {}).map(([priority, count]) => ({ name: titleCase(priority), count, color: priority === "HIGH" ? "#9D174D" : priority === "MEDIUM" ? "#C98599" : priority === "LOW" ? "#D9D5D1" : "#6E8192" })), [data]);
  const trendLabel = "By issue date · India local time";
  const recentRows: RecentRow[] = useMemo(() => {
    if (!data) return [];
    if (recentTab === "leads") return data.recent.leads.map((row) => ({ id: row.id, reference: row.referenceNumber, business: row.businessName, status: row.stage, date: row.createdAt }));
    if (recentTab === "quotations") return data.recent.quotations.map((row) => ({ id: row.id, reference: row.quotationNumber, business: row.customer.businessName, status: row.status, date: row.quotationDate, amount: row.totalAmount }));
    if (recentTab === "orders") return data.recent.orders.map((row) => ({ id: row.id, reference: row.orderNumber, business: row.customer.businessName, status: row.status, date: row.orderDate, amount: row.totalAmount }));
    return data.recent.invoices.map((row) => ({ id: row.id, reference: row.invoiceNumber, business: row.customer.businessName, status: row.status, date: row.issuedAt, amount: row.grandTotal }));
  }, [data, recentTab]);

  if (loading && !data) return <LoadingDashboard />;
  if (!data && error) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-700"><Activity size={20}/></div><h2 className="mt-4 text-lg font-semibold">Dashboard unavailable</h2><p className="mt-1 text-sm text-slate-500">We couldn’t retrieve the latest business data.</p><button onClick={() => void load()} className="mt-5 rounded-lg bg-[#9D174D] px-4 py-2 text-sm font-medium text-white">Try again</button></div>;

  const leadChange = pct(data!.kpis.leads.created, data!.kpis.leads.previousCreated);
  const invoicedChange = pct(data!.kpis.invoiced.amount, data!.kpis.invoiced.previousAmount);
  const followUps = data!.followUps;
  const todayKey = indiaDate();

  return <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
    <div className="relative overflow-hidden rounded-2xl border border-[#ead7dd] bg-white px-5 py-5 shadow-[0_4px_20px_rgba(83,41,54,.04)] sm:px-7 sm:py-6">
      <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-[#fbf1f4]"/><div className="pointer-events-none absolute right-32 top-16 h-28 w-28 rounded-full border border-[#f2e4e8]"/>
      <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center"><div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Business overview</span></div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[30px]">Welcome back, {adminName}</h1><p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening across your business.</p>{data!.isDemoData && <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800"><AlertTriangle size={12}/> Demo / test company data</div>}</div>
        <div className="flex flex-wrap items-center gap-2"><label className="relative"><span className="sr-only">Date range</span><select value={preset} onChange={(event) => { setPreset(event.target.value); if (event.target.value !== "custom") setCustom(rangeFor(event.target.value)); }} className="h-10 min-w-[168px] appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-[#bd8095]"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="lastMonth">Last month</option><option value="year">This year</option><option value="custom">Custom range</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400"/></label>
          {preset === "custom" && <div className="flex items-center gap-1.5"><input aria-label="Start date" type="date" value={custom.from} max={custom.to || todayKey} onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))} className="h-10 w-[132px] rounded-lg border border-slate-200 px-2 text-[11px]"/><span className="text-slate-400">–</span><input aria-label="End date" type="date" value={custom.to} min={custom.from} max={todayKey} onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))} className="h-10 w-[132px] rounded-lg border border-slate-200 px-2 text-[11px]"/></div>}
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/><span className="hidden sm:inline">Refresh</span></button>
        </div>
      </div><div className="relative mt-4 flex items-center gap-1.5 text-[10px] text-slate-400"><CalendarDays size={12}/><span>{dateFormat.format(new Date(`${range.from}T12:00:00+05:30`))} – {dateFormat.format(new Date(`${range.to}T12:00:00+05:30`))}</span>{updatedAt && <><span className="px-1">·</span><span>Updated {dateTimeFormat.format(updatedAt)}</span></>}</div>
    </div>

    {data!.isDemoData && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">These financial figures are from a company profile marked Demo/Test. Treat them as test data, not business performance.</div>}

    <section><div className="mb-3 flex items-end justify-between"><div><h2 className="text-sm font-semibold text-slate-900">At a glance</h2><p className="mt-1 text-xs text-slate-500">Current CRM totals and activity within the selected period</p></div><span className="hidden text-[10px] text-slate-400 sm:block">Compared with the previous equivalent period</span></div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi title="Total leads" value={integer.format(data!.kpis.leads.total)} helper={`${integer.format(data!.kpis.leads.created)} created in range`} icon={Users} href="/admin/leads" change={leadChange}/>
        <Kpi title="New leads" value={integer.format(data!.kpis.leads.created)} helper="Created in selected period" icon={Users} href={`/admin/leads?from=${range.from}&to=${range.to}`} change={leadChange} accent="blue"/>
        <Kpi title="Qualified leads" value={integer.format(data!.kpis.leads.qualified)} helper="Current qualified pipeline" icon={Target} href="/admin/leads?stage=QUALIFIED" accent="blue"/>
        <Kpi title="Converted leads" value={integer.format(data!.kpis.leads.converted)} helper="Customer conversions in range" icon={CheckCircle2} href="/admin/customers" accent="green"/>
        <Kpi title="Total customers" value={integer.format(data!.kpis.customers)} helper={`${integer.format(data!.kpis.newCustomers)} added in range`} icon={BriefcaseBusiness} href="/admin/customers" accent="stone"/>
        <Kpi title="Quotations" value={integer.format(data!.kpis.quotations)} helper={`${integer.format(data!.kpis.pendingQuotations)} sent and awaiting response`} icon={FileText} href="/admin/quotations"/>
        <Kpi title="Pending quotations" value={integer.format(data!.kpis.pendingQuotations)} helper="Sent and awaiting customer response" icon={FileText} href="/admin/quotations" accent="stone"/>
        <Kpi title="Confirmed orders" value={integer.format(data!.kpis.confirmedOrders)} helper="Confirmed in selected period" icon={ShoppingCart} href="/admin/orders" accent="green"/>
        <Kpi title="Invoiced" value={money(data!.kpis.invoiced.amount)} helper={`${integer.format(data!.kpis.invoiced.count)} issued invoices · gross`} icon={IndianRupee} href="/admin/invoices" change={invoicedChange}/>
        <Kpi title="Collected" value={money(data!.kpis.collected.amount)} helper={`${integer.format(data!.kpis.collected.count)} recorded payments · reversals excluded`} icon={Wallet} href="/admin/invoices" accent="green"/>
        <Kpi title="Outstanding" value={money(data!.kpis.outstanding.amount)} helper={`${integer.format(data!.kpis.outstanding.invoices)} issued invoices with balance`} icon={HandCoins} href="/admin/invoices" accent="stone"/>
        <Kpi title="Pending payments" value={integer.format(data!.kpis.outstanding.invoices)} helper="Issued invoices with outstanding balance" icon={Clock3} href="/admin/invoices" accent="blue"/>
        <Kpi title="Credit notes" value={money(data!.kpis.creditNotes.amount)} helper={`${integer.format(data!.kpis.creditNotes.count)} issued in range · shown separately`} icon={FileText} href="/admin/credit-notes" accent="blue"/>
      </div>
    </section>

    <section><div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">CRM analytics</h2><p className="mt-1 text-xs text-slate-500">Lead acquisition, pipeline health and priority across active records</p></div>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr_1fr]">
        <Panel title="Lead acquisition" subtitle="New lead creation and customer conversions"><div className="h-[260px] w-full">{data!.crm.trend.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data!.crm.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9D174D" stopOpacity={0.18}/><stop offset="100%" stopColor="#9D174D" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#eef0f3" vertical={false}/><XAxis dataKey="date" tickFormatter={(v) => dateFormat.format(new Date(`${v}T12:00:00Z`)).replace(/\s\d{4}$/, "")} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#8a94a3" }}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#8a94a3" }}/><Tooltip labelFormatter={(v) => dateFormat.format(new Date(`${v}T12:00:00Z`))} contentStyle={{ borderRadius: 10, borderColor: "#e5e7eb", fontSize: 11 }}/><Area type="monotone" dataKey="leads" name="New leads" stroke="#9D174D" strokeWidth={2.3} fill="url(#leadFill)"/><Area type="monotone" dataKey="converted" name="Converted customers" stroke="#648274" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer> : <Empty text="No lead activity in this date range"/>}</div><div className="mt-3 flex gap-5 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#9D174D]"/>New leads</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#648274]"/>Converted customers</span></div></Panel>
        <Panel title="Lead pipeline" subtitle="Current lead stage · click a segment to view"><div className="relative h-[214px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pipelineData} dataKey="count" nameKey="name" innerRadius={57} outerRadius={83} paddingAngle={2} stroke="white" strokeWidth={2} onClick={(slice) => slice?.stage && router.push(`/admin/leads?stage=${slice.stage}`)}>{pipelineData.map((slice, index) => <Cell key={slice.stage} fill={colors[index % colors.length]} cursor="pointer"/>)}</Pie><Tooltip formatter={(value) => [integer.format(Number(value)), "Leads"]} contentStyle={{ borderRadius: 10, fontSize: 11 }}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><p className="text-2xl font-semibold tracking-tight">{integer.format(data!.kpis.leads.total)}</p><p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-400">Tracked leads</p></div></div></div><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">{pipelineData.map((item, index) => <Link key={item.stage} href={`/admin/leads?stage=${item.stage}`} className="flex min-w-0 items-center gap-2 text-[10px] hover:text-[#9D174D]"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }}/><span className="truncate text-slate-500">{item.name}</span><span className="ml-auto font-semibold text-slate-800">{integer.format(item.count)}</span></Link>)}</div></Panel>
        <div className="space-y-5"><Panel title="Lead priority" subtitle="All unmerged leads by stored priority"><div className="space-y-4">{priorityData.map((item) => { const total = priorityData.reduce((sum, row) => sum + row.count, 0); return <Link key={item.name} href={`/admin/leads?priority=${item.name.toUpperCase()}`} className="block"><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-700">{item.name}</span><span className="text-slate-500">{integer.format(item.count)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${total ? item.count / total * 100 : 0}%`, backgroundColor: item.color }}/></div></Link>; })}</div></Panel><div className="rounded-2xl border border-[#ead7dd] bg-[#fcf7f8] p-5"><div className="flex items-center justify-between"><div><p className="text-[11px] font-medium text-slate-500">All-time conversion rate</p><p className="mt-1 text-[30px] font-semibold tracking-tight text-[#7f143f]">{data!.crm.conversionRate.toFixed(1)}%</p></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#9D174D]"><Target size={20}/></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ead7dd]"><div className="h-full rounded-full bg-[#9D174D]" style={{ width: `${Math.min(100, data!.crm.conversionRate)}%` }}/></div><p className="mt-2 text-[10px] text-slate-500">Converted leads ÷ total unmerged leads</p></div></div>
      </div>
    </section>

    <section><div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">Sales & operations</h2><p className="mt-1 text-xs text-slate-500">Issued invoice performance, order movement and stock health</p></div><div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Issued invoice value" subtitle={`${trendLabel} · gross invoice total before issued credit notes`} action={<Link href="/admin/invoices" className="text-[11px] font-medium text-[#9D174D] hover:underline">Invoices <ArrowRight className="ml-1 inline" size={13}/></Link>}><div className="h-[260px]">{data!.sales.trend.some((point) => point.invoiced > 0) ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data!.sales.trend} margin={{ top: 8, right: 6, left: 2, bottom: 0 }}><defs><linearGradient id="invoiceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#648274" stopOpacity={0.22}/><stop offset="100%" stopColor="#648274" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#eef0f3" vertical={false}/><XAxis dataKey="date" tickFormatter={(v) => dateFormat.format(new Date(`${v}T12:00:00Z`)).replace(/\s\d{4}$/, "")} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#8a94a3" }}/><YAxis tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#8a94a3" }}/><Tooltip labelFormatter={(v) => dateFormat.format(new Date(`${v}T12:00:00Z`))} formatter={(v) => [money(Number(v)), "Issued invoices"]} contentStyle={{ borderRadius: 10, borderColor: "#e5e7eb", fontSize: 11 }}/><Area type="monotone" dataKey="invoiced" name="Invoice value" stroke="#648274" strokeWidth={2.5} fill="url(#invoiceFill)"/></AreaChart></ResponsiveContainer> : <Empty text="No issued invoices in this date range"/>}</div><p className="mt-2 text-[10px] text-slate-400">Credit notes: {money(data!.kpis.creditNotes.amount)} shown separately. Net period value: {money(data!.kpis.invoiced.amount - data!.kpis.creditNotes.amount)}.</p></Panel>
      <Panel title="Top-selling products" subtitle="Net invoiced quantity in selected period; issued credit notes deducted"><div className="h-[300px]">{data!.sales.topProducts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={data!.sales.topProducts.map((item) => ({ ...item, label: `${item.name} · ${item.sku}` }))} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}><CartesianGrid stroke="#eef0f3" horizontal={false}/><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#8a94a3" }}/><YAxis type="category" dataKey="label" width={165} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#526071" }}/><Tooltip content={<ProductTooltip/>} contentStyle={{ borderRadius: 10, borderColor: "#e5e7eb", fontSize: 11 }}/><Bar dataKey="quantity" name="quantity" fill="#9D174D" radius={[0, 5, 5, 0]} barSize={21}/></BarChart></ResponsiveContainer> : <Empty text="No invoiced product sales in this date range"/>}</div></Panel>
    </div></section>

    <section className="grid gap-5 xl:grid-cols-[1fr_1.25fr]"><Panel title="Quotation status" subtitle="Quotes created in selected period"><StatusList values={data!.quotations} order={["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]} href="/admin/quotations" icon={FileText}/></Panel><Panel title="Sales order status" subtitle="Orders created in selected period"><StatusList values={data!.orders} order={["DRAFT", "AWAITING_APPROVAL", "CONFIRMED", "ON_HOLD", "REJECTED"]} href="/admin/orders" icon={ShoppingCart}/></Panel></section>

    <section className="grid gap-5 xl:grid-cols-[1.1fr_1fr]"><Panel title="Inventory overview" subtitle="Physical stock, reservations and availability" action={<Link href="/admin/inventory" className="text-[11px] font-medium text-[#9D174D] hover:underline">Open inventory <ArrowRight className="ml-1 inline" size={13}/></Link>}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><InventoryStat label="Active products" value={integer.format(data!.inventory.activeProducts)} icon={Package}/><InventoryStat label="Warehouses" value={integer.format(data!.inventory.activeWarehouses)} icon={Boxes}/><InventoryStat label="On hand" value={integer.format(data!.inventory.onHand)} icon={Layers3}/><InventoryStat label="Available" value={integer.format(data!.inventory.available)} icon={CheckCircle2}/></div><div className="mt-4 flex gap-2 text-[10px] text-slate-500"><span className="rounded-md bg-amber-50 px-2.5 py-1.5">Reserved {integer.format(data!.inventory.reserved)}</span><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Blocked {integer.format(data!.inventory.blocked)}</span><span className="rounded-md bg-emerald-50 px-2.5 py-1.5">Available = on hand − reserved − blocked</span></div><div className="mt-6 border-t border-slate-100 pt-4"><div className="mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600"/><h3 className="text-xs font-semibold text-slate-800">Low stock</h3><span className="text-[10px] text-slate-400">Configured reorder levels only</span></div>{data!.inventory.lowStock.length ? <div className="divide-y divide-slate-100">{data!.inventory.lowStock.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-800">{item.productName}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.sku} · {item.warehouseName}</p></div><span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">{integer.format(item.available)} / {integer.format(item.reorderLevel)}</span></div>)}</div> : <Empty text="No products below configured reorder levels"/>}</div></Panel>
      <Panel title="Sales executive performance" subtitle="LeadAssignment owner at conversion; current owner for open leads · period orders/invoices" action={<Link href="/admin/sales-executives" className="text-[11px] font-medium text-[#9D174D] hover:underline">Manage team <ArrowRight className="ml-1 inline" size={13}/></Link>}><div className="overflow-x-auto"><table className="w-full min-w-[530px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400"><th className="pb-3 font-medium">Executive</th><th className="pb-3 text-right font-medium">Leads</th><th className="pb-3 text-right font-medium">Converted</th><th className="pb-3 text-right font-medium">Rate</th><th className="pb-3 text-right font-medium">Orders</th><th className="pb-3 text-right font-medium">Invoiced</th></tr></thead><tbody>{data!.sales.executives.slice(0, 8).map((executive) => <tr key={executive.id} className="border-b border-slate-50 last:border-0"><td className="py-3 text-xs font-medium text-slate-800">{executive.name}</td><td className="py-3 text-right text-xs text-slate-600">{integer.format(executive.leads)}</td><td className="py-3 text-right text-xs text-slate-600">{integer.format(executive.converted)}</td><td className="py-3 text-right text-xs font-medium text-slate-700">{executive.conversionRate.toFixed(1)}%</td><td className="py-3 text-right text-xs text-slate-600">{integer.format(executive.orders)}</td><td className="py-3 text-right text-xs font-medium text-slate-800">{money(executive.invoiced)}</td></tr>)}</tbody></table>{!data!.sales.executives.length && <Empty text="No active sales executives"/>}</div></Panel>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1fr_1.15fr]"><Panel title="Recent CRM activity" subtitle="Recent recorded events within selected period" action={<Link href="/admin/leads" className="text-[11px] font-medium text-[#9D174D] hover:underline">Open CRM <ArrowRight className="ml-1 inline" size={13}/></Link>}>{data!.activity.length ? <div className="space-y-1">{data!.activity.map((item) => <Link key={item.id} href={item.href} className="group flex gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50"><ActivityIcon kind={item.kind}/><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium capitalize text-slate-800 group-hover:text-[#9D174D]">{item.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{item.detail}</p><p className="mt-1 text-[9px] text-slate-400">{item.actor} · {dateTimeFormat.format(new Date(item.at))}</p></div><ArrowRight size={13} className="mt-1 shrink-0 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"/></Link>)}</div> : <Empty text="No recorded activity in this date range"/>}</Panel>
      <Panel title="Upcoming follow-ups" subtitle="Overdue, due today and the next 14 days" action={<Link href="/admin/leads" className="text-[11px] font-medium text-[#9D174D] hover:underline">View leads <ArrowRight className="ml-1 inline" size={13}/></Link>}>{followUps.length ? <div className="divide-y divide-slate-100">{followUps.map((item) => { const dueKey = indiaDate(new Date(item.dueAt)); const label = item.overdue ? "Overdue" : dueKey === todayKey ? "Due today" : "Upcoming"; return <Link key={item.id} href={item.href} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.overdue ? "bg-rose-50 text-rose-700" : dueKey === todayKey ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}><Clock3 size={16}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold text-slate-800">{item.lead.referenceNumber}</span><span className="truncate text-[10px] text-slate-500">{item.lead.businessName}</span></div><p className="mt-1 truncate text-[10px] text-slate-500">{item.assignee} · {item.note}</p></div><div className="shrink-0 text-right"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${item.overdue ? "bg-rose-50 text-rose-700" : dueKey === todayKey ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{label}</span><p className="mt-1 text-[9px] text-slate-400">{dateTimeFormat.format(new Date(item.dueAt))}</p></div></Link>; })}</div> : <Empty text="No pending follow-ups due in the next 14 days"/>}</Panel></section>

    <Panel title="Recent business records" subtitle="New leads, quotations, orders and issued invoices in selected period"><div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-50 p-1">{([["leads", "Leads"], ["quotations", "Quotations"], ["orders", "Sales orders"], ["invoices", "Invoices"]] as const).map(([key, label]) => <button key={key} onClick={() => setRecentTab(key)} className={`rounded-md px-3 py-1.5 text-[10px] font-medium transition ${recentTab === key ? "bg-white text-[#9D174D] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}</div><div className="overflow-x-auto"><RecentTable tab={recentTab} rows={recentRows}/></div></Panel>
  </div>;
}

function Empty({ text }: { text: string }) { return <div className="grid h-full min-h-[100px] place-items-center text-center text-xs text-slate-400">{text}</div>; }
function ProductTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: ProductRow }> }) { const product = payload?.[0]?.payload; return active && product ? <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] shadow-lg"><p className="max-w-[210px] truncate font-semibold text-slate-800">{product.name}</p><p className="mt-1 text-slate-500">SKU {product.sku}</p><p className="mt-1.5 text-slate-700">Net quantity <strong>{integer.format(product.quantity)}</strong></p><p className="mt-0.5 text-slate-700">Net billed value <strong>{money(product.amount)}</strong></p></div> : null; }
function InventoryStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Package }) { return <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="flex items-center justify-between"><span className="text-[9px] font-medium text-slate-500">{label}</span><Icon size={14} className="text-slate-400"/></div><p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{value}</p></div>; }
function StatusList({ values, order, href, icon: Icon }: { values: Record<string, number>; order: string[]; href: string; icon: typeof FileText }) { return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{order.map((status, index) => <Link key={status} href={href} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-[#e6c7d1] hover:bg-[#fdf8f9]"><div className="flex items-center justify-between"><Icon size={14} className={index === 2 ? "text-emerald-700" : "text-slate-400"}/><ArrowRight size={12} className="text-slate-300"/></div><p className="mt-3 text-xl font-semibold text-slate-900">{integer.format(values[status] ?? 0)}</p><p className="mt-1 text-[9px] font-medium text-slate-500">{titleCase(status)}</p></Link>)}</div>; }
function ActivityIcon({ kind }: { kind: string }) { const Icon = kind === "lead" || kind === "assignment" ? Users : kind === "quotation" ? FileText : kind === "order" ? ShoppingCart : kind === "dispatch" ? Package : kind === "invoice" ? IndianRupee : kind === "payment" ? Wallet : Layers3; return <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fbf1f4] text-[#9D174D]"><Icon size={14}/></div>; }
function RecentTable({ tab, rows }: { tab: string; rows: RecentRow[] }) {
  if (!rows.length) return <Empty text={`No ${tab} in the selected date range`}/>;
  return <table className="w-full min-w-[580px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400"><th className="pb-3 font-medium">Reference</th><th className="pb-3 font-medium">Business</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Date / value</th><th className="pb-3 text-right font-medium"> </th></tr></thead><tbody>{rows.map((row) => { const href = tab === "leads" ? `/admin/leads/${row.id}` : tab === "quotations" ? `/admin/quotations/${row.id}` : tab === "orders" ? `/admin/orders/${row.id}` : `/admin/invoices/${row.id}`; return <tr key={row.id} className="border-b border-slate-50 last:border-0"><td className="py-3 text-xs font-semibold text-slate-800">{row.reference}</td><td className="max-w-[260px] truncate py-3 text-xs text-slate-600">{row.business}</td><td className="py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-600">{titleCase(row.status)}</span></td><td className="py-3 text-right text-xs text-slate-600">{row.amount !== undefined ? money(row.amount) : dateFormat.format(new Date(row.date))}</td><td className="py-3 text-right"><Link href={href} className="text-[10px] font-medium text-[#9D174D] hover:underline">View</Link></td></tr>; })}</tbody></table>;
}

