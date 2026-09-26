import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Authenticated } from "@/components/auth-gate";
import { PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { updateSettings } from "@/lib/crm/settings";
import type { SessionInfo } from "@/lib/crm/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <Authenticated ownerOnly>
      {(session) => <SettingsForm session={session} />}
    </Authenticated>
  );
}

function SettingsForm({ session }: { session: SessionInfo }) {
  const qc = useQueryClient();
  const [name, setName] = useState(session.settings.showroom_name);
  const [address, setAddress] = useState(session.settings.showroom_address);
  const [phone, setPhone] = useState(session.settings.phone);
  const [days, setDays] = useState(String(session.settings.default_follow_up_days));

  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        data: {
          showroom_name: name,
          showroom_address: address,
          phone,
          default_follow_up_days: Number(days) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["crm-session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Settings" subtitle="Showroom profile and default follow-up timing" />
      <Card>
        <CardHeader>
          <CardTitle>Showroom</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid max-w-lg gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Showroom name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Default follow-up (days)</Label>
              <Input
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Staff access</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-ink-soft">
          <p>
            Create, deactivate and reset staff passwords from the{" "}
            <Link to="/staff" className="text-accent underline">
              Staff
            </Link>{" "}
            page. A deactivated account cannot read customer records, even by guessing IDs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
