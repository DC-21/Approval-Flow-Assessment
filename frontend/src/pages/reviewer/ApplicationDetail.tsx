import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApplication, performTransition } from "../../api/applications";
import StatusBadge from "../../components/StatusBadge";
import AuditLog from "../../components/AuditLog";
import type { TransitionAction } from "../../types";
import { CATEGORY_LABELS } from "../../lib/constants";

function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "danger" | "warning";
}) {
  const cls = {
    primary: "btn-primary",
    danger: "btn-danger",
    warning: "inline-flex items-center justify-center px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-all",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex-1 sm:flex-none ${cls[variant]}`}>
      {label}
    </button>
  );
}

export default function ReviewerApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState("");

  const { data: app, isLoading, isError } = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ action, comment }: { action: TransitionAction; comment?: string }) =>
      performTransition(id!, action, comment),
    onSuccess: (updated) => {
      queryClient.setQueryData(["application", id], updated);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setComment("");
      setActionError("");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setActionError(err.response?.data?.error ?? "Action failed.");
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError || !app) return <p className="text-sm text-destructive">Application not found.</p>;

  const isUnderReview = app.status === "UNDER_REVIEW";
  const isSubmitted = app.status === "SUBMITTED";

  function doAction(action: TransitionAction) {
    const needsComment = action === "reject" || action === "return_for_changes";
    if (needsComment && !comment.trim()) {
      setActionError("A comment is required for this action.");
      return;
    }
    transitionMutation.mutate({ action, comment: comment.trim() || undefined });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/reviewer" className="hover:text-foreground">Queue</Link>
        <span>/</span>
        <span className="text-foreground truncate">{app.title}</span>
      </div>

      <div className="card p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground break-words">{app.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              By {app.applicant.name} · {CATEGORY_LABELS[app.category]} ·{" "}
              {new Date(app.createdAt).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        <div className="space-y-3 text-sm text-foreground">
          <p>{app.description}</p>
          {app.amount && (
            <p className="font-medium">Amount: ${Number(app.amount).toLocaleString()}</p>
          )}
        </div>

        {(isSubmitted || isUnderReview) && (
          <div className="mt-6 space-y-3">
            {actionError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {actionError}
              </div>
            )}
            <div>
              <label className="label">
                Comment{" "}
                <span className="text-muted-foreground font-normal">(required for reject / return)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="input-field resize-none"
                placeholder="Add a comment…"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {isSubmitted && (
                <ActionButton
                  label={transitionMutation.isPending ? "Starting…" : "Start Review"}
                  onClick={() => doAction("start_review")}
                  disabled={transitionMutation.isPending}
                  variant="primary"
                />
              )}
              {isUnderReview && (
                <>
                  <ActionButton label={transitionMutation.isPending ? "Approving…" : "Approve"} onClick={() => doAction("approve")} disabled={transitionMutation.isPending} variant="primary" />
                  <ActionButton label={transitionMutation.isPending ? "Rejecting…" : "Reject"} onClick={() => doAction("reject")} disabled={transitionMutation.isPending} variant="danger" />
                  <ActionButton label={transitionMutation.isPending ? "Returning…" : "Return for Changes"} onClick={() => doAction("return_for_changes")} disabled={transitionMutation.isPending} variant="warning" />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <AuditLog logs={app.auditLogs} />
    </div>
  );
}
