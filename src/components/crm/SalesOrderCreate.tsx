"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { toast } from "sonner";

type Customer = {
  id: string;
  customerCode: string;
  businessName: string;
  buyerName: string;
  mobile: string;
};
type Product = {
  id: string;
  name: string;
  sku: string;
  minimumOrderQuantity: number;
  wholesalePrice: string | null;
};
type Line = {
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

export default function SalesOrderCreate({ isAdmin }: { isAdmin: boolean }) {
  const base = usePathname().startsWith("/sales") ? "/sales" : "/admin";
  const router = useRouter();
  const search = useSearchParams();
  const initialCustomerId = search.get("customerId") ?? "";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [lines, setLines] = useState<Line[]>([
    { productId: "", quantity: "", unitPrice: "", discount: "0" },
  ]);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(
        `/api/sales-orders/options${initialCustomerId ? `?customerId=${encodeURIComponent(initialCustomerId)}` : ""}`,
      )
      .then((response) => {
        setCustomers(response.data.customers);
        setProducts(response.data.products);
        if (
          initialCustomerId &&
          !response.data.customers.some(
            (customer: Customer) => customer.id === initialCustomerId,
          )
        )
          setError(
            "This customer is not available to your account or is inactive.",
          );
      })
      .catch((e) =>
        setError(
          e.response?.data?.error || "Unable to load customers and products.",
        ),
      );
  }, [initialCustomerId]);

  const selectedProducts = useMemo(
    () => new Set(lines.map((line) => line.productId).filter(Boolean)),
    [lines],
  );
  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    setLines((current) =>
      current.map((line, at) =>
        at === index
          ? { ...line, productId, unitPrice: product?.wholesalePrice ?? "" }
          : line,
      ),
    );
  }
  function changeLine(index: number, field: keyof Line, value: string) {
    setLines((current) =>
      current.map((line, at) =>
        at === index ? { ...line, [field]: value } : line,
      ),
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/api/sales-orders", {
        customerId,
        items: lines.map((line) => ({
          ...line,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discount: Number(line.discount),
        })),
        discountAmount: Number(discountAmount),
        notes,
      });
      toast.success("Sales order created. Submit it for approval when ready.");
      router.push(`${base}/orders/${response.data.order.id}`);
    } catch (error: unknown) {
      const responseError =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: { error?: unknown } } }).response
              ?.data?.error
          : undefined;
      const message =
        typeof responseError === "string"
          ? responseError
          : "Could not create sales order.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const total =
    lines.reduce(
      (sum, line) =>
        sum +
        Math.max(0, Number(line.quantity) || 0) *
          Math.max(0, Number(line.unitPrice) || 0) -
        Math.max(0, Number(line.discount) || 0),
      0,
    ) - Math.max(0, Number(discountAmount) || 0);
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mx-auto max-w-5xl space-y-5"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <a
            className="text-sm text-[#9D174D] underline"
            href={`${base}/orders`}
          >
            Sales Orders
          </a>
          <h2 className="mt-1 text-2xl font-semibold">Create Sales Order</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a draft directly for an active customer. Stock is checked and
            reserved during approval.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-[#9D174D] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create draft order"}
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <section className="rounded-lg border bg-white p-5">
        <label className="block text-sm font-medium">
          Customer
          <select
            required
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="mt-1 block w-full rounded border p-2 bg-white"
          >
            <option value="">Select an active customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customerCode} · {customer.businessName} —{" "}
                {customer.buyerName}, {customer.mobile}
              </option>
            ))}
          </select>
        </label>
        {customers.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">
            No active customers are available for this account.
          </p>
        )}
      </section>
      <section className="space-y-3 rounded-lg border bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Products and pricing</h3>
          <button
            type="button"
            onClick={() =>
              setLines((current) => [
                ...current,
                { productId: "", quantity: "", unitPrice: "", discount: "0" },
              ])
            }
            className="rounded border px-3 py-1.5 text-sm"
          >
            Add product
          </button>
        </div>
        {lines.map((line, index) => {
          const product = products.find((item) => item.id === line.productId);
          return (
            <div
              key={index}
              className="grid gap-3 border-t pt-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
            >
              <label className="text-xs text-slate-600">
                Product
                <select
                  required
                  value={line.productId}
                  onChange={(event) => selectProduct(index, event.target.value)}
                  className="mt-1 block w-full rounded border bg-white p-2 text-sm"
                >
                  <option value="">Select product</option>
                  {products
                    .filter(
                      (item) =>
                        !selectedProducts.has(item.id) ||
                        item.id === line.productId,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.sku} (MOQ{" "}
                        {item.minimumOrderQuantity})
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Quantity
                <input
                  required
                  type="number"
                  min={product?.minimumOrderQuantity ?? 1}
                  step="1"
                  value={line.quantity}
                  onChange={(event) =>
                    changeLine(index, "quantity", event.target.value)
                  }
                  className="mt-1 block w-full rounded border p-2 text-sm bg-white"
                />
              </label>
              <label className="text-xs text-slate-600">
                Unit price
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  readOnly={!isAdmin}
                  value={line.unitPrice}
                  onChange={(event) =>
                    changeLine(index, "unitPrice", event.target.value)
                  }
                  className="mt-1 block w-full rounded border p-2 text-sm read-only:bg-slate-50 bg-white"
                />
              </label>
              <label className="text-xs text-slate-600">
                Line discount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.discount}
                  onChange={(event) =>
                    changeLine(index, "discount", event.target.value)
                  }
                  className="mt-1 block w-full rounded border p-2 text-sm bg-white"
                />
              </label>
              <button
                type="button"
                disabled={lines.length === 1}
                onClick={() =>
                  setLines((current) => current.filter((_, at) => at !== index))
                }
                className="self-end rounded border px-3 py-2 text-sm disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="text-sm text-slate-500">
            No active products available.
          </p>
        )}
        <label className="block max-w-sm text-xs text-slate-600">
          Additional order discount
          <input
            type="number"
            min="0"
            step="0.01"
            value={discountAmount}
            onChange={(event) => setDiscountAmount(event.target.value)}
            className="mt-1 block w-full rounded border p-2 text-sm bg-white"
          />
        </label>
        <p className="border-t pt-3 text-right text-lg font-semibold">
          Draft subtotal ₹
          {Math.max(0, total).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="text-xs text-slate-500">
          GST is calculated from current tax configuration when invoicing.
          Product availability is validated before approval and reservation.
        </p>
      </section>
      <section className="rounded-lg border bg-white p-5">
        <label className="block text-sm font-medium">
          Order notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={3}
            className="mt-1 block w-full rounded border p-2 bg-white"
          />
        </label>
      </section>
    </form>
  );
}
