import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { newId } from "@/lib/utils";
import { ForbiddenError, requireCrmUser, requireOwner, writeAudit } from "./authz";
import type { StaffPerformance } from "./types";

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(72).optional(),
  role: z.enum(["owner", "staff"]).default("staff"),
});

export const listStaff = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);

    const people = await sql<{
      user_id: string;
      full_name: string;
      email: string | null;
      role: "owner" | "staff";
      active: boolean;
      created_at: string;
    }>`
      select user_id, full_name, email, role, active, created_at::text as created_at
      from profiles
      order by role asc, full_name asc
    `;

    const perf = await sql.query<StaffPerformance>(
      `select
         p.user_id,
         p.full_name,
         count(e.id)::int as total,
         count(e.id) filter (where e.status = 'Sold')::int as sold,
         count(e.id) filter (where e.status = 'Lost')::int as lost,
         (select count(*)::int from follow_ups f where f.staff_id = p.user_id and f.status = 'Completed') as "followUpsCompleted",
         (select count(*)::int from enquiries x
           where x.assigned_to = p.user_id and x.next_follow_up is not null
             and x.status not in ('Sold','Lost')) as "pendingFollowUps",
         0::float as conversion
       from profiles p
       left join enquiries e on e.assigned_to = p.user_id
       group by p.user_id, p.full_name`,
    );
    const map = new Map(perf.map((p) => [p.user_id, p]));

    return people.map((p) => {
      const s = map.get(p.user_id);
      const closed = (s?.sold ?? 0) + (s?.lost ?? 0);
      return {
        ...p,
        total: s?.total ?? 0,
        sold: s?.sold ?? 0,
        lost: s?.lost ?? 0,
        followUpsCompleted: s?.followUpsCompleted ?? 0,
        pendingFollowUps: s?.pendingFollowUps ?? 0,
        conversion: closed === 0 ? 0 : Math.round(((s?.sold ?? 0) / closed) * 1000) / 10,
      };
    });
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);

    const existing = await sql.query<{ id: string }>(
      `select id from "user" where lower(email) = $1`,
      [data.email],
    );
    if (existing[0]) throw new Error("That email is already registered.");

    const password = data.password?.trim() || randomPassword();
    const hashed = await hashPassword(password);
    const userId = newId();
    const now = new Date().toISOString();

    await sql.query(
      `insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
       values ($1, $2, $3, true, null, $4::timestamptz, $4::timestamptz)`,
      [userId, data.full_name, data.email, now],
    );
    await sql.query(
      `insert into account (
         id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
       ) values ($1, $2, 'credential', $3, $4, $5::timestamptz, $5::timestamptz)`,
      [newId(), userId, userId, hashed, now],
    );
    await sql`
      insert into profiles (user_id, full_name, email, role, active)
      values (${userId}, ${data.full_name}, ${data.email}, ${data.role}, true)
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "staff_account_created",
      entity: "profile",
      entityId: userId,
      details: `Created ${data.role} account for ${data.full_name} <${data.email}>`,
    });

    return { userId, email: data.email, temporaryPassword: password };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ userId: z.string(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    if (data.userId === profile.user_id) {
      throw new ForbiddenError("You cannot deactivate your own account.");
    }
    const target = await sql<{ user_id: string; role: string; full_name: string }>`
      select user_id, role, full_name from profiles where user_id = ${data.userId}
    `;
    if (!target[0]) throw new Error("Staff not found.");
    if (target[0].role === "owner" && !data.active) {
      const owners = await sql<{ n: number }>`
        select count(*)::int as n from profiles where role = 'owner' and active = true
      `;
      if ((owners[0]?.n ?? 0) <= 1) {
        throw new ForbiddenError("Cannot deactivate the last owner.");
      }
    }
    await sql`
      update profiles set active = ${data.active}, updated_at = now()
      where user_id = ${data.userId}
    `;
    if (!data.active) {
      await sql.query(`delete from "session" where "userId" = $1`, [data.userId]);
    }
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: data.active ? "staff_account_enabled" : "staff_account_disabled",
      entity: "profile",
      entityId: data.userId,
      details: `${data.active ? "Activated" : "Deactivated"} ${target[0].full_name}`,
    });
    return { ok: true };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ userId: z.string(), role: z.enum(["owner", "staff"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    if (data.userId === profile.user_id && data.role !== "owner") {
      const owners = await sql<{ n: number }>`
        select count(*)::int as n from profiles where role = 'owner' and active = true
      `;
      if ((owners[0]?.n ?? 0) <= 1) {
        throw new ForbiddenError("Cannot demote the last owner.");
      }
    }
    await sql`
      update profiles set role = ${data.role}, updated_at = now()
      where user_id = ${data.userId}
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "staff_role_changed",
      entity: "profile",
      entityId: data.userId,
      details: `Role set to ${data.role}`,
    });
    return { ok: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ userId: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    const target = await sql<{ full_name: string }>`
      select full_name from profiles where user_id = ${data.userId}
    `;
    if (!target[0]) throw new Error("Staff not found.");
    const password = randomPassword();
    const hashed = await hashPassword(password);
    const updated = await sql.query<{ id: string }>(
      `update account set password = $1, "updatedAt" = now()
       where "userId" = $2 and "providerId" = 'credential'
       returning id`,
      [hashed, data.userId],
    );
    if (!updated[0]) {
      await sql.query(
        `insert into account (
           id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
         ) values ($1, $2, 'credential', $3, $4, now(), now())`,
        [newId(), data.userId, data.userId, hashed],
      );
    }
    await sql.query(`delete from "session" where "userId" = $1`, [data.userId]);
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "staff_password_reset",
      entity: "profile",
      entityId: data.userId,
      details: `Password reset for ${target[0].full_name}`,
    });
    return { temporaryPassword: password };
  });
