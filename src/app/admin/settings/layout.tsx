import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
export default async function BillingSettingsLayout({ children }: { children: React.ReactNode }) { const user = await getCurrentUser(); if (!user || user.role !== "SUPER_ADMIN") redirect("/sales"); return children; }
