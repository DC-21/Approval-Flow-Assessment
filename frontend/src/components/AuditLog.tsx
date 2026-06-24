import type { AuditLogEntry, ApplicationStatus } from "../types";
import { STATUS_LABELS } from "../lib/constants";

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function AuditLog({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Audit Trail
      </h3>
      <ol className="relative border-l border-border space-y-4 pl-4">
        {[...logs].reverse().map((log) => (
          <li key={log.id} className="ml-2">
            <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-background bg-primary" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{log.actor.name}</span>
              {" — "}
              {log.fromStatus
                ? `${STATUS_LABELS[log.fromStatus as ApplicationStatus]} → ${STATUS_LABELS[log.toStatus]}`
                : `Created as ${STATUS_LABELS[log.toStatus]}`}
            </p>
            {log.comment && (
              <p className="text-sm text-muted-foreground mt-0.5 italic">"{log.comment}"</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{fmt(log.createdAt)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
