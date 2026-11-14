import axios from "axios";
import type { ApiErrorResponse } from "@/types/api";

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<unknown>(error)) return fallback;
  const data = error.response?.data;
  if (typeof data !== "object" || data === null || !("error" in data)) return fallback;
  const value = data.error;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "message" in value && typeof value.message === "string") {
    return value.message;
  }
  return (data as ApiErrorResponse).error.message ?? fallback;
}
