import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SalesShell from "@/components/sales/SalesShell";
export default async function SalesLayout({ children }: { children: React.ReactNode }) { const user = await getCurrentUser(); if (!user || user.role !== "SALES_EXECUTIVE") redirect("/"); return <SalesShell user={user}>{children}</SalesShell>; }
