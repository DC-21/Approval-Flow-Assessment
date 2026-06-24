import { ApplicationStatus, Role } from "../generated/prisma/client";

export type TransitionAction =
  | "submit"
  | "start_review"
  | "approve"
  | "reject"
  | "return_for_changes";

interface TransitionRule {
  from: ApplicationStatus;
  to: ApplicationStatus;
  allowedRoles: Role[];
  requiresComment: boolean;
  ownerOnly: boolean;
}

const TRANSITIONS: Record<TransitionAction, TransitionRule> = {
  submit: {
    from: ApplicationStatus.DRAFT,
    to: ApplicationStatus.SUBMITTED,
    allowedRoles: [Role.APPLICANT],
    requiresComment: false,
    ownerOnly: true,
  },
  start_review: {
    from: ApplicationStatus.SUBMITTED,
    to: ApplicationStatus.UNDER_REVIEW,
    allowedRoles: [Role.REVIEWER],
    requiresComment: false,
    ownerOnly: false,
  },
  approve: {
    from: ApplicationStatus.UNDER_REVIEW,
    to: ApplicationStatus.APPROVED,
    allowedRoles: [Role.REVIEWER],
    requiresComment: false,
    ownerOnly: false,
  },
  reject: {
    from: ApplicationStatus.UNDER_REVIEW,
    to: ApplicationStatus.REJECTED,
    allowedRoles: [Role.REVIEWER],
    requiresComment: true,
    ownerOnly: false,
  },
  return_for_changes: {
    from: ApplicationStatus.UNDER_REVIEW,
    to: ApplicationStatus.DRAFT,
    allowedRoles: [Role.REVIEWER],
    requiresComment: true,
    ownerOnly: false,
  },
};

export type TransitionErrorCode = "ILLEGAL_TRANSITION" | "FORBIDDEN" | "COMMENT_REQUIRED";

export interface TransitionError {
  code: TransitionErrorCode;
  message: string;
}

export type TransitionResult =
  | { ok: true; toStatus: ApplicationStatus }
  | { ok: false; error: TransitionError };

export function applyTransition(params: {
  action: TransitionAction;
  currentStatus: ApplicationStatus;
  actorRole: Role;
  isOwner: boolean;
  comment?: string;
}): TransitionResult {
  const { action, currentStatus, actorRole, isOwner, comment } = params;
  const rule = TRANSITIONS[action];

  if (currentStatus !== rule.from) {
    return {
      ok: false,
      error: {
        code: "ILLEGAL_TRANSITION",
        message: `Cannot '${action}' from status ${currentStatus}. Expected ${rule.from}.`,
      },
    };
  }

  if (!rule.allowedRoles.includes(actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: `Role ${actorRole} cannot perform action '${action}'.`,
      },
    };
  }

  if (rule.ownerOnly && !isOwner) {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "Only the application owner can perform this action." },
    };
  }

  if (rule.requiresComment && !comment?.trim()) {
    return {
      ok: false,
      error: { code: "COMMENT_REQUIRED", message: `A comment is required to '${action}'.` },
    };
  }

  return { ok: true, toStatus: rule.to };
}
