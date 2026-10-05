import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Authenticated } from "@/components/auth-gate";
import { FollowUpList } from "@/components/follow-up-list";
import { PageHeader } from "@/components/kpi";
import { TagFilterBar } from "@/components/tag-picker";
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
  const [tagId, setTagId] = useState("");
  const q = useQuery({
    queryKey: ["follow-board", tagId],
    queryFn: () => listFollowUpBoard({ data: { tagId: tagId || undefined } }),
    refetchInterval: LIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const data = q.data;

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Every showroom follow-up — filter by tag (Navratri, fair, etc.) then call the list"
      />
      <TagFilterBar value={tagId} onChange={setTagId} />
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
