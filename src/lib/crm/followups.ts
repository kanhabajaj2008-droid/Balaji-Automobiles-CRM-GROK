import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { newId } from "@/lib/utils";
import { loadEnquiry, parseTags, requireCrmUser, writeAudit } from "./authz";
import { FOLLOW_UP_STATUSES } from "./constants";
import type { FollowUp } from "./types";

const followUpInput = z.object({
  enquiryId: z.string().min(1),
  follow_up_date: z.string().min(1),
  follow_up_time: z.string().nullable().optional(),
  status: z.enum(FOLLOW_UP_STATUSES),
  notes: z.string().nullable().optional(),
  next_follow_up_date: z.string().nullable().optional(),
  next_follow_up_time: z.string().nullable().optional(),
});

export const addFollowUp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => followUpInput.parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const enquiry = await loadEnquiry(sql, profile, data.enquiryId);
    const id = newId();
    await sql`
      insert into follow_ups (
        id, enquiry_id, staff_id, follow_up_date, follow_up_time,
        status, notes, next_follow_up_date, next_follow_up_time
      ) values (
        ${id},
        ${data.enquiryId},
        ${profile.user_id},
        ${data.follow_up_date},
        ${data.follow_up_time || null},
        ${data.status},
        ${data.notes || null},
        ${data.next_follow_up_date || null},
        ${data.next_follow_up_time || null}
      )
    `;

    const nextDate = data.next_follow_up_date || enquiry.next_follow_up;
    const nextTime = data.next_follow_up_time || enquiry.next_follow_up_time;
    let nextStatus = enquiry.status;
    if (data.status === "Booked") nextStatus = "Booked";
    else if (data.status === "Lost") nextStatus = "Lost";
    else if (data.status === "Interested" && enquiry.status === "New") nextStatus = "Interested";
    else if (enquiry.status === "New") nextStatus = "Follow-up";

    await sql`
      update enquiries set
        next_follow_up = ${nextDate},
        next_follow_up_time = ${nextTime},
        status = ${nextStatus},
        updated_at = now()
      where id = ${data.enquiryId}
    `;

    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: data.status === "Completed" ? "follow_up_completed" : "follow_up_added",
      entity: "enquiry",
      entityId: data.enquiryId,
      details: `${data.status} follow-up for ${enquiry.customer_name}${data.notes ? `: ${data.notes}` : ""}`,
    });
    return { id };
  });

export const listFollowUpBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ tagId: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const { sql } = await requireCrmUser(context.userId);
    const params: unknown[] = [];
    let tagFilter = "";
    if (data.tagId) {
      params.push(data.tagId);
      tagFilter = `and exists (select 1 from enquiry_tags et where et.enquiry_id = e.id and et.tag_id = $1)`;
    }

    const rows = await sql.query<FollowUp & { tags?: unknown }>(
      `select
         e.id as enquiry_id,
         e.customer_name,
         e.mobile,
         e.vehicle,
         e.status as enquiry_status,
         e.next_follow_up::text as follow_up_date,
         e.next_follow_up_time as follow_up_time,
         e.assigned_to as staff_id,
         p.full_name as staff_name,
         e.id,
         'Pending' as status,
         e.notes,
         e.next_follow_up::text as next_follow_up_date,
         e.next_follow_up_time,
         e.updated_at::text as created_at,
         (
           select coalesce(
             json_agg(json_build_object('id', t.id, 'name', t.name) order by lower(t.name)),
             '[]'::json
           )
           from enquiry_tags et
           join tags t on t.id = et.tag_id
           where et.enquiry_id = e.id
         ) as tags
       from enquiries e
       left join profiles p on p.user_id = e.assigned_to
       where e.next_follow_up is not null
         and e.status not in ('Sold', 'Lost')
         ${tagFilter}
       order by e.next_follow_up asc, e.next_follow_up_time asc nulls last`,
      params,
    );

    const mapped = rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const overdue = mapped.filter((r) => r.follow_up_date < todayStr);
    const todayList = mapped.filter((r) => r.follow_up_date === todayStr);
    const upcoming = mapped.filter((r) => r.follow_up_date > todayStr).slice(0, 80);

    return { overdue, today: todayList, upcoming };
  });
