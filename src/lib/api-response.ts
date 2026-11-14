import { NextResponse } from "next/server";
import type { ApiErrorResponse, ApiSuccess } from "@/types/api";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, { status });
}

export function apiError(status: number, code: string, message: string, details?: Record<string, string>, field?: string) {
  const error: ApiErrorResponse = { success: false, error: { code, message, ...(field ? { field } : {}), ...(details ? { details } : {}) } };
  return NextResponse.json(error, { status });
}

export function apiFailure(error: unknown) {
  if (error instanceof Error && error.message === "UNIQUE_CONFLICT") {
    return apiError(409, "CONFLICT", "A record with these details already exists.");
  }
  return apiError(500, "INTERNAL_ERROR", "The request could not be completed.");
}
