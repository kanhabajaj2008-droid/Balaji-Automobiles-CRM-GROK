import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Authenticated } from "@/components/auth-gate";
import { PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DATE_PRESETS, ENQUIRY_STATUSES, LEAD_SOURCES, PURCHASE_MODES, VEHICLES, type DatePreset } from "@/lib/crm/constants";
import { rangeForPreset } from "@/lib/crm/dates";
import { runReport, type ReportKind, type ReportResult } from "@/lib/crm/reports";
import { downloadTextFile, toCsv } from "@/lib/utils";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

const KINDS: { id: ReportKind; label: string }[] = [
  { id: "enquiries", label: "Enquiry report" },
  { id: "sales", label: "Sales report" },
  { id: "staff", label: "Staff performance" },
  { id: "followups", label: "Follow-up report" },
  { id: "vehicle", label: "Vehicle-wise" },
  { id: "purchase", label: "Purchase mode" },
  { id: "lead", label: "Lead source" },
  { id: "conversion", label: "Conversion" },
  { id: "lost", label: "Lost customers" },
  { id: "pending", label: "Pending follow-ups" },
];

function ReportsPage() {
  return (
    <Authenticated ownerOnly>
      {(session) => <Reports staff={session.staff} />}
    </Authenticated>
  );
}

function Reports({ staff }: { staff: { user_id: string; full_name: string }[] }) {
  const [kind, setKind] = useState<ReportKind>("enquiries");
  const [preset, setPreset] = useState<DatePreset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [staffId, setStaffId] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [status, setStatus] = useState("");
  const [purchaseMode, setPurchaseMode] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);

  const range = useMemo(() => rangeForPreset(preset, from, to), [preset, from, to]);
  const payload = {
    kind,
    from: range.from,
    to: range.to,
    staffId: staffId || undefined,
    vehicle: vehicle || undefined,
    status: status || undefined,
    purchaseMode: purchaseMode || undefined,
    leadSource: leadSource || undefined,
  };

  const run = useMutation({
    mutationFn: (exp: boolean) => runReport({ data: { ...payload, export: exp } }),
    onSuccess: (res, exp) => {
      setResult(res);
      if (exp) {
        const csv = toCsv(res.columns, res.rows);
        downloadTextFile(`${res.title.replaceAll(" ", "-").toLowerCase()}.csv`, csv, "text/csv;charset=utf-8");
        toast.success("Export downloaded");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Owner-only. Staff cannot see showroom-wide numbers."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              Print / PDF
            </Button>
            <Button variant="outline" onClick={() => run.mutate(true)} disabled={run.isPending}>
              Export CSV
            </Button>
            <Button onClick={() => run.mutate(false)} disabled={run.isPending}>
              {run.isPending ? "Running…" : "Run report"}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`h-9 rounded-full px-3 text-xs font-semibold ${
              kind === k.id ? "bg-ink text-accent-fg" : "bg-surface ring-1 ring-line"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-6">
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)}>
          {DATE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {preset === "custom" ? (
          <>
            <input type="date" className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        ) : null}
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">All staff</option>
          {staff.map((s) => (
            <option key={s.user_id} value={s.user_id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
          <option value="">All vehicles</option>
          {VEHICLES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {ENQUIRY_STATUSES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={purchaseMode} onChange={(e) => setPurchaseMode(e.target.value)}>
          <option value="">All modes</option>
          {PURCHASE_MODES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-5">
          {result ? (
            <>
              <h2 className="font-display text-2xl">{result.title}</h2>
              <p className="mb-4 text-xs text-muted">
                {range.from} to {range.to} · {result.rows.length} rows
              </p>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c} className="border-b border-line pb-2 pr-4">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-line">
                      {row.map((cell, j) => (
                        <td key={j} className="py-2 pr-4 tabular-nums">
                          {cell == null ? "—" : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-sm text-muted">Choose a report and tap Run report.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
