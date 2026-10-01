import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Authenticated } from "@/components/auth-gate";
import { CallActions } from "@/components/call-button";
import { PageHeader, LiveBadge } from "@/components/kpi";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ENQUIRY_STATUSES, LEAD_SOURCES, LIVE_POLL_MS, PURCHASE_MODES, VEHICLES } from "@/lib/crm/constants";
import { listEnquiries } from "@/lib/crm/enquiries";
import { formatDate, formatInr } from "@/lib/utils";

export const Route = createFileRoute("/enquiries")({ component: EnquiriesPage });

function EnquiriesPage() {
  return <Authenticated>{(session) => <Enquiries owner={session.profile.role === "owner"} staff={session.staff} />}</Authenticated>;
}

function Enquiries({
  owner,
  staff,
}: {
  owner: boolean;
  staff: { user_id: string; full_name: string }[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [staffId, setStaffId] = useState("");
  const [purchaseMode, setPurchaseMode] = useState("");
  const [leadSource, setLeadSource] = useState("");

  const filters = useMemo(
    () => ({ q, status, vehicle, staffId, purchaseMode, leadSource }),
    [q, status, vehicle, staffId, purchaseMode, leadSource],
  );

  const list = useQuery({
    queryKey: ["enquiries", filters],
    queryFn: () => listEnquiries({ data: filters }),
    refetchInterval: LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const rows = list.data ?? [];

  return (
    <div>
      <PageHeader
        title="Enquiries"
        subtitle={
          owner
            ? "Full customer book — staff saves, you see it here"
            : "Your enquiries, plus every customer who needs a follow-up today or is overdue"
        }
        actions={
          <div className="flex items-center gap-2">
            {owner ? <LiveBadge /> : null}
            <Button asChild>
              <Link to="/enquiry/new">New enquiry</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-6">
        <Input
          placeholder="Search name, mobile, village"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="col-span-2"
        />
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {ENQUIRY_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
          <option value="">All vehicles</option>
          {VEHICLES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={purchaseMode} onChange={(e) => setPurchaseMode(e.target.value)}>
          <option value="">All modes</option>
          {PURCHASE_MODES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {owner ? (
          <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.full_name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((e) => (
          <div key={e.id} className="flex items-stretch gap-2">
            <Link
              to="/enquiry/$id"
              params={{ id: e.id }}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{e.customer_name}</p>
                  <p className="text-xs text-muted">
                    {e.mobile} · {e.village || "—"}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {e.vehicle} · {e.purchase_mode}
              </p>
              <p className="mt-1 text-xs text-muted">
                Follow-up {formatDate(e.next_follow_up)}
                {e.is_demo ? " · Demo" : ""}
              </p>
            </Link>
            <div className="flex flex-col justify-center gap-2">
              <CallActions mobile={e.mobile} size="icon" />
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted">No matching enquiries.</p> : null}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Follow-up</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Call</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-line hover:bg-bg">
                <td className="px-4 py-3">
                  <Link to="/enquiry/$id" params={{ id: e.id }} className="font-medium text-ink">
                    {e.customer_name}
                  </Link>
                  <div className="text-xs text-muted">
                    {e.mobile}
                    {e.is_demo ? " · Demo" : ""}
                  </div>
                </td>
                <td className="px-4 py-3">{e.vehicle}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={e.status} />
                </td>
                <td className="px-4 py-3">{e.assigned_to_name ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{formatDate(e.next_follow_up)}</td>
                <td className="px-4 py-3 tabular-nums">{formatInr(e.estimated_value)}</td>
                <td className="px-4 py-3">
                  <CallActions mobile={e.mobile} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-sm text-muted">No matching enquiries.</p> : null}
      </div>
    </div>
  );
}
