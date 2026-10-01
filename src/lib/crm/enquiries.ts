import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { addDaysIso, isValidMobile, newId, normalizeMobile, todayIso } from "@/lib/utils";
import {
  ENQUIRY_SELECT,
  ForbiddenError,
  loadEnquiry,
  mapEnquiry,
  requireCrmUser,
  requireOwner,
  writeAudit,
} from "./authz";
import {
  ENQUIRY_STATUSES,
  LEAD_SOURCES,
  PURCHASE_MODES,
  VEHICLES,
} from "./constants";
import type { AssignmentHistory, AuditRow, Enquiry, EnquiryDetail, EnquiryFilters, FollowUp } from "./types";

const filtersSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  vehicle: z.string().optional(),
  staffId: z.string().optional(),
  purchaseMode: z.string().optional(),
  leadSource: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  followUpFrom: z.string().optional(),
  followUpTo: z.string().optional(),
});

const enquiryInput = z.object({
  id: z.string().optional(),
  enquiry_date: z.string().min(1),
  customer_name: z.string().trim().min(2).max(120),
  mobile: z.string().min(8),
  village: z.string().trim().max(120).default(""),
  vehicle: z.string().min(1),
  purchase_mode: z.enum(PURCHASE_MODES),
  expected_delivery: z.string().nullable().optional(),
  lead_source: z.enum(LEAD_SOURCES),
  status: z.enum(ENQUIRY_STATUSES),
  next_follow_up: z.string().nullable().optional(),
  next_follow_up_time: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  estimated_value: z.number().nonnegative().nullable().optional(),
  exchange_required: z.boolean().optional(),
  exchange_vehicle: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const listEnquiries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => filtersSchema.parse(input ?? {}))
  .handler(async ({ context, data }): Promise<Enquiry[]> => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const f = data as EnquiryFilters;
    const params: unknown[] = [];
    const where: string[] = [];

    if (profile.role !== "owner") {
      params.push(profile.user_id);
      const i = params.length;
      where.push(
        `(e.assigned_to = $${i} OR e.created_by = $${i} OR (e.next_follow_up is not null AND e.status not in ('Sold','Lost')))`,
      );
    }

    if (f.q?.trim()) {
      params.push(`%${f.q.trim()}%`);
      const i = params.length;
      where.push(
        `(e.customer_name ilike $${i} OR e.mobile ilike $${i} OR e.village ilike $${i} OR e.vehicle ilike $${i})`,
      );
    }
    if (f.status) {
      params.push(f.status);
      where.push(`e.status = $${params.length}`);
    }
    if (f.vehicle) {
      params.push(f.vehicle);
      where.push(`e.vehicle = $${params.length}`);
    }
    if (f.staffId && profile.role === "owner") {
      params.push(f.staffId);
      where.push(`e.assigned_to = $${params.length}`);
    }
    if (f.purchaseMode) {
      params.push(f.purchaseMode);
      where.push(`e.purchase_mode = $${params.length}`);
    }
    if (f.leadSource) {
      params.push(f.leadSource);
      where.push(`e.lead_source = $${params.length}`);
    }
    if (f.from) {
      params.push(f.from);
      where.push(`e.enquiry_date >= $${params.length}`);
    }
    if (f.to) {
      params.push(f.to);
      where.push(`e.enquiry_date <= $${params.length}`);
    }
    if (f.followUpFrom) {
      params.push(f.followUpFrom);
      where.push(`e.next_follow_up >= $${params.length}`);
    }
    if (f.followUpTo) {
      params.push(f.followUpTo);
      where.push(`e.next_follow_up <= $${params.length}`);
    }

    const clause = where.length ? `where ${where.join(" and ")}` : "";
    const rows = await sql.query<Parameters<typeof mapEnquiry>[0]>(
      `select ${ENQUIRY_SELECT}
       from enquiries e
       left join profiles ap on ap.user_id = e.assigned_to
       left join profiles cp on cp.user_id = e.created_by
       ${clause}
       order by e.updated_at desc
       limit 500`,
      params,
    );
    return rows.map(mapEnquiry);
  });

export const getEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }): Promise<EnquiryDetail> => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const enquiry = await loadEnquiry(sql, profile, data.id);

    const followUps = await sql<FollowUp>`
      select
        f.id, f.enquiry_id, f.staff_id, p.full_name as staff_name,
        f.follow_up_date::text as follow_up_date, f.follow_up_time,
        f.status, f.notes,
        f.next_follow_up_date::text as next_follow_up_date,
        f.next_follow_up_time,
        f.created_at::text as created_at
      from follow_ups f
      left join profiles p on p.user_id = f.staff_id
      where f.enquiry_id = ${enquiry.id}
      order by f.created_at desc
    `;

    const assignments = await sql<AssignmentHistory>`
      select
        h.id, h.enquiry_id,
        h.previous_staff, pp.full_name as previous_staff_name,
        h.new_staff, np.full_name as new_staff_name,
        h.changed_by, cp.full_name as changed_by_name,
        h.changed_at::text as changed_at
      from staff_assignment_history h
      left join profiles pp on pp.user_id = h.previous_staff
      left join profiles np on np.user_id = h.new_staff
      left join profiles cp on cp.user_id = h.changed_by
      where h.enquiry_id = ${enquiry.id}
      order by h.changed_at desc
    `;

    const audit =
      profile.role === "owner"
        ? await sql<AuditRow>`
            select id, actor_id, actor_name, action, entity, entity_id, details,
                   created_at::text as created_at
            from audit_log
            where entity_id = ${enquiry.id}
            order by created_at desc
            limit 80
          `
        : [];

    return { enquiry, followUps, assignments, audit };
  });

export const checkDuplicateMobile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ mobile: z.string(), excludeId: z.string().optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { sql } = await requireCrmUser(context.userId);
    const mobile = normalizeMobile(data.mobile);
    if (!isValidMobile(mobile)) return { matches: [] as Enquiry[] };

    const params: unknown[] = [mobile];
    let extra = "";
    if (data.excludeId) {
      params.push(data.excludeId);
      extra += ` and id <> $${params.length}`;
    }

    const rows = await sql.query<Parameters<typeof mapEnquiry>[0]>(
      `select ${ENQUIRY_SELECT}
       from enquiries e
       left join profiles ap on ap.user_id = e.assigned_to
       left join profiles cp on cp.user_id = e.created_by
       where e.mobile = $1 and e.status not in ('Sold', 'Lost') ${extra}
       limit 5`,
      params,
    );
    return { matches: rows.map(mapEnquiry) };
  });

export const saveEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => enquiryInput.parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile, settings } = await requireCrmUser(context.userId);
    const mobile = normalizeMobile(data.mobile);
    if (!isValidMobile(mobile)) {
      throw new Error("Enter a valid 10-digit Indian mobile number.");
    }
    if (!VEHICLES.includes(data.vehicle as (typeof VEHICLES)[number]) && data.vehicle !== "Other") {
      /* custom vehicle names are allowed */
    }

    let assignedTo = data.assigned_to || profile.user_id;
    if (profile.role !== "owner") {
      assignedTo = data.id
        ? (await loadEnquiry(sql, profile, data.id)).assigned_to || profile.user_id
        : profile.user_id;
    }

    const nextFollow =
      data.next_follow_up ||
      (data.status === "Sold" || data.status === "Lost"
        ? null
        : addDaysIso(todayIso(), settings.default_follow_up_days));

    const exchangeRequired =
      data.exchange_required ||
      data.purchase_mode === "Exchange" ||
      data.purchase_mode === "Cash + Exchange";

    if (data.id) {
      const previous = await loadEnquiry(sql, profile, data.id);
      await sql`
        update enquiries set
          enquiry_date = ${data.enquiry_date},
          customer_name = ${data.customer_name.trim()},
          mobile = ${mobile},
          village = ${data.village ?? ""},
          vehicle = ${data.vehicle},
          purchase_mode = ${data.purchase_mode},
          expected_delivery = ${data.expected_delivery || null},
          lead_source = ${data.lead_source},
          status = ${data.status},
          next_follow_up = ${nextFollow},
          next_follow_up_time = ${data.next_follow_up_time || null},
          assigned_to = ${assignedTo},
          estimated_value = ${data.estimated_value ?? null},
          exchange_required = ${exchangeRequired},
          exchange_vehicle = ${data.exchange_vehicle || null},
          notes = ${data.notes || null},
          updated_at = now()
        where id = ${data.id}
      `;

      if (previous.assigned_to !== assignedTo) {
        await sql`
          insert into staff_assignment_history (id, enquiry_id, previous_staff, new_staff, changed_by)
          values (${newId()}, ${data.id}, ${previous.assigned_to}, ${assignedTo}, ${profile.user_id})
        `;
        await writeAudit(sql, {
          actorId: profile.user_id,
          actorName: profile.full_name,
          action: "staff_assignment_changed",
          entity: "enquiry",
          entityId: data.id,
          details: `Reassigned from ${previous.assigned_to_name ?? previous.assigned_to} to ${assignedTo}`,
        });
      }
      if (previous.status !== data.status) {
        await writeAudit(sql, {
          actorId: profile.user_id,
          actorName: profile.full_name,
          action: "status_changed",
          entity: "enquiry",
          entityId: data.id,
          details: `${previous.status} → ${data.status}`,
        });
      }
      await writeAudit(sql, {
        actorId: profile.user_id,
        actorName: profile.full_name,
        action: "enquiry_updated",
        entity: "enquiry",
        entityId: data.id,
        details: `Updated ${data.customer_name}`,
      });
      return { id: data.id };
    }

    const id = newId();
    await sql`
      insert into enquiries (
        id, enquiry_date, customer_name, mobile, village, vehicle,
        purchase_mode, expected_delivery, lead_source, status,
        next_follow_up, next_follow_up_time, assigned_to, created_by,
        estimated_value, exchange_required, exchange_vehicle, notes, is_demo
      ) values (
        ${id},
        ${data.enquiry_date},
        ${data.customer_name.trim()},
        ${mobile},
        ${data.village ?? ""},
        ${data.vehicle},
        ${data.purchase_mode},
        ${data.expected_delivery || null},
        ${data.lead_source},
        ${data.status},
        ${nextFollow},
        ${data.next_follow_up_time || null},
        ${assignedTo},
        ${profile.user_id},
        ${data.estimated_value ?? null},
        ${exchangeRequired},
        ${data.exchange_vehicle || null},
        ${data.notes || null},
        false
      )
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "enquiry_created",
      entity: "enquiry",
      entityId: id,
      details: `Created enquiry for ${data.customer_name} (${data.vehicle})`,
    });
    if (assignedTo && assignedTo !== profile.user_id) {
      await sql`
        insert into staff_assignment_history (id, enquiry_id, previous_staff, new_staff, changed_by)
        values (${newId()}, ${id}, ${null}, ${assignedTo}, ${profile.user_id})
      `;
    }
    return { id };
  });

export const deleteEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    const enquiry = await loadEnquiry(sql, profile, data.id);
    await sql`delete from enquiries where id = ${data.id}`;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "enquiry_deleted",
      entity: "enquiry",
      entityId: data.id,
      details: `Deleted ${enquiry.customer_name}`,
    });
    return { ok: true };
  });

export const updateEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ id: z.string(), status: z.enum(ENQUIRY_STATUSES) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const enquiry = await loadEnquiry(sql, profile, data.id);
    await sql`
      update enquiries set status = ${data.status}, updated_at = now()
      where id = ${data.id}
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "status_changed",
      entity: "enquiry",
      entityId: data.id,
      details: `${enquiry.status} → ${data.status}`,
    });
    return { ok: true };
  });

export const assignEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ id: z.string(), staffId: z.string() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    const enquiry = await loadEnquiry(sql, profile, data.id);
    const staff = await sql<{ user_id: string; full_name: string }>`
      select user_id, full_name from profiles where user_id = ${data.staffId} and active = true
    `;
    if (!staff[0]) throw new ForbiddenError("Staff account not found or inactive.");
    await sql`
      update enquiries set assigned_to = ${data.staffId}, updated_at = now() where id = ${data.id}
    `;
    await sql`
      insert into staff_assignment_history (id, enquiry_id, previous_staff, new_staff, changed_by)
      values (${newId()}, ${data.id}, ${enquiry.assigned_to}, ${data.staffId}, ${profile.user_id})
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "staff_assignment_changed",
      entity: "enquiry",
      entityId: data.id,
      details: `${enquiry.customer_name}: ${enquiry.assigned_to_name ?? "Unassigned"} → ${staff[0].full_name}`,
    });
    return { ok: true };
  });
