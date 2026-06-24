import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listApplications } from "../../api/applications";
import StatusBadge from "../../components/StatusBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ApplicationStatus } from "../../types";
import { CATEGORY_LABELS, PAGE_LIMIT } from "../../lib/constants";

const TABS = [
  { label: "All", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function ReviewerQueue() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  function handleTabChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["applications", statusFilter, page],
    queryFn: () => listApplications(statusFilter || undefined, page, PAGE_LIMIT),
  });

  const applications = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  return (
    <div>
      <h1 className="page-title">Application Queue</h1>

      <Tabs value={statusFilter} onValueChange={handleTabChange} className="mb-4">
        <TabsList className="w-full overflow-x-auto flex-nowrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-shrink-0">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}
      {isError && <p className="text-sm text-destructive py-8 text-center">Failed to load queue.</p>}

      {!isLoading && !isError && applications.length === 0 && (
        <p className="text-center py-16 text-muted-foreground">No applications found.</p>
      )}

      {!isLoading && !isError && applications.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium text-foreground">{app.title}</TableCell>
                    <TableCell className="text-muted-foreground">{app.applicant.name}</TableCell>
                    <TableCell className="text-muted-foreground">{CATEGORY_LABELS[app.category]}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(app.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status as ApplicationStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/reviewer/applications/${app.id}`}
                        className="btn-ghost py-1 text-xs"
                      >
                        {app.status === "SUBMITTED" ? "Review" : "View"}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {applications.map((app) => (
              <Link
                key={app.id}
                to={`/reviewer/applications/${app.id}`}
                className="flex items-start justify-between card px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-medium text-foreground truncate">{app.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.applicant.name} · {new Date(app.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={app.status as ApplicationStatus} />
              </Link>
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
