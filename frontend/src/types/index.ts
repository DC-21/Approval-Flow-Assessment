export type Role = "APPLICANT" | "REVIEWER";

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type ApplicationCategory =
  | "BUDGET_REQUEST"
  | "LEAVE_REQUEST"
  | "EQUIPMENT_REQUEST"
  | "OTHER";

export type TransitionAction =
  | "submit"
  | "start_review"
  | "approve"
  | "reject"
  | "return_for_changes";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuditLogEntry {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  comment: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: Role };
}

export interface ApplicationSummary {
  id: string;
  title: string;
  category: ApplicationCategory;
  status: ApplicationStatus;
  amount: string | null;
  createdAt: string;
  updatedAt: string;
  applicant: { id: string; name: string; email: string };
}

export interface ApplicationDetail extends ApplicationSummary {
  description: string;
  auditLogs: AuditLogEntry[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
