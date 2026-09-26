import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Authenticated } from "@/components/auth-gate";
import { CallActions } from "@/components/call-button";
import { EnquiryForm } from "@/components/enquiry-form";
import { PageHeader } from "@/components/kpi";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { FOLLOW_UP_STATUSES, LIVE_POLL_MS } from "@/lib/crm/constants";
import {
  assignEnquiry,
  deleteEnquiry,
  getEnquiry,
  updateEnquiryStatus,
} from "@/lib/crm/enquiries";
import { addFollowUp } from "@/lib/crm/followups";
import type { SessionInfo } from "@/lib/crm/types";
import { formatDate, formatDateTime, formatInr, telHref, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/enquiry/$id")({ component: EnquiryDetailPage });

function EnquiryDetailPage() {
  const { id } = Route.useParams();
  return (
    <Authenticated>
      {(session) => <Detail id={id} session={session} />}
    </Authenticated>
  );
}

function Detail({ id, session }: { id: string; session: SessionInfo }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const owner = session.profile.role === "owner";

  const q = useQuery({
    queryKey: ["enquiry", id],
    queryFn: () => getEnquiry({ data: { id } }),
    refetchInterval: LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const del = useMutation({
    mutationFn: () => deleteEnquiry({ data: { id } }),
    onSuccess: () => {
      toast.success("Enquiry deleted");
      navigate({ to: "/enquiries" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <div className="h-64 animate-pulse rounded-xl bg-surface-2" />;
  if (q.isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="font-medium">Enquiry not found</p>
          <p className="mt-1 text-sm text-muted">You may not have access to this customer.</p>
        </CardContent>
      </Card>
    );
  }

  const { enquiry, followUps, assignments, audit } = q.data;
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["enquiry", id] });
    void qc.invalidateQueries({ queryKey: ["enquiries"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["follow-board"] });
  };

  return (
    <div>
      <PageHeader
        title={enquiry.customer_name}
        subtitle={`${enquiry.mobile} · ${enquiry.village || "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <CallActions mobile={enquiry.mobile} />
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close editor" : "Edit"}
            </Button>
            {owner ? (
              <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      {enquiry.is_demo ? (
        <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-soft">
          Demo record — sample data for testing, not a real customer.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-5 text-sm">
              <Field
                label="Mobile"
                value={
                  telHref(enquiry.mobile) ? (
                    <a className="font-medium text-accent underline-offset-2 hover:underline" href={telHref(enquiry.mobile)!}>
                      {enquiry.mobile}
                    </a>
                  ) : (
                    enquiry.mobile
                  )
                }
              />
              <Field label="Status" value={<StatusBadge status={enquiry.status} />} />
              <Field label="Purchase mode" value={enquiry.purchase_mode} />
              <Field label="Lead source" value={enquiry.lead_source} />
              <Field label="Enquiry date" value={formatDate(enquiry.enquiry_date)} />
              <Field label="Expected delivery" value={formatDate(enquiry.expected_delivery)} />
              <Field label="Assigned to" value={enquiry.assigned_to_name ?? "—"} />
              <Field label="Estimated value" value={formatInr(enquiry.estimated_value)} />
              <Field label="Next follow-up" value={`${formatDate(enquiry.next_follow_up)} ${enquiry.next_follow_up_time ?? ""}`} />
              <Field label="Created by" value={enquiry.created_by_name ?? "—"} />
              {enquiry.exchange_required ? (
                <div className="col-span-2">
                  <Field label="Exchange" value={enquiry.exchange_vehicle || "Yes"} />
                </div>
              ) : null}
              {enquiry.notes ? (
                <div className="col-span-2">
                  <Field label="Notes" value={enquiry.notes} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit enquiry</CardTitle>
              </CardHeader>
              <CardContent>
                <EnquiryForm
                  session={session}
                  enquiry={enquiry}
                  onSaved={() => {
                    setEditing(false);
                    invalidate();
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          <FollowUpComposer
            enquiryId={id}
            onSaved={invalidate}
          />

          <Card>
            <CardHeader>
              <CardTitle>Follow-up history</CardTitle>
            </CardHeader>
            <CardContent>
              {followUps.length === 0 ? (
                <p className="text-sm text-muted">No follow-ups yet.</p>
              ) : (
                <ol className="space-y-4">
                  {followUps.map((f) => (
                    <li key={f.id} className="border-l-2 border-line pl-3">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={f.status} />
                        <span className="text-xs text-muted">{formatDateTime(f.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm">
                        {formatDate(f.follow_up_date)} {f.follow_up_time ?? ""} · {f.staff_name}
                      </p>
                      {f.notes ? <p className="text-sm text-ink-soft">{f.notes}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(["Follow-up", "Interested", "Negotiation", "Booked", "Sold", "Lost"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={enquiry.status === s ? "default" : "outline"}
                  onClick={async () => {
                    try {
                      await updateEnquiryStatus({ data: { id, status: s } });
                      toast.success(`Marked ${s}`);
                      invalidate();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  {s}
                </Button>
              ))}
            </CardContent>
          </Card>

          {owner ? (
            <Card>
              <CardHeader>
                <CardTitle>Assign staff</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
                  defaultValue={enquiry.assigned_to ?? ""}
                  onChange={async (e) => {
                    try {
                      await assignEnquiry({ data: { id, staffId: e.target.value } });
                      toast.success("Assignment updated");
                      invalidate();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  {session.staff
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.full_name}
                      </option>
                    ))}
                </select>
              </CardContent>
            </Card>
          ) : null}

          {assignments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Assignment history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {assignments.map((a) => (
                  <p key={a.id} className="text-ink-soft">
                    {a.previous_staff_name ?? "Unassigned"} → {a.new_staff_name ?? "—"}
                    <span className="block text-xs text-muted">
                      {a.changed_by_name} · {formatDateTime(a.changed_at)}
                    </span>
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {owner ? (
            <Card>
              <CardHeader>
                <CardTitle>Audit history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {audit.length === 0 ? (
                  <p className="text-sm text-muted">No events yet.</p>
                ) : (
                  audit.map((a) => (
                    <div key={a.id} className="border-l-2 border-line pl-3">
                      <p className="text-sm font-medium">{a.action.replaceAll("_", " ")}</p>
                      <p className="text-xs text-muted">
                        {a.actor_name} · {formatDateTime(a.created_at)}
                      </p>
                      {a.details ? <p className="text-xs text-ink-soft">{a.details}</p> : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}

function FollowUpComposer({ enquiryId, onSaved }: { enquiryId: string; onSaved: () => void }) {
  const [status, setStatus] = useState<(typeof FOLLOW_UP_STATUSES)[number]>("Completed");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");

  const save = useMutation({
    mutationFn: () =>
      addFollowUp({
        data: {
          enquiryId,
          follow_up_date: date,
          follow_up_time: time || null,
          status,
          notes: notes || null,
          next_follow_up_date: nextDate || null,
          next_follow_up_time: nextTime || null,
        },
      }),
    onSuccess: () => {
      toast.success("Follow-up saved");
      setNotes("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add follow-up</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Follow-up date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {FOLLOW_UP_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Next follow-up date</Label>
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Note</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened on the call?" />
          </div>
          <div className="space-y-1.5">
            <Label>Next follow-up time</Label>
            <Input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={save.isPending} className="w-full">
              {save.isPending ? "Saving…" : "Save follow-up"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
