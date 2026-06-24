import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { Role } from "../generated/prisma/client";
import * as applicationService from "../services/application.service";
import type { TransitionAction, TransitionError } from "../services/stateMachine.service";

export async function list(req: AuthenticatedRequest, res: Response) {
  const { status, page, limit } = req.query as { status?: string; page?: string; limit?: string };
  const result = await applicationService.listApplications(
    req.user.userId,
    req.user.role as Role,
    status,
    page ? parseInt(page, 10) : 1,
    limit ? parseInt(limit, 10) : 10,
  );
  res.json(result);
}

export async function getOne(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string;
  const application = await applicationService.getApplication(id);

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (req.user.role === Role.APPLICANT && application.applicant.id !== req.user.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(application);
}

export async function create(req: AuthenticatedRequest, res: Response) {
  if (req.user.role !== Role.APPLICANT) {
    res.status(403).json({ error: "Only applicants can create applications" });
    return;
  }

  const application = await applicationService.createApplication(req.user.userId, req.body);
  res.status(201).json(application);
}

export async function update(req: AuthenticatedRequest, res: Response) {
  if (req.user.role !== Role.APPLICANT) {
    res.status(403).json({ error: "Only applicants can edit applications" });
    return;
  }

  const id = req.params.id as string;
  const existing = await applicationService.getApplication(id);

  if (!existing) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (existing.applicant.id !== req.user.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (existing.status !== "DRAFT") {
    res.status(422).json({ error: "Only DRAFT applications can be edited" });
    return;
  }

  const updated = await applicationService.updateApplication(id, req.body);
  res.json(updated);
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  if (req.user.role !== Role.APPLICANT) {
    res.status(403).json({ error: "Only applicants can delete applications" });
    return;
  }

  const id = req.params.id as string;
  const existing = await applicationService.getApplication(id);

  if (!existing) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (existing.applicant.id !== req.user.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (existing.status !== "DRAFT") {
    res.status(422).json({ error: "Only DRAFT applications can be deleted" });
    return;
  }

  await applicationService.deleteApplication(id);
  res.status(204).send();
}

export async function performTransition(req: AuthenticatedRequest, res: Response) {
  const { action, comment } = req.body as { action: TransitionAction; comment?: string };

  const result = await applicationService.transition({
    applicationId: req.params.id as string,
    action,
    actorId: req.user.userId,
    actorRole: req.user.role as Role,
    comment,
  });

  if ("notFound" in result) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if ("denied" in result) {
    const err = result.error as TransitionError;
    const statusCode =
      err.code === "ILLEGAL_TRANSITION" ? 422 :
      err.code === "COMMENT_REQUIRED" ? 400 : 403;
    res.status(statusCode).json({ error: err.message });
    return;
  }

  res.json(result.application);
}
