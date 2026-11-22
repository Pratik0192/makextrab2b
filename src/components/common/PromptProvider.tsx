"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type PromptOptions = { title: string; description?: string; initialValue?: string; required?: boolean; multiline?: boolean; confirmText?: string; variant?: "default" | "destructive" };
type Request = PromptOptions & { resolve: (value: string | null) => void };
const Context = createContext<((options: PromptOptions) => Promise<string | null>) | null>(null);
export function usePrompt() { const value = useContext(Context); if (!value) throw new Error("usePrompt must be used inside PromptProvider"); return value; }
export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null); const [value, setValue] = useState(""); const resolver = useRef<Request["resolve"] | null>(null);
  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>(resolve => { resolver.current = resolve; setValue(options.initialValue ?? ""); setRequest({ ...options, resolve }); }), []);
  const finish = (result: string | null) => { const resolve = resolver.current; resolver.current = null; setRequest(null); resolve?.(result); };
  return <Context.Provider value={prompt}>{children}<Dialog open={Boolean(request)} onOpenChange={open => { if (!open) finish(null); }}><DialogContent><DialogHeader><DialogTitle>{request?.title}</DialogTitle>{request?.description && <DialogDescription>{request.description}</DialogDescription>}</DialogHeader>{request?.multiline ? <textarea autoFocus value={value} onChange={e => setValue(e.target.value)} className="min-h-24 w-full rounded-md border bg-background p-2 text-sm" /> : <Input autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!request?.required || value.trim()) finish(value); } }} />}<DialogFooter><button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => finish(null)}>Cancel</button><button type="button" disabled={Boolean(request?.required && !value.trim())} className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 ${request?.variant === "destructive" ? "bg-destructive hover:bg-destructive/90" : "bg-primary"}`} onClick={() => finish(value)}>{request?.confirmText ?? "Continue"}</button></DialogFooter></DialogContent></Dialog></Context.Provider>;
}
