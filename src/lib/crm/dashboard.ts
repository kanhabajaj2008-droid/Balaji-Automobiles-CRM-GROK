import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireCrmUser } from "./authz";
import type { DashboardPayload, FollowUp, NamedCount, StaffPerformance } from "./types";

const rangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

function accessSql(isOwner: boolean, userId: string) {
  if (isOwner) return { sql: "", params: [] as unknown[] };
  return { sql: "and (assigned_to = $3 or created_by = $3)", params: [userId] };
}

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ context, data }): Promise<DashboardPayload> => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const isOwner = profile.role === "owner";
    const acc = accessSql(isOwner, profile.user_id);
    const params = [data.from, data.to, ...acc.params];
    const access = acc.sql.replace("$3", `$${params.length}`);

    const statsRows = await sql.query<{
      total: number;
      neu: number;
      sold: number;
      lost: number;
      pipeline: string | number | null;
      sold_value: string | number | null;
    }>(
      `select
         count(*)::int as total,
         count(*) filter (where status = 'New')::int as neu,
         count(*) filter (where status = 'Sold')::int as sold,
         count(*) filter (where status = 'Lost')::int as lost,
         coalesce(sum(estimated_value) filter (where status not in ('Sold','Lost')), 0)::text as pipeline,
         coalesce(sum(estimated_value) filter (where status = 'Sold'), 0)::text as sold_value
       from enquiries
       where enquiry_date >= $1 and enquiry_date <= $2 ${access}`,
      params,
    );
    const s = statsRows[0] ?? {
      total: 0,
      neu: 0,
      sold: 0,
      lost: 0,
      pipeline: 0,
      sold_value: 0,
    };

    const followParams: unknown[] = [];
    const followAccess = "";

    const followCounts = await sql.query<{ today: number; overdue: number; open: number }>(
      `select
         count(*) filter (where next_follow_up = current_date)::int as today,
         count(*) filter (where next_follow_up < current_date)::int as overdue,
         count(*)::int as open
       from enquiries
       where next_follow_up is not null
         and status not in ('Sold','Lost')
         ${followAccess}`,
      followParams,
    );
    const fc = followCounts[0] ?? { today: 0, overdue: 0, open: 0 };

    const closed = s.sold + s.lost;
    const conversionRate = closed === 0 ? 0 : Math.round((s.sold / closed) * 1000) / 10;

    const byMonth = await sql.query<{ month: string; enquiries: number; sold: number }>(
      `select to_char(date_trunc('month', enquiry_date), 'YYYY-MM') as month,
              count(*)::int as enquiries,
              count(*) filter (where status = 'Sold')::int as sold
       from enquiries
       where enquiry_date >= $1 and enquiry_date <= $2 ${access}
       group by 1
       order by 1`,
      params,
    );

    const byVehicle = await sql.query<NamedCount>(
      `select vehicle as name, count(*)::int as count,
              coalesce(sum(estimated_value),0)::float as value
       from enquiries
       where enquiry_date >= $1 and enquiry_date <= $2 ${access}
       group by vehicle order by count desc, vehicle asc`,
      params,
    );

    const byPurchaseMode = await sql.query<NamedCount>(
      `select purchase_mode as name, count(*)::int as count
       from enquiries
       where enquiry_date >= $1 and enquiry_date <= $2 ${access}
       group by purchase_mode order by count desc`,
      params,
    );

    const byLeadSource = await sql.query<NamedCount>(
      `select lead_source as name, count(*)::int as count
       from enquiries
       where enquiry_date >= $1 and enquiry_date <= $2 ${access}
       group by lead_source order by count desc`,
      params,
    );

    let staffPerformance: StaffPerformance[] = [];
    if (isOwner) {
      staffPerformance = await sql.query<StaffPerformance>(
        `select
           p.user_id,
           p.full_name,
           count(e.id)::int as total,
           count(e.id) filter (where e.status = 'Sold')::int as sold,
           count(e.id) filter (where e.status = 'Lost')::int as lost,
           0::int as "followUpsCompleted",
           0::int as "pendingFollowUps",
           0::float as conversion
         from profiles p
         left join enquiries e
           on e.assigned_to = p.user_id
          and e.enquiry_date >= $1 and e.enquiry_date <= $2
         where p.active = true
         group by p.user_id, p.full_name
         order by count(e.id) desc, p.full_name`,
        [data.from, data.to],
      );

      const extras = await sql.query<{
        user_id: string;
        completed: number;
        pending: number;
      }>(
        `select
           p.user_id,
           (select count(*)::int from follow_ups f
              join enquiries e on e.id = f.enquiry_id
             where f.staff_id = p.user_id
               and f.status = 'Completed'
               and f.follow_up_date >= $1 and f.follow_up_date <= $2) as completed,
           (select count(*)::int from enquiries e
             where e.assigned_to = p.user_id
               and e.next_follow_up is not null
               and e.status not in ('Sold','Lost')) as pending
         from profiles p
         where p.active = true`,
        [data.from, data.to],
      );
      const extraMap = new Map(extras.map((x) => [x.user_id, x]));
      staffPerformance = staffPerformance.map((row) => {
        const x = extraMap.get(row.user_id);
        const closedRow = row.sold + row.lost;
        return {
          ...row,
          followUpsCompleted: x?.completed ?? 0,
          pendingFollowUps: x?.pending ?? 0,
          conversion: closedRow === 0 ? 0 : Math.round((row.sold / closedRow) * 1000) / 10,
        };
      });
    }

    const boardRows = await sql.query<FollowUp>(
      `select
         e.id, e.id as enquiry_id, e.customer_name, e.mobile, e.vehicle,
         e.status as enquiry_status,
         e.next_follow_up::text as follow_up_date,
         e.next_follow_up_time as follow_up_time,
         e.assigned_to as staff_id,
         p.full_name as staff_name,
         'Pending' as status,
         e.notes,
         e.next_follow_up::text as next_follow_up_date,
         e.next_follow_up_time,
         e.updated_at::text as created_at
       from enquiries e
       left join profiles p on p.user_id = e.assigned_to
       where e.next_follow_up is not null
         and e.status not in ('Sold','Lost')
         ${followAccess}
       order by e.next_follow_up asc`,
      followParams,
    );

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const todayFollowUps = boardRows.filter((r) => r.follow_up_date === todayStr);
    const overdueFollowUps = boardRows.filter((r) => r.follow_up_date < todayStr);

    return {
      stats: {
        total: s.total,
        neu: s.neu,
        openFollowUps: fc.open,
        todayFollowUps: fc.today,
        overdueFollowUps: fc.overdue,
        sold: s.sold,
        lost: s.lost,
        conversionRate,
        estimatedPipeline: Number(s.pipeline ?? 0),
        soldValue: Number(s.sold_value ?? 0),
      },
      byMonth,
      byVehicle,
      byPurchaseMode,
      byLeadSource,
      staffPerformance,
      todayFollowUps,
      overdueFollowUps,
    };
  });
