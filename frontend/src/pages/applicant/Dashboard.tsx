import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { listApplications, deleteApplication } from "../../api/applications";
import StatusBadge from "../../components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS, PAGE_LIMIT } from "../../lib/constants";

export default function ApplicantDashboard() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["applications", page],
    queryFn: () => listApplications(undefined, page, PAGE_LIMIT),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const applications = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  function handleDelete(id: string) {
    if (confirm("Delete this application?")) deleteMutation.mutate(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">My Applications</h1>
        <Link to="/applications/new" className="btn-primary">
          New Application
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load applications.</p>}

      {!isLoading && !isError && applications.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base">No applications yet.</p>
          <Link to="/applications/new" className="text-primary text-sm mt-2 inline-block">
            Create your first one →
          </Link>
        </div>
      )}

      {!isLoading && !isError && applications.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium text-foreground">{app.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {CATEGORY_LABELS[app.category]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.amount ? `$${Number(app.amount).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(app.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/applications/${app.id}`)}
                          className="btn-ghost py-1 text-xs"
                        >
                          View
                        </button>
                        {app.status === "DRAFT" && (
                          <>
                            <button
                              onClick={() => navigate(`/applications/${app.id}/edit`)}
                              className="btn-ghost py-1 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(app.id)}
                              disabled={deleteMutation.isPending}
                              className="btn-ghost py-1 text-xs text-destructive hover:text-destructive"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {applications.map((app) => (
              <div key={app.id} className="card px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-foreground truncate">{app.title}</p>
                  <StatusBadge status={app.status} />
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {CATEGORY_LABELS[app.category]} · {new Date(app.updatedAt).toLocaleDateString()}
                  {app.amount ? ` · $${Number(app.amount).toLocaleString()}` : ""}
                </p>
                <div className="flex gap-2">
                  <Link to={`/applications/${app.id}`} className="btn-ghost py-1 text-xs">
                    View
                  </Link>
                  {app.status === "DRAFT" && (
                    <>
                      <Link to={`/applications/${app.id}/edit`} className="btn-ghost py-1 text-xs">
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="btn-ghost py-1 text-xs text-destructive hover:text-destructive"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{start}–{end} of {total}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary px-3 py-1.5 disabled:opacity-40">
                  Previous
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} className="btn-secondary px-3 py-1.5 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
