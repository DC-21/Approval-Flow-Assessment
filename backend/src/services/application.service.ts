import db from "../db";
import { ApplicationStatus, Role } from "../generated/prisma/client";
import { applyTransition, TransitionAction } from "./stateMachine.service";

const APPLICATION_SELECT = {
  id: true,
  title: true,
  category: true,
  description: true,
  amount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  applicant: { select: { id: true, name: true, email: true } },
  auditLogs: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      comment: true,
      createdAt: true,
      actor: { select: { id: true, name: true, role: true } },
    },
  },
};

const LIST_SELECT = {
  id: true,
  title: true,
  category: true,
  status: true,
  amount: true,
  createdAt: true,
  updatedAt: true,
  applicant: { select: { id: true, name: true, email: true } },
};

export async function listApplications(
  actorId: string,
  actorRole: Role,
  statusFilter?: string,
  page = 1,
  limit = 10,
) {
  const where: Record<string, unknown> = {};

  if (actorRole === Role.APPLICANT) {
    where.applicantId = actorId;
  } else {
    where.status = { not: ApplicationStatus.DRAFT };
  }

  if (statusFilter) {
    const upper = statusFilter.toUpperCase();
    if (
      Object.values(ApplicationStatus).includes(upper as ApplicationStatus) &&
      !(actorRole === Role.REVIEWER && upper === ApplicationStatus.DRAFT)
    ) {
      where.status = upper as ApplicationStatus;
    }
  }

  const skip = (page - 1) * limit;
  const [items, total] = await db.$transaction([
    db.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: LIST_SELECT,
      skip,
      take: limit,
    }),
    db.application.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getApplication(id: string) {
  return db.application.findUnique({ where: { id }, select: APPLICATION_SELECT });
}

export interface CreateApplicationDto {
  title: string;
  category: "BUDGET_REQUEST" | "LEAVE_REQUEST" | "EQUIPMENT_REQUEST" | "OTHER";
  description: string;
  amount?: number;
}

export async function createApplication(applicantId: string, dto: CreateApplicationDto) {
  const application = await db.application.create({
    data: { ...dto, applicantId },
    select: APPLICATION_SELECT,
  });

  await db.auditLog.create({
    data: {
      applicationId: application.id,
      actorId: applicantId,
      fromStatus: null,
      toStatus: ApplicationStatus.DRAFT,
    },
  });

  return application;
}

export async function updateApplication(id: string, dto: CreateApplicationDto) {
  return db.application.update({
    where: { id },
    data: dto,
    select: APPLICATION_SELECT,
  });
}

export async function deleteApplication(id: string) {
  await db.auditLog.deleteMany({ where: { applicationId: id } });
  await db.application.delete({ where: { id } });
}

export async function transition(params: {
  applicationId: string;
  action: TransitionAction;
  actorId: string;
  actorRole: Role;
  comment?: string;
}) {
  const { applicationId, action, actorId, actorRole, comment } = params;

  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, applicantId: true },
  });

  if (!application) return { notFound: true } as const;

  const isOwner = application.applicantId === actorId;
  const result = applyTransition({ action, currentStatus: application.status, actorRole, isOwner, comment });

  if (!result.ok) return { denied: true, error: result.error } as const;

  const [updated] = await db.$transaction([
    db.application.update({
      where: { id: applicationId },
      data: { status: result.toStatus },
      select: APPLICATION_SELECT,
    }),
    db.auditLog.create({
      data: {
        applicationId,
        actorId,
        fromStatus: application.status,
        toStatus: result.toStatus,
        comment: comment?.trim() || null,
      },
    }),
  ]);

  return { ok: true, application: updated } as const;
}
