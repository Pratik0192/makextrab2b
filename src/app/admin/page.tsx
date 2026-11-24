import AdminDashboard from "@/components/admin/dashboard/AdminDashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  return <AdminDashboard adminName={user?.firstName ?? "there"} />;
}
