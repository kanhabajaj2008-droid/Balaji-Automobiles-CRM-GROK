import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Authenticated } from "@/components/auth-gate";
import { FollowUpList } from "@/components/follow-up-list";
import { Kpi, LiveBadge, PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DATE_PRESETS, LIVE_POLL_MS, type DatePreset } from "@/lib/crm/constants";
import { getDashboard } from "@/lib/crm/dashboard";
import { rangeForPreset } from "@/lib/crm/dates";
import { formatInr } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function Home() {
  return <Authenticated>{(session) => <Dashboard owner={session.profile.role === "owner"} />}</Authenticated>;
}

function Dashboard({ owner }: { owner: boolean }) {
  const [preset, setPreset] = useState<DatePreset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => rangeForPreset(preset, from, to), [preset, from, to]);

  const dash = useQuery({
    queryKey: ["dashboard", range.from, range.to],
    queryFn: () => getDashboard({ data: range }),
    refetchInterval: LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const data = dash.data;
  const stats = data?.stats;

  return (
    <div>
      <PageHeader
        title={owner ? "Showroom dashboard" : "My dashboard"}
        subtitle={
          owner
            ? "Every enquiry across the floor — appears here as soon as staff save it"
            : "Only the customers assigned to you"
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

      <div className="mb-5 flex flex-wrap gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`h-9 rounded-full px-3 text-xs font-semibold ${
              preset === p.id ? "bg-ink text-accent-fg" : "bg-surface text-ink-soft ring-1 ring-line"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="mb-5 flex gap-2">
          <input
            type="date"
            className="h-11 rounded-md border border-line bg-surface px-3 text-sm"
            value={from || range.from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="h-11 rounded-md border border-line bg-surface px-3 text-sm"
            value={to || range.to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={owner ? "Total enquiries" : "My enquiries"} value={stats?.total ?? "—"} />
        <Kpi label="New" value={stats?.neu ?? "—"} />
        <Kpi label="Today's follow-ups" value={stats?.todayFollowUps ?? "—"} />
        <Kpi label="Overdue" value={stats?.overdueFollowUps ?? "—"} tone="warn" />
        <Kpi label="Sold" value={stats?.sold ?? "—"} tone="good" />
        <Kpi label="Lost" value={stats?.lost ?? "—"} tone="bad" />
        {owner ? <Kpi label="Conversion" value={`${stats?.conversionRate ?? 0}%`} /> : null}
        {owner ? <Kpi label="Sold value" value={formatInr(stats?.soldValue ?? 0)} hint="In selected range" /> : null}
      </div>

      {owner && data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Enquiries & sales by month</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="enquiries" fill="var(--color-chart-2)" radius={4} />
                  <Bar dataKey="sold" fill="var(--color-chart-1)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By vehicle</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byVehicle.slice(0, 8)} layout="vertical" margin={{ left: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-chart-1)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Purchase mode</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byPurchaseMode} dataKey="count" nameKey="name" innerRadius={48} outerRadius={80}>
                    {data.byPurchaseMode.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lead source</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byLeadSource} dataKey="count" nameKey="name" innerRadius={48} outerRadius={80}>
                    {data.byLeadSource.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {owner && data?.staffPerformance.length ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Staff performance</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2">Staff</th>
                  <th className="pb-2">Enquiries</th>
                  <th className="pb-2">Sold</th>
                  <th className="pb-2">Lost</th>
                  <th className="pb-2">Pending</th>
                  <th className="pb-2">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.staffPerformance.map((s) => (
                  <tr key={s.user_id} className="border-t border-line">
                    <td className="py-2 font-medium">{s.full_name}</td>
                    <td className="py-2 tabular-nums">{s.total}</td>
                    <td className="py-2 tabular-nums">{s.sold}</td>
                    <td className="py-2 tabular-nums">{s.lost}</td>
                    <td className="py-2 tabular-nums">{s.pendingFollowUps}</td>
                    <td className="py-2 tabular-nums">{s.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowUpList items={data?.todayFollowUps ?? []} empty="No follow-ups due today." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowUpList items={data?.overdueFollowUps ?? []} empty="Nothing overdue." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
