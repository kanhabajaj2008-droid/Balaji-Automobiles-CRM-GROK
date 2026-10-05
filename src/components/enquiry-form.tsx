import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  ENQUIRY_STATUSES,
  LEAD_SOURCES,
  PURCHASE_MODES,
  VEHICLES,
} from "@/lib/crm/constants";
import { checkDuplicateMobile, saveEnquiry } from "@/lib/crm/enquiries";
import type { Enquiry, SessionInfo } from "@/lib/crm/types";
import { TagPicker } from "@/components/tag-picker";
import { isValidMobile, normalizeMobile, todayIso } from "@/lib/utils";

type Values = {
  enquiry_date: string;
  customer_name: string;
  mobile: string;
  village: string;
  vehicle: string;
  purchase_mode: (typeof PURCHASE_MODES)[number];
  expected_delivery: string;
  lead_source: (typeof LEAD_SOURCES)[number];
  status: (typeof ENQUIRY_STATUSES)[number];
  next_follow_up: string;
  next_follow_up_time: string;
  assigned_to: string;
  estimated_value: string;
  exchange_required: boolean;
  exchange_vehicle: string;
  notes: string;
};

function fromEnquiry(e?: Enquiry, session?: SessionInfo): Values {
  return {
    enquiry_date: e?.enquiry_date ?? todayIso(),
    customer_name: e?.customer_name ?? "",
    mobile: e?.mobile ?? "",
    village: e?.village ?? "",
    vehicle: e?.vehicle ?? "Splendor Plus",
    purchase_mode: e?.purchase_mode ?? "Cash",
    expected_delivery: e?.expected_delivery ?? "",
    lead_source: e?.lead_source ?? "Walk-in",
    status: e?.status ?? "New",
    next_follow_up: e?.next_follow_up ?? "",
    next_follow_up_time: e?.next_follow_up_time ?? "",
    assigned_to: e?.assigned_to ?? session?.profile.user_id ?? "",
    estimated_value: e?.estimated_value != null ? String(e.estimated_value) : "",
    exchange_required: e?.exchange_required ?? false,
    exchange_vehicle: e?.exchange_vehicle ?? "",
    notes: e?.notes ?? "",
  };
}

export function EnquiryForm({
  session,
  enquiry,
  onSaved,
}: {
  session: SessionInfo;
  enquiry?: Enquiry;
  onSaved: (id: string) => void;
}) {
  const [values, setValues] = useState<Values>(() => fromEnquiry(enquiry, session));
  const [tagIds, setTagIds] = useState<string[]>(() => (enquiry?.tags ?? []).map((t) => t.id));
  const [dupes, setDupes] = useState<Enquiry[]>([]);

  useEffect(() => {
    setValues(fromEnquiry(enquiry, session));
    setTagIds((enquiry?.tags ?? []).map((t) => t.id));
  }, [enquiry, session]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!isValidMobile(values.mobile)) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }
      const exchange =
        values.exchange_required ||
        values.purchase_mode === "Exchange" ||
        values.purchase_mode === "Cash + Exchange";
      return saveEnquiry({
        data: {
          id: enquiry?.id,
          enquiry_date: values.enquiry_date,
          customer_name: values.customer_name,
          mobile: normalizeMobile(values.mobile),
          village: values.village,
          vehicle: values.vehicle,
          purchase_mode: values.purchase_mode,
          expected_delivery: values.expected_delivery || null,
          lead_source: values.lead_source,
          status: values.status,
          next_follow_up: values.next_follow_up || null,
          next_follow_up_time: values.next_follow_up_time || null,
          assigned_to: session.profile.role === "owner" ? values.assigned_to : session.profile.user_id,
          estimated_value: values.estimated_value ? Number(values.estimated_value) : null,
          exchange_required: exchange,
          exchange_vehicle: values.exchange_vehicle || null,
          notes: values.notes || null,
          tagIds,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(enquiry ? "Enquiry updated" : "Enquiry created");
      onSaved(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onMobileBlur() {
    if (!isValidMobile(values.mobile)) {
      setDupes([]);
      return;
    }
    const res = await checkDuplicateMobile({
      data: { mobile: values.mobile, excludeId: enquiry?.id },
    });
    setDupes(res.matches);
  }

  const field = "space-y-1.5";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={field}>
          <Label htmlFor="enquiry_date">Enquiry date</Label>
          <Input
            id="enquiry_date"
            type="date"
            value={values.enquiry_date}
            onChange={(e) => set("enquiry_date", e.target.value)}
            required
          />
        </div>
        <div className={field}>
          <Label htmlFor="customer_name">Customer name</Label>
          <Input
            id="customer_name"
            value={values.customer_name}
            onChange={(e) => set("customer_name", e.target.value)}
            required
          />
        </div>
        <div className={field}>
          <Label htmlFor="mobile">Mobile number</Label>
          <Input
            id="mobile"
            inputMode="numeric"
            value={values.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            onBlur={onMobileBlur}
            required
          />
          {dupes.length > 0 ? (
            <p className="text-xs text-warn">
              Open enquiry already exists for {dupes[0].customer_name} ({dupes[0].status}).
            </p>
          ) : null}
        </div>
        <div className={field}>
          <Label htmlFor="village">Village / city</Label>
          <Input id="village" value={values.village} onChange={(e) => set("village", e.target.value)} />
        </div>
        <div className={field}>
          <Label htmlFor="vehicle">Vehicle interested in</Label>
          <select
            id="vehicle"
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
            value={values.vehicle}
            onChange={(e) => set("vehicle", e.target.value)}
          >
            {VEHICLES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className={field}>
          <Label htmlFor="purchase_mode">Purchase mode</Label>
          <select
            id="purchase_mode"
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
            value={values.purchase_mode}
            onChange={(e) => set("purchase_mode", e.target.value as Values["purchase_mode"])}
          >
            {PURCHASE_MODES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className={field}>
          <Label htmlFor="expected_delivery">Expected delivery</Label>
          <Input
            id="expected_delivery"
            type="date"
            value={values.expected_delivery}
            onChange={(e) => set("expected_delivery", e.target.value)}
          />
        </div>
        <div className={field}>
          <Label htmlFor="lead_source">Lead source</Label>
          <select
            id="lead_source"
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
            value={values.lead_source}
            onChange={(e) => set("lead_source", e.target.value as Values["lead_source"])}
          >
            {LEAD_SOURCES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className={field}>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
            value={values.status}
            onChange={(e) => set("status", e.target.value as Values["status"])}
          >
            {ENQUIRY_STATUSES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className={field}>
          <Label htmlFor="next_follow_up">Next follow-up date</Label>
          <Input
            id="next_follow_up"
            type="date"
            value={values.next_follow_up}
            onChange={(e) => set("next_follow_up", e.target.value)}
          />
        </div>
        <div className={field}>
          <Label htmlFor="next_follow_up_time">Follow-up time</Label>
          <Input
            id="next_follow_up_time"
            type="time"
            value={values.next_follow_up_time}
            onChange={(e) => set("next_follow_up_time", e.target.value)}
          />
        </div>
        {session.profile.role === "owner" ? (
          <div className={field}>
            <Label htmlFor="assigned_to">Assigned sales staff</Label>
            <select
              id="assigned_to"
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
              value={values.assigned_to}
              onChange={(e) => set("assigned_to", e.target.value)}
            >
              {session.staff
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.full_name}
                    {s.role === "owner" ? " (Owner)" : ""}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        <div className={field}>
          <Label htmlFor="estimated_value">Estimated value (INR)</Label>
          <Input
            id="estimated_value"
            inputMode="numeric"
            value={values.estimated_value}
            onChange={(e) => set("estimated_value", e.target.value)}
          />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={
                values.exchange_required ||
                values.purchase_mode === "Exchange" ||
                values.purchase_mode === "Cash + Exchange"
              }
              onChange={(e) => set("exchange_required", e.target.checked)}
            />
            Exchange required
          </label>
        </div>
        <div className={`${field} sm:col-span-2`}>
          <Label htmlFor="exchange_vehicle">Exchange vehicle details</Label>
          <Input
            id="exchange_vehicle"
            value={values.exchange_vehicle}
            onChange={(e) => set("exchange_vehicle", e.target.value)}
            placeholder="Make, year, km, condition"
          />
        </div>
        <div className={`${field} sm:col-span-2`}>
          <Label>Tags</Label>
          <TagPicker selectedIds={tagIds} onChange={setTagIds} />
          <p className="text-xs text-muted">Create a tag like Navratri, then tick it on each customer in that campaign.</p>
        </div>
        <div className={`${field} sm:col-span-2`}>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={save.isPending} className="min-w-40">
          {save.isPending ? "Saving…" : enquiry ? "Save changes" : "Create enquiry"}
        </Button>
      </div>
    </form>
  );
}
