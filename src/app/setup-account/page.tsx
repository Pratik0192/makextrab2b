"use client";
import { useState } from "react";
import { useEffect } from "react";
import api from "@/lib/axios";
export default function SetupAccountPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await api.post("/api/auth/activate-sales-executive", { token, password });
      setDone(true);
      setMessage("Your account is ready. You can now sign in.");
    } catch (error) {
      setMessage(
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error ?? "Account setup failed.",
      );
    }
  }
  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl border bg-white p-8">
      <h1 className="text-xl font-semibold text-[#9D174D]">
        Set up your Sales Executive account
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Choose a password with at least 12 characters.
      </p>
      {!done && (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input
            type="password"
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded border px-3 bg-white text-gray-700"
            autoComplete="new-password"
          />
          <button className="rounded bg-[#9D174D] px-4 py-2 text-white">
            Set password
          </button>
        </form>
      )}
      <p role="status" className="mt-4 text-sm text-[#9D174D]">
        {message}
      </p>
    </main>
  );
}
