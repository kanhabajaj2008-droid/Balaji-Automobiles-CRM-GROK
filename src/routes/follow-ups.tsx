import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated } from "@/components/auth-gate";
import { FollowUpList } from "@/components/follow-up-list";
import { PageHeader } from "@/components/kpi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listFollowUpBoard } from "@/lib/crm/followups";
import { LIVE_POLL_MS } from "@/lib/crm/constants";

export const Route = createFileRoute("/follow-ups")({ component: FollowUpsPage });

function FollowUpsPage() {
  return (
    <Authenticated>
      {() => <Board />}
    </Authenticated>
  );
}

function Board() {
  const q = useQuery({
    queryKey: ["follow-board"],
    queryFn: () => listFollowUpBoard(),
    refetchInterval: LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const data = q.data;

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Work the overdue list first, then today, then upcoming"
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-accent/30">
          <CardHeader>
            <CardTitle className="text-accent">Overdue ({data?.overdue.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowUpList items={data?.overdue ?? []} empty="Nothing overdue." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today ({data?.today.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowUpList items={data?.today ?? []} empty="No follow-ups due today." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming ({data?.upcoming.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowUpList items={data?.upcoming ?? []} empty="No upcoming follow-ups." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
