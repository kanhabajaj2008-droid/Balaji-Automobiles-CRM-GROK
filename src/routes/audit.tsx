import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Authenticated } from "@/components/auth-gate";
import { PageHeader } from "@/components/kpi";
import { Input } from "@/components/ui/input";
import { listAudit } from "@/lib/crm/settings";
import { formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/audit")({ component: AuditPage });

function AuditPage() {
  return (
    <Authenticated ownerOnly>
      {() => <AuditLog />}
    </Authenticated>
  );
}

function AuditLog() {
  const [q, setQ] = useState("");
  const log = useQuery({
    queryKey: ["audit", q],
    queryFn: () => listAudit({ data: { q } }),
  });

  return (
    <div>
      <PageHeader title="Audit history" subtitle="Server-side log of logins, edits, assignments and exports" />
      <Input
        placeholder="Search action, person, details"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="space-y-2">
        {(log.data ?? []).map((row) => (
          <div key={row.id} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium capitalize">{row.action.replaceAll("_", " ")}</p>
              <p className="text-xs tabular-nums text-muted">{formatDateTime(row.created_at)}</p>
            </div>
            <p className="text-xs text-muted">
              {row.actor_name ?? "System"} · {row.entity}
              {row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ""}
            </p>
            {row.details ? <p className="mt-1 text-sm text-ink-soft">{row.details}</p> : null}
          </div>
        ))}
        {(log.data ?? []).length === 0 ? <p className="text-sm text-muted">No audit rows yet.</p> : null}
      </div>
    </div>
  );
}
