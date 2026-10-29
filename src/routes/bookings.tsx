import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Authenticated } from "@/components/auth-gate";
import { CallActions } from "@/components/call-button";
import { PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { deleteBooking, listBookings, saveBooking } from "@/lib/crm/bookings";
import { LIVE_POLL_MS, OCCASIONS, VEHICLES } from "@/lib/crm/constants";
import type { Booking, SessionInfo } from "@/lib/crm/types";
import { downloadTextFile, formatDate, formatInr, isValidMobile, todayIso, toCsv } from "@/lib/utils";

export const Route = createFileRoute("/bookings")({ component: BookingsPage });

type Draft = {
  id?: string;
  booking_date: string;
  customer_name: string;
  mobile: string;
  city: string;
  vehicle: string;
  amount: string;
  delivery_date: string;
  occasion: string;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    booking_date: todayIso(),
    customer_name: "",
    mobile: "",
    city: "",
    vehicle: "Splendor Plus",
    amount: "",
    delivery_date: "",
    occasion: "",
    notes: "",
  };
}

function BookingsPage() {
  return <Authenticated>{(session) => <Bookings session={session} />}</Authenticated>;
}

function Bookings({ session }: { session: SessionInfo }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [occasion, setOccasion] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const filters = useMemo(() => ({ q, occasion, vehicle, from, to }), [q, occasion, vehicle, from, to]);
  const list = useQuery({
    queryKey: ["bookings", filters],
    queryFn: () => listBookings({ data: filters }),
    refetchInterval: LIVE_POLL_MS,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const rows = list.data?.rows ?? [];
  const occasions = Array.from(new Set([...(list.data?.occasions ?? []), ...OCCASIONS]));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  const save = useMutation({
    mutationFn: () => {
      if (!isValidMobile(draft.mobile)) throw new Error("Enter a valid 10-digit Indian mobile number.");
      const amount = Number(draft.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter the booking amount.");
      return saveBooking({
        data: {
          id: draft.id,
          booking_date: draft.booking_date,
          customer_name: draft.customer_name,
          mobile: draft.mobile,
          city: draft.city,
          vehicle: draft.vehicle,
          amount,
          delivery_date: draft.delivery_date || null,
          occasion: draft.occasion,
          notes: draft.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(draft.id ? "Booking updated" : "Booking saved");
      setDraft(emptyDraft());
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBooking({ data: { id } }),
    onSuccess: () => {
      toast.success("Booking deleted");
      void qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function edit(row: Booking) {
    setDraft({
      id: row.id,
      booking_date: row.booking_date,
      customer_name: row.customer_name,
      mobile: row.mobile,
      city: row.city,
      vehicle: row.vehicle,
      amount: String(row.amount),
      delivery_date: row.delivery_date ?? "",
      occasion: row.occasion,
      notes: row.notes ?? "",
    });
    setOpen(true);
  }

  function exportCsv() {
    const csv = toCsv(
      ["Booking date", "Customer", "Mobile", "City", "Vehicle", "Amount", "Delivery", "Occasion", "Notes", "Entered by"],
      rows.map((r) => [
        r.booking_date,
        r.customer_name,
        r.mobile,
        r.city,
        r.vehicle,
        r.amount,
        r.delivery_date,
        r.occasion,
        r.notes,
        r.created_by_name,
      ]),
    );
    downloadTextFile("booking-list.csv", csv, "text/csv;charset=utf-8");
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div>
      <div className="print-only mb-4 hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{session.settings.showroom_name}</p>
        <h1 className="font-display text-4xl">Booking list</h1>
        <p className="text-sm">
          {rows.length} bookings · {formatInr(total)}
          {from || to ? ` · ${from || "…"} to ${to || "…"}` : ""}
          {occasion ? ` · ${occasion}` : ""}
        </p>
      </div>

      <div className="no-print">
        <PageHeader
          title="Booking list"
          subtitle="Owner and staff can both add bookings. Amount, delivery date, and occasion stay here."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                Print
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
                Export
              </Button>
              <Button
                onClick={() => {
                  setDraft(emptyDraft());
                  setOpen(true);
                }}
              >
                New booking
              </Button>
            </div>
          }
        />

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOccasion("")}
            className={`h-9 rounded-full px-3 text-xs font-semibold ${occasion === "" ? "bg-ink text-accent-fg" : "bg-surface ring-1 ring-line"}`}
          >
            All occasions
          </button>
          {occasions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setOccasion(name)}
              className={`h-9 rounded-full px-3 text-xs font-semibold ${occasion === name ? "bg-ink text-accent-fg" : "bg-surface ring-1 ring-line"}`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Input
            placeholder="Search name, mobile, city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="col-span-2"
          />
          <select className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="">All vehicles</option>
            {VEHICLES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <input type="date" className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="h-11 rounded-md border border-line bg-surface px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bookings</p>
          <p className="font-display text-3xl">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Amount received</p>
          <p className="font-display text-3xl">{formatInr(total)}</p>
        </div>
      </div>

      {open ? (
        <form
          className="no-print mb-4 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <p className="font-display text-2xl">{draft.id ? "Edit booking" : "New booking"}</p>
          </div>
          <Field label="Customer name">
            <Input value={draft.customer_name} onChange={(e) => set("customer_name", e.target.value)} required />
          </Field>
          <Field label="Mobile">
            <Input inputMode="numeric" value={draft.mobile} onChange={(e) => set("mobile", e.target.value)} required />
          </Field>
          <Field label="City">
            <Input value={draft.city} onChange={(e) => set("city", e.target.value)} required />
          </Field>
          <Field label="Vehicle">
            <select
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
              value={VEHICLES.includes(draft.vehicle as (typeof VEHICLES)[number]) ? draft.vehicle : "Other"}
              onChange={(e) => set("vehicle", e.target.value === "Other" ? "" : e.target.value)}
            >
              {VEHICLES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            {!VEHICLES.includes(draft.vehicle as (typeof VEHICLES)[number]) ? (
              <Input className="mt-2" placeholder="Vehicle name" value={draft.vehicle} onChange={(e) => set("vehicle", e.target.value)} required />
            ) : null}
          </Field>
          <Field label="Booking amount">
            <Input inputMode="decimal" value={draft.amount} onChange={(e) => set("amount", e.target.value)} required />
          </Field>
          <Field label="Occasion">
            <Input list="occasions" value={draft.occasion} onChange={(e) => set("occasion", e.target.value)} placeholder="Dhanteras" />
            <datalist id="occasions">
              {OCCASIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Field label="Booking date">
            <Input type="date" value={draft.booking_date} onChange={(e) => set("booking_date", e.target.value)} required />
          </Field>
          <Field label="Delivery date">
            <Input type="date" value={draft.delivery_date} onChange={(e) => set("delivery_date", e.target.value)} />
          </Field>
          <Field label="Notes">
            <Input value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save booking"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface lg:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              {["Date", "Customer", "Mobile", "City", "Vehicle", "Amount", "Delivery", "Occasion", "By", ""].map((h) => (
                <th key={h || "actions"} className="border-b border-line px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line">
                <td className="px-3 py-2">{formatDate(row.booking_date)}</td>
                <td className="px-3 py-2 font-medium">{row.customer_name}</td>
                <td className="px-3 py-2">{row.mobile}</td>
                <td className="px-3 py-2">{row.city || "—"}</td>
                <td className="px-3 py-2">{row.vehicle}</td>
                <td className="px-3 py-2 tabular-nums">{formatInr(row.amount)}</td>
                <td className="px-3 py-2">{formatDate(row.delivery_date)}</td>
                <td className="px-3 py-2">{row.occasion || "—"}</td>
                <td className="px-3 py-2">{row.created_by_name || "—"}</td>
                <td className="no-print px-3 py-2">
                  <RowActions row={row} onEdit={() => edit(row)} onDelete={() => remove.mutate(row.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="p-4 text-sm text-muted">No bookings yet.</p> : null}
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.customer_name}</p>
                <p className="text-sm text-muted">
                  {row.city || "No city"} · {row.vehicle}
                </p>
              </div>
              <p className="font-display text-2xl">{formatInr(row.amount)}</p>
            </div>
            <p className="mt-2 text-sm">
              Booked {formatDate(row.booking_date)}
              {row.delivery_date ? ` · Delivery ${formatDate(row.delivery_date)}` : ""}
              {row.occasion ? ` · ${row.occasion}` : ""}
            </p>
            <div className="no-print mt-3 flex items-center justify-between gap-2">
              <CallActions mobile={row.mobile} />
              <RowActions row={row} onEdit={() => edit(row)} onDelete={() => remove.mutate(row.id)} />
            </div>
          </article>
        ))}
        {!rows.length ? <p className="text-sm text-muted">No bookings yet.</p> : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 text-sm">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RowActions({
  row,
  onEdit,
  onDelete,
}: {
  row: Booking;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onEdit}>
        Edit
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (window.confirm(`Delete booking for ${row.customer_name}?`)) onDelete();
        }}
      >
        Delete
      </Button>
    </div>
  );
}
