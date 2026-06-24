import api from "./client";
import type {
  ApplicationDetail,
  ApplicationSummary,
  ApplicationCategory,
  TransitionAction,
  PaginatedResponse,
} from "../types";

export async function listApplications(status?: string, page = 1, limit = 10) {
  const params: Record<string, string | number> = { page, limit };
  if (status) params.status = status;
  const { data } = await api.get<PaginatedResponse<ApplicationSummary>>("/applications", { params });
  return data;
}

export async function getApplication(id: string) {
  const { data } = await api.get<ApplicationDetail>(`/applications/${id}`);
  return data;
}

export interface ApplicationPayload {
  title: string;
  category: ApplicationCategory;
  description: string;
  amount?: number;
}

export async function createApplication(payload: ApplicationPayload) {
  const { data } = await api.post<ApplicationDetail>("/applications", payload);
  return data;
}

export async function updateApplication(id: string, payload: ApplicationPayload) {
  const { data } = await api.put<ApplicationDetail>(`/applications/${id}`, payload);
  return data;
}

export async function deleteApplication(id: string) {
  await api.delete(`/applications/${id}`);
}

export async function performTransition(
  id: string,
  action: TransitionAction,
  comment?: string
) {
  const { data } = await api.post<ApplicationDetail>(`/applications/${id}/transitions`, {
    action,
    comment,
  });
  return data;
}
