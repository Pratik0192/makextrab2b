import api from "@/lib/axios";
import type { ApiSuccess, PaginatedData } from "@/types/api";
import type { CreateLeadRequest, LeadDetail, LeadListItem, LeadSource, LeadStage } from "@/types/lead";

export async function createLead(data: CreateLeadRequest, gstCertificate?: File | null) {
  type CreateLeadResponse = { success: true; message: string; data: { leadId: string; referenceNumber: string } };
  const formData = new FormData();
  formData.append("payload", JSON.stringify(data));
  if (gstCertificate instanceof File) formData.append("gstCertificate", gstCertificate);
  const response = await fetch(api.getUri({ url: "/api/leads" }), {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const result = await response.json() as CreateLeadResponse | { success: false; error: { message: string; code?: string; details?: Record<string, string>; field?: string } };
  if (!response.ok) {
    const failure = new Error("Enquiry submission failed.") as Error & { response?: { data: unknown } };
    failure.response = { data: result };
    throw failure;
  }
  return result as CreateLeadResponse;
}

export async function getAdminLeads(params: {
  page: number;
  pageSize: number;
  search: string;
  source: LeadSource | "";
  stage: LeadStage | "";
  from: string;
  to: string;
  assignedToId?: string;
  assignmentStatus?: string;
  priority?: string;
  [key: string]: string | number | undefined;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== "") query.set(key, String(value));
  const response = await api.get<ApiSuccess<PaginatedData<LeadListItem>>>(`/api/admin/leads?${query}`);
  return response.data.data;
}

export async function getAdminLead(id: string) {
  const response = await api.get<ApiSuccess<LeadDetail>>(`/api/admin/leads/${encodeURIComponent(id)}`);
  return response.data.data;
}
