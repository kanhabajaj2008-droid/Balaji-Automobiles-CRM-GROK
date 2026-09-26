import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { listStaffOptions, requireCrmUser, writeAudit } from "./authz";
import type { SessionInfo } from "./types";

export const getBootstrapState = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from profiles where role = 'owner'
    `;
    return { ownerExists: (rows[0]?.n ?? 0) > 0 };
  } catch {
    return { ownerExists: false };
  }
});

export const getSessionInfo = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SessionInfo> => {
    try {
      const { sql, profile, settings } = await requireCrmUser(context.userId);

      try {
        const recent = await sql<{ n: number }>`
          select count(*)::int as n from audit_log
          where actor_id = ${profile.user_id}
            and action = 'login'
            and created_at > now() - interval '6 hours'
        `;
        if ((recent[0]?.n ?? 0) === 0) {
          await writeAudit(sql, {
            actorId: profile.user_id,
            actorName: profile.full_name,
            action: "login",
            entity: "session",
            entityId: profile.user_id,
            details: "Signed in",
          });
        }
      } catch {
        /* login audit is best-effort */
      }

      const staff = profile.role === "owner" ? await listStaffOptions(sql) : [];
      return { profile, settings, staff, ownerExists: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Access denied";
      throw new Error(message);
    }
  });

export const recordLogout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const { sql, profile } = await requireCrmUser(context.userId);
      await writeAudit(sql, {
        actorId: profile.user_id,
        actorName: profile.full_name,
        action: "logout",
        entity: "session",
        entityId: profile.user_id,
        details: "Signed out",
      });
    } catch {
      /* deactivated users may still sign out */
    }
    return { ok: true };
  });
