"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { toast } from "sonner";
export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [executives, setExecutives] = useState<
    { id: string; firstName: string; lastName: string }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .get(`/api/customers/${id}`)
      .then((r) => {
        const c = r.data;
        setValues(
          Object.fromEntries(
            [
              "businessName",
              "buyerName",
              "mobile",
              "whatsappNumber",
              "email",
              "gstin",
              "website",
              "socialMediaUrl",
              "businessAddress",
              "deliveryAddress",
              "deliveryCity",
              "deliveryState",
              "deliveryPincode",
              "deliveryContactName",
              "deliveryContactPhone",
              "city",
              "state",
              "pincode",
              "country",
              "assignedSalesExecutiveId",
            ].map((k) => [k, c[k] || ""]),
          ),
        );
      })
      .catch(() => setError("Could not load customer."));
    api
      .get("/api/admin/sales-executives")
      .then((r) => setExecutives(r.data.data?.items || []))
      .catch(() => {});
  }, [id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.patch(`/api/customers/${id}`, values);
      router.push(`/admin/customers/${id}`);
    } catch (err) {
      toast.error((err as any).response?.data?.error?.message || (err as any).response?.data?.error || "Could not save customer.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="mx-auto max-w-3xl space-y-5 rounded-lg border border-slate-300 bg-white p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">Edit customer</h2>
        <p className="text-sm text-slate-500">
          Changes are recorded in the customer audit history. The original lead
          is unchanged.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["businessName", "Business name"],
            ["buyerName", "Buyer name"],
            ["mobile", "Mobile"],
            ["whatsappNumber", "WhatsApp"],
            ["email", "Email"],
            ["gstin", "GSTIN"],
            ["website", "Website"],
            ["socialMediaUrl", "Social URL"],
            ["businessAddress", "Business address"],
            ["deliveryAddress", "Shipping address"],
            ["deliveryCity", "Shipping city"],
            ["deliveryState", "Shipping state"],
            ["deliveryPincode", "Shipping postal code"],
            ["deliveryContactName", "Shipping contact person"],
            ["deliveryContactPhone", "Shipping contact phone"],
            ["city", "City"],
            ["state", "State"],
            ["pincode", "Pincode"],
            ["country", "Country"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs">
            {label}
            <input
              required={["businessAddress", "deliveryAddress", "deliveryCity", "deliveryState", "deliveryPincode"].includes(key)}
              value={values[key] || ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm bg-white"
            />
          </label>
        ))}
      </div>
      <label className="block text-xs">
        Assigned Sales Executive
        <select
          value={values.assignedSalesExecutiveId || ""}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              assignedSalesExecutiveId: e.target.value,
            }))
          }
          className="mt-1 block w-full rounded border border-slate-300 p-2 bg-white"
        >
          <option value="">Unassigned</option>
          {executives
            .filter((x) => x)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.firstName} {x.lastName}
              </option>
            ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-slate-300 px-4 py-2"
        >
          Cancel
        </button>
        <button
          disabled={busy}
          className="rounded bg-[#9D174D] px-4 py-2 text-white"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
