import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireCrmUser, requireOwner, writeAudit } from "./authz";
import type { AuditRow, ShowroomSettings } from "./types";

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        showroom_name: z.string().trim().min(2).max(80),
        showroom_address: z.string().trim().max(240).default(""),
        phone: z.string().trim().max(20).default(""),
        default_follow_up_days: z.number().int().min(0).max(30),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ShowroomSettings> => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    await sql`
      update showroom_settings set
        showroom_name = ${data.showroom_name},
        showroom_address = ${data.showroom_address},
        phone = ${data.phone},
        default_follow_up_days = ${data.default_follow_up_days},
        updated_at = now(),
        updated_by = ${profile.user_id}
      where id = 1
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "settings_changed",
      entity: "settings",
      entityId: "1",
      details: `Updated showroom settings`,
    });
    return data;
  });

export const listAudit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().optional(),
        action: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<AuditRow[]> => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    const params: unknown[] = [];
    const where: string[] = [];
    if (data.q?.trim()) {
      params.push(`%${data.q.trim()}%`);
      const i = params.length;
      where.push(
        `(actor_name ilike $${i} or action ilike $${i} or details ilike $${i} or entity_id ilike $${i})`,
      );
    }
    if (data.action) {
      params.push(data.action);
      where.push(`action = $${params.length}`);
    }
    const clause = where.length ? `where ${where.join(" and ")}` : "";
    const limit = data.limit ?? 200;
    params.push(limit);
    return sql.query<AuditRow>(
      `select id, actor_id, actor_name, action, entity, entity_id, details,
              created_at::text as created_at
       from audit_log
       ${clause}
       order by created_at desc
       limit $${params.length}`,
      params,
    );
  });
