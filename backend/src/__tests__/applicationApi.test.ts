import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, beforeEach, it, expect, vi } from "vitest";
import { ApplicationStatus, Role } from "../generated/prisma/client";

const dbMock = vi.hoisted(() => ({
  application: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../db", () => ({ default: dbMock }));

import app from "../app";

describe("application API authorization", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("returns 403 when an applicant attempts a reviewer transition", async () => {
    dbMock.application.findUnique.mockResolvedValue({
      id: "app-1",
      status: ApplicationStatus.UNDER_REVIEW,
      applicantId: "applicant-1",
    });

    const token = jwt.sign(
      { userId: "applicant-1", email: "alice@test.com", role: Role.APPLICANT },
      process.env.JWT_SECRET!,
    );

    const response = await request(app)
      .post("/api/applications/app-1/transitions")
      .set("Cookie", [`token=${token}`])
      .send({ action: "approve" });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("cannot perform action 'approve'");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});
