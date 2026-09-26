import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { ENQUIRY_SELECT, mapEnquiry, requireCrmUser, requireOwner, writeAudit } from "./authz";
import type { Enquiry, StaffPerformance } from "./types";

const reportInput = z.object({
  kind: z.enum([
    "enquiries",
    "sales",
    "staff",
    "followups",
    "vehicle",
    "purchase",
    "lead",
    "conversion",
    "lost",
    "pending",
  ]),
  from: z.string(),
  to: z.string(),
  staffId: z.string().optional(),
  vehicle: z.string().optional(),
  status: z.string().optional(),
  purchaseMode: z.string().optional(),
  leadSource: z.string().optional(),
  export: z.boolean().optional(),
});

export type ReportKind = z.infer<typeof reportInput>["kind"];

export type ReportResult = {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  summary?: string;
};

export const runReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => reportInput.parse(input))
  .handler(async ({ context, data }): Promise<ReportResult> => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);

    const params: unknown[] = [data.from, data.to];
    const where = ["e.enquiry_date >= $1", "e.enquiry_date <= $2"];
    if (data.staffId) {
      params.push(data.staffId);
      where.push(`e.assigned_to = $${params.length}`);
    }
    if (data.vehicle) {
      params.push(data.vehicle);
      where.push(`e.vehicle = $${params.length}`);
    }
    if (data.status) {
      params.push(data.status);
      where.push(`e.status = $${params.length}`);
    }
    if (data.purchaseMode) {
      params.push(data.purchaseMode);
      where.push(`e.purchase_mode = $${params.length}`);
    }
    if (data.leadSource) {
      params.push(data.leadSource);
      where.push(`e.lead_source = $${params.length}`);
    }
    const clause = where.join(" and ");

    const loadEnquiries = async (extra = "") => {
      const rows = await sql.query<Parameters<typeof mapEnquiry>[0]>(
        `select ${ENQUIRY_SELECT}
         from enquiries e
         left join profiles ap on ap.user_id = e.assigned_to
         left join profiles cp on cp.user_id = e.created_by
         where ${clause} ${extra}
         order by e.enquiry_date desc, e.created_at desc`,
        params,
      );
      return rows.map(mapEnquiry);
    };

    const enquiryCols = [
      "Date",
      "Customer",
      "Mobile",
      "Village",
      "Vehicle",
      "Mode",
      "Source",
      "Status",
      "Staff",
      "Value",
      "Follow-up",
    ];
    const enquiryRow = (e: Enquiry) => [
      e.enquiry_date,
      e.customer_name,
      e.mobile,
      e.village,
      e.vehicle,
      e.purchase_mode,
      e.lead_source,
      e.status,
      e.assigned_to_name ?? "",
      e.estimated_value,
      e.next_follow_up,
    ];

    let result: ReportResult;

    switch (data.kind) {
      case "enquiries": {
        const list = await loadEnquiries();
        result = { title: "Enquiry Report", columns: enquiryCols, rows: list.map(enquiryRow) };
        break;
      }
      case "sales": {
        const list = await loadEnquiries("and e.status = 'Sold'");
        result = { title: "Sales Report", columns: enquiryCols, rows: list.map(enquiryRow) };
        break;
      }
      case "lost": {
        const list = await loadEnquiries("and e.status = 'Lost'");
        result = { title: "Lost Customer Report", columns: enquiryCols, rows: list.map(enquiryRow) };
        break;
      }
      case "pending": {
        const pendingParams: unknown[] = [];
        const pendingWhere = [
          "e.next_follow_up is not null",
          "e.status not in ('Sold','Lost')",
        ];
        if (data.staffId) {
          pendingParams.push(data.staffId);
          pendingWhere.push(`e.assigned_to = $${pendingParams.length}`);
        }
        const list = await sql.query<Parameters<typeof mapEnquiry>[0]>(
          `select ${ENQUIRY_SELECT}
           from enquiries e
           left join profiles ap on ap.user_id = e.assigned_to
           left join profiles cp on cp.user_id = e.created_by
           where ${pendingWhere.join(" and ")}
           order by e.next_follow_up asc`,
          pendingParams,
        );
        result = {
          title: "Pending Follow-up Report",
          columns: enquiryCols,
          rows: list.map(mapEnquiry).map(enquiryRow),
        };
        break;
      }
      case "staff": {
        const rows = await sql.query<StaffPerformance>(
          `select
             p.user_id, p.full_name,
             count(e.id)::int as total,
             count(e.id) filter (where e.status = 'Sold')::int as sold,
             count(e.id) filter (where e.status = 'Lost')::int as lost,
             (select count(*)::int from follow_ups f
               where f.staff_id = p.user_id and f.status = 'Completed'
                 and f.follow_up_date >= $1 and f.follow_up_date <= $2) as "followUpsCompleted",
             (select count(*)::int from enquiries x
               where x.assigned_to = p.user_id and x.next_follow_up is not null
                 and x.status not in ('Sold','Lost')) as "pendingFollowUps",
             0::float as conversion
           from profiles p
           left join enquiries e on e.assigned_to = p.user_id
             and e.enquiry_date >= $1 and e.enquiry_date <= $2
           group by p.user_id, p.full_name
           order by count(e.id) desc`,
          [data.from, data.to],
        );
        result = {
          title: "Staff Performance",
          columns: ["Staff", "Enquiries", "Sold", "Lost", "Follow-ups done", "Pending", "Conversion %"],
          rows: rows.map((r) => {
            const closed = r.sold + r.lost;
            const conv = closed === 0 ? 0 : Math.round((r.sold / closed) * 1000) / 10;
            return [
              r.full_name,
              r.total,
              r.sold,
              r.lost,
              r.followUpsCompleted,
              r.pendingFollowUps,
              conv,
            ];
          }),
        };
        break;
      }
      case "vehicle": {
        const rows = await sql.query<{ name: string; count: number; sold: number; value: string }>(
          `select vehicle as name, count(*)::int as count,
                  count(*) filter (where status='Sold')::int as sold,
                  coalesce(sum(estimated_value) filter (where status='Sold'),0)::text as value
           from enquiries e where ${clause}
           group by vehicle order by count desc`,
          params,
        );
        result = {
          title: "Vehicle-wise Report",
          columns: ["Vehicle", "Enquiries", "Sold", "Sold value"],
          rows: rows.map((r) => [r.name, r.count, r.sold, Number(r.value)]),
        };
        break;
      }
      case "purchase": {
        const rows = await sql.query<{ name: string; count: number }>(
          `select purchase_mode as name, count(*)::int as count
           from enquiries e where ${clause} group by purchase_mode order by count desc`,
          params,
        );
        result = {
          title: "Purchase Mode Report",
          columns: ["Mode", "Enquiries"],
          rows: rows.map((r) => [r.name, r.count]),
        };
        break;
      }
      case "lead": {
        const rows = await sql.query<{ name: string; count: number; sold: number }>(
          `select lead_source as name, count(*)::int as count,
                  count(*) filter (where status='Sold')::int as sold
           from enquiries e where ${clause} group by lead_source order by count desc`,
          params,
        );
        result = {
          title: "Lead Source Report",
          columns: ["Source", "Enquiries", "Sold"],
          rows: rows.map((r) => [r.name, r.count, r.sold]),
        };
        break;
      }
      case "conversion": {
        const rows = await sql.query<{
          total: number;
          sold: number;
          lost: number;
          booked: number;
        }>(
          `select count(*)::int as total,
                  count(*) filter (where status='Sold')::int as sold,
                  count(*) filter (where status='Lost')::int as lost,
                  count(*) filter (where status='Booked')::int as booked
           from enquiries e where ${clause}`,
          params,
        );
        const r = rows[0] ?? { total: 0, sold: 0, lost: 0, booked: 0 };
        const closed = r.sold + r.lost;
        const conv = closed === 0 ? 0 : Math.round((r.sold / closed) * 1000) / 10;
        result = {
          title: "Conversion Report",
          columns: ["Metric", "Value"],
          rows: [
            ["Total enquiries", r.total],
            ["Sold", r.sold],
            ["Lost", r.lost],
            ["Booked", r.booked],
            ["Conversion % (sold / sold+lost)", conv],
          ],
        };
        break;
      }
      case "followups": {
        const rows = await sql.query<{
          customer_name: string;
          mobile: string;
          vehicle: string;
          follow_up_date: string;
          status: string;
          staff_name: string | null;
          notes: string | null;
        }>(
          `select e.customer_name, e.mobile, e.vehicle,
                  f.follow_up_date::text as follow_up_date, f.status,
                  p.full_name as staff_name, f.notes
           from follow_ups f
           join enquiries e on e.id = f.enquiry_id
           left join profiles p on p.user_id = f.staff_id
           where f.follow_up_date >= $1 and f.follow_up_date <= $2
           order by f.follow_up_date desc`,
          [data.from, data.to],
        );
        result = {
          title: "Follow-up Report",
          columns: ["Date", "Customer", "Mobile", "Vehicle", "Status", "Staff", "Notes"],
          rows: rows.map((r) => [
            r.follow_up_date,
            r.customer_name,
            r.mobile,
            r.vehicle,
            r.status,
            r.staff_name,
            r.notes,
          ]),
        };
        break;
      }
    }

    if (data.export) {
      await writeAudit(sql, {
        actorId: profile.user_id,
        actorName: profile.full_name,
        action: "export_performed",
        entity: "report",
        entityId: data.kind,
        details: `${result.title} ${data.from} to ${data.to} (${result.rows.length} rows)`,
      });
    }

    return result;
  });
