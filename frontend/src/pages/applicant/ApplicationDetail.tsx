import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApplication, performTransition, deleteApplication } from "../../api/applications";
import StatusBadge from "../../components/StatusBadge";
import AuditLog from "../../components/AuditLog";
import { CATEGORY_LABELS } from "../../lib/constants";

export default function ApplicantApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: app, isLoading, isError } = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
  });

  const submitMutation = useMutation({
    mutationFn: () => performTransition(id!, "submit"),
    onSuccess: (updated) => {
      queryClient.setQueryData(["application", id], updated);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteApplication(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      navigate("/");
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError || !app) return <p className="text-sm text-destructive">Application not found.</p>;

  const isDraft = app.status === "DRAFT";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">My Applications</Link>
        <span>/</span>
        <span className="text-foreground truncate">{app.title}</span>
      </div>

      <div className="card p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground break-words">{app.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {CATEGORY_LABELS[app.category]} · {new Date(app.createdAt).toLocaleDateString()}
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

        {submitMutation.isError && (
          <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {(submitMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to submit."}
          </div>
        )}

        {isDraft && (
          <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
            <Link to={`/applications/${id}/edit`} className="btn-secondary">Edit</Link>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="btn-primary"
            >
              {submitMutation.isPending ? "Submitting…" : "Submit Application"}
            </button>
            <button
              onClick={() => { if (confirm("Delete this application?")) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
              className="sm:ml-auto btn-ghost text-destructive hover:text-destructive"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <AuditLog logs={app.auditLogs} />
    </div>
  );
}
