"use client";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
type Executive = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { assignedLeads: number };
};
export default function SalesExecutivesPage() {
  const [items, setItems] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  async function load() {
    try {
      const r = await api.get("/api/admin/sales-executives");
      setItems(r.data.data.items);
    } catch {
      toast.error("Sales Executives could not be loaded.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      const r = await api.post("/api/admin/sales-executives", {
        firstName,
        lastName,
        email,
        phone,
      });
      const token = r.data.data.activationToken;
      setActivationUrl(
        `${location.origin}/setup-account?token=${encodeURIComponent(token)}`,
      );
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      toast.success("Account created. Copy the one-time activation link now.");
      await load();
    } catch (e) {
      toast.error(
        (e as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? "Account could not be created.",
      );
    }
  }
  async function toggle(user: Executive) {
    try {
      await api.patch(`/api/admin/sales-executives/${user.id}`, {
        isActive: !user.isActive,
      });
      toast.success(`Account ${user.isActive ? "deactivated" : "activated"}.`);
      await load();
    } catch (e) {
      toast.error(
        (e as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ??
          "Account status could not be changed.",
      );
    }
  }
  async function copyActivationLink() {
    try {
      await navigator.clipboard.writeText(activationUrl);
      toast.success("Copied to clipboard successfully.");
    } catch {
      toast.error(
        "Could not copy the activation link. Check clipboard permissions and try again.",
      );
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-xl border border-[#F3DCE7] shadow-[0_5px_18px_rgba(131,24,67,0.20)] bg-white p-5">
        <h2 className="font-serif text-xl">Create Sales Executive</h2>
        <p className="mt-1 text-xs text-slate-500">
          An inactive account is created. Share its one-time setup link
          privately; it expires after 24 hours.
        </p>
        <form
          onSubmit={create}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <Input
            required
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="border-none"
          />
          <Input
            required
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="border-none"
          />
          <Input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-none"
          />
          <Input
            placeholder="Mobile (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border-b border-[#9D174D]"
          />
          <button className="rounded bg-[#9D174D] px-4 text-sm text-white">
            Create account
          </button>
        </form>
        {activationUrl && (
          <div className="mt-4 rounded bg-amber-50 p-3 text-xs">
            <p>One-time activation link (shown once here; copy it now):</p>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={activationUrl}
                className="min-w-0 flex-1 rounded border bg-white p-2"
              />
              <button
                type="button"
                onClick={() => void copyActivationLink()}
                className="rounded border px-3"
              >
                Copy
              </button>
              <button
                onClick={() => setActivationUrl("")}
                className="rounded border px-3"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="overflow-hidden rounded-xl border border-[#F3DCE7] shadow-[0_5px_18px_rgba(131,24,67,0.20)] bg-white">
        <div className="border-b p-5">
          <h2 className="font-serif text-xl">Sales Executives</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email / Mobile</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned leads</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="p-3">
                      {u.email}
                      <br />
                      <span className="text-xs text-slate-500">
                        {u.phone ?? "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.isActive ? "Active" : "Inactive"}
                    </td>
                    <td className="p-3">{u._count.assignedLeads}</td>
                    <td className="p-3">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => void toggle(u)}
                        className="rounded border px-3 py-1"
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
