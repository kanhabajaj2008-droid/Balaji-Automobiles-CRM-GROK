import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Authenticated } from "@/components/auth-gate";
import { PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createStaff, listStaff, resetStaffPassword, setStaffActive, setStaffRole } from "@/lib/crm/staff";

export const Route = createFileRoute("/staff")({ component: StaffPage });

function StaffPage() {
  return (
    <Authenticated ownerOnly>
      {() => <StaffAdmin />}
    </Authenticated>
  );
}

function StaffAdmin() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["staff"], queryFn: () => listStaff() });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const create = useMutation({
    mutationFn: () => createStaff({ data: { full_name: name, email, role: "staff" } }),
    onSuccess: (res) => {
      setCreated({ email: res.email, temporaryPassword: res.temporaryPassword });
      setName("");
      setEmail("");
      toast.success("Staff account created");
      void qc.invalidateQueries({ queryKey: ["staff"] });
      void qc.invalidateQueries({ queryKey: ["crm-session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Create logins, deactivate access, and watch conversion. Deactivated staff lose data access immediately."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Add staff account</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending} className="w-full">
                {create.isPending ? "Creating…" : "Create staff"}
              </Button>
            </div>
          </form>
          {created ? (
            <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
              <p className="font-medium">Share this once — it will not be shown again</p>
              <p className="mt-1 tabular-nums">
                {created.email}
                <br />
                Password: {created.temporaryPassword}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Enquiries</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3">Lost</th>
                <th className="px-4 py-3">Conv.</th>
                <th className="px-4 py-3">Access</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((s) => (
                <tr key={s.user_id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="h-9 rounded-md border border-line bg-surface px-2 text-xs"
                      value={s.role}
                      onChange={async (e) => {
                        try {
                          await setStaffRole({ data: { userId: s.user_id, role: e.target.value as "owner" | "staff" } });
                          toast.success("Role updated");
                          void qc.invalidateQueries({ queryKey: ["staff"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed");
                        }
                      }}
                    >
                      <option value="owner">Owner</option>
                      <option value="staff">Staff</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{s.total}</td>
                  <td className="px-4 py-3 tabular-nums">{s.sold}</td>
                  <td className="px-4 py-3 tabular-nums">{s.lost}</td>
                  <td className="px-4 py-3 tabular-nums">{s.conversion}%</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={s.active ? "outline" : "default"}
                        onClick={async () => {
                          try {
                            await setStaffActive({ data: { userId: s.user_id, active: !s.active } });
                            toast.success(s.active ? "Deactivated" : "Activated");
                            void qc.invalidateQueries({ queryKey: ["staff"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        {s.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            const res = await resetStaffPassword({ data: { userId: s.user_id } });
                            setCreated({ email: s.email ?? "", temporaryPassword: res.temporaryPassword });
                            toast.success("Password reset");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        Reset password
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
