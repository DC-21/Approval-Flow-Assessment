import { describe, it, expect } from "vitest";
import { applyTransition } from "../stateMachine.service";
import { ApplicationStatus, Role } from "../../generated/prisma/client";

const APPLICANT = Role.APPLICANT;
const REVIEWER = Role.REVIEWER;

describe("applyTransition", () => {
  describe("submit", () => {
    it("allows applicant owner to submit a DRAFT", () => {
      const result = applyTransition({
        action: "submit",
        currentStatus: ApplicationStatus.DRAFT,
        actorRole: APPLICANT,
        isOwner: true,
      });
      expect(result).toEqual({ ok: true, toStatus: ApplicationStatus.SUBMITTED });
    });

    it("rejects submit if not the owner", () => {
      const result = applyTransition({
        action: "submit",
        currentStatus: ApplicationStatus.DRAFT,
        actorRole: APPLICANT,
        isOwner: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });

    it("rejects submit from a reviewer", () => {
      const result = applyTransition({
        action: "submit",
        currentStatus: ApplicationStatus.DRAFT,
        actorRole: REVIEWER,
        isOwner: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });

    it("rejects submit from wrong status", () => {
      const result = applyTransition({
        action: "submit",
        currentStatus: ApplicationStatus.SUBMITTED,
        actorRole: APPLICANT,
        isOwner: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("ILLEGAL_TRANSITION");
    });
  });

  describe("start_review", () => {
    it("allows reviewer to start review on SUBMITTED", () => {
      const result = applyTransition({
        action: "start_review",
        currentStatus: ApplicationStatus.SUBMITTED,
        actorRole: REVIEWER,
        isOwner: false,
      });
      expect(result).toEqual({ ok: true, toStatus: ApplicationStatus.UNDER_REVIEW });
    });

    it("rejects applicant starting a review", () => {
      const result = applyTransition({
        action: "start_review",
        currentStatus: ApplicationStatus.SUBMITTED,
        actorRole: APPLICANT,
        isOwner: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });

  describe("approve", () => {
    it("allows reviewer to approve UNDER_REVIEW", () => {
      const result = applyTransition({
        action: "approve",
        currentStatus: ApplicationStatus.UNDER_REVIEW,
        actorRole: REVIEWER,
        isOwner: false,
      });
      expect(result).toEqual({ ok: true, toStatus: ApplicationStatus.APPROVED });
    });

    it("rejects approve from SUBMITTED (must be UNDER_REVIEW first)", () => {
      const result = applyTransition({
        action: "approve",
        currentStatus: ApplicationStatus.SUBMITTED,
        actorRole: REVIEWER,
        isOwner: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("ILLEGAL_TRANSITION");
    });
  });

  describe("reject", () => {
    it("allows reviewer to reject with a comment", () => {
      const result = applyTransition({
        action: "reject",
        currentStatus: ApplicationStatus.UNDER_REVIEW,
        actorRole: REVIEWER,
        isOwner: false,
        comment: "Does not meet criteria",
      });
      expect(result).toEqual({ ok: true, toStatus: ApplicationStatus.REJECTED });
    });

    it("requires a comment to reject", () => {
      const result = applyTransition({
        action: "reject",
        currentStatus: ApplicationStatus.UNDER_REVIEW,
        actorRole: REVIEWER,
        isOwner: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("COMMENT_REQUIRED");
    });

    it("rejects applicant rejecting their own application", () => {
      const result = applyTransition({
        action: "reject",
        currentStatus: ApplicationStatus.UNDER_REVIEW,
        actorRole: APPLICANT,
        isOwner: true,
        comment: "I changed my mind",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  });

  describe("return_for_changes", () => {
    it("allows reviewer to return with a comment", () => {
      const result = applyTransition({
        action: "return_for_changes",
        currentStatus: ApplicationStatus.UNDER_REVIEW,
        actorRole: REVIEWER,
        isOwner: false,
        comment: "Please add more details",
      });
      expect(result).toEqual({ ok: true, toStatus: ApplicationStatus.DRAFT });
    });

    it("requires a comment to return for changes", () => {
      const result = applyTransition({
        action: "return_for_changes",
        currentStatus: ApplicationStatus.UNDER_REVIEW,
        actorRole: REVIEWER,
        isOwner: false,
        comment: "   ",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("COMMENT_REQUIRED");
    });
  });
});
