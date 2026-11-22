"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import api from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AuthApiError, LoginRequest, LoginResponse } from "@/types/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginModal({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail) || !password) {
      setErrorMessage("Enter a valid email address and password.");
      return;
    }

    const credentials: LoginRequest = { email: normalizedEmail, password };
    setLoading(true);
    try {
      const result = await api.post<LoginResponse>("/api/auth/login", credentials);
      setOpen(false);
      setPassword("");
      router.replace(result.data.user.role === "SALES_EXECUTIVE" ? "/sales" : "/admin");
      router.refresh();
    } catch (error: unknown) {
      if (axios.isAxiosError<AuthApiError>(error)) {
        setErrorMessage(error.response?.data?.error ?? "Unable to sign in. Please try again.");
      } else {
        setErrorMessage("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) setErrorMessage("");
  }}>
    <DialogTrigger asChild>
      <button type="button" className={className ?? "inline-flex items-center justify-center rounded-sm border border-[#9D174D] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.13em] text-[#9D174D] transition hover:bg-[#9D174D] hover:text-white"}>
        Login
      </button>
    </DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[430px] overflow-y-auto rounded-lg border-[#eadfd7] bg-[#fbf9f5] p-6 shadow-2xl sm:p-9">
      <DialogHeader className="text-left">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[.27em] text-[#9a7547]">Nextra Wholesale</p>
        <DialogTitle className="font-serif text-3xl font-normal text-[#3f2929]">Admin sign in</DialogTitle>
        <DialogDescription className="pt-1 text-xs leading-5 text-[#827572]">Sign in to the Nextra Wholesale business workspace.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="mt-3 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="admin-login-email" className="text-xs font-medium text-[#554544]">Email address</label>
          <input id="admin-login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-11 w-full rounded-md border border-[#e4d9d1] bg-white px-3 text-sm text-[#342424] outline-none transition placeholder:text-[#b0a5a0] focus:border-[#8e5b5c] focus:ring-2 focus:ring-[#8e5b5c]/15" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="admin-login-password" className="text-xs font-medium text-[#554544]">Password</label>
          <div className="relative">
            <input id="admin-login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-md border border-[#e4d9d1] bg-white px-3 pr-11 text-sm text-[#342424] outline-none transition focus:border-[#8e5b5c] focus:ring-2 focus:ring-[#8e5b5c]/15" />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#8a7a75] hover:text-[#9D174D]">
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        {errorMessage && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-800">{errorMessage}</p>}
        <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#9D174D] text-xs font-semibold uppercase tracking-[.12em] text-white transition hover:bg-[#6b3b3d] disabled:cursor-not-allowed disabled:opacity-65">
          {loading && <LoaderCircle size={16} className="animate-spin" />}{loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-[10px] text-[#978984]">Authorized staff access</p>
      </form>
    </DialogContent>
  </Dialog>;
}
