import { getSql, type Sql } from "@/lib/db";
import { newId } from "@/lib/utils";
import type { Enquiry, Profile, ShowroomSettings } from "./types";
import { seedDemoEnquiries } from "./seed";

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

type UserRow = { id: string; name: string; email: string };

export async function requireCrmUser(userId: string): Promise<{
  sql: Sql;
  profile: Profile;
  settings: ShowroomSettings;
}> {
  const sql = await getSql();
  await bootstrapOwnerIfNeeded(sql, userId);

  const rows = await sql<Profile>`
    select user_id, full_name, email, role, active,
           created_at::text as created_at, updated_at::text as updated_at
    from profiles
    where user_id = ${userId}
  `;
  const profile = rows[0];
  if (!profile) {
    throw new ForbiddenError(
      "This account is not on the showroom team. Ask the owner to add you as staff.",
    );
  }
  if (!profile.active) {
    throw new ForbiddenError("Your account has been deactivated. Contact the owner.");
  }

  const settingsRows = await sql<ShowroomSettings>`
    select showroom_name, showroom_address, phone, default_follow_up_days
    from showroom_settings where id = 1
  `;
  const settings = settingsRows[0] ?? {
    showroom_name: "BALAJI AUTOMOBILES",
    showroom_address: "",
    phone: "",
    default_follow_up_days: 2,
  };

  return { sql, profile, settings };
}

async function bootstrapOwnerIfNeeded(sql: Sql, userId: string) {
  const mine = await sql<{ user_id: string }>`
    select user_id from profiles where user_id = ${userId} limit 1
  `;
  if (mine[0]) return;

  const authUser = await lookupAuthUser(sql, userId);
  const email = authUser.email?.trim().toLowerCase() || null;

  if (email) {
    const same = await sql<{ user_id: string }>`
      select user_id from profiles where lower(coalesce(email, '')) = ${email} limit 1
    `;
    if (same[0] && same[0].user_id !== userId) {
      await transferProfileIdentity(
        sql,
        same[0].user_id,
        userId,
        authUser.name,
        authUser.email,
      );
      await writeAudit(sql, {
        actorId: userId,
        actorName: authUser.name?.trim() || "Owner",
        action: "owner_identity_linked",
        entity: "profile",
        entityId: userId,
        details: "Signed-in Google/X account linked to the existing owner profile",
      });
      return;
    }
  }

  const owners = await sql<{ user_id: string; email: string | null }>`
    select user_id, email from profiles where role = 'owner' and active = true
  `;

  if (owners.length === 0) {
    const fullName = authUser.name?.trim() || "Owner";
    await sql`
      insert into profiles (user_id, full_name, email, role, active)
      values (${userId}, ${fullName}, ${authUser.email ?? null}, 'owner', true)
    `;
    await writeAudit(sql, {
      actorId: userId,
      actorName: fullName,
      action: "owner_bootstrapped",
      entity: "profile",
      entityId: userId,
      details: "First signed-in user became the showroom owner",
    });
    try {
      await seedDemoEnquiries(sql, userId, fullName);
    } catch (err) {
      console.error("[crm] demo seed failed", err);
    }
    return;
  }

  if (owners.length === 1) {
    const owner = owners[0];
    const ownerAuth = await lookupAuthUser(sql, owner.user_id);
    const ownerHasOAuth = ownerAuth.providers.some(
      (p) => p === "grok-google" || p === "grok-x",
    );
    const real = await sql<{ n: number }>`
      select count(*)::int as n from enquiries where is_demo = false
    `;
    const setupPhase = (real[0]?.n ?? 0) === 0;
    const canAdopt =
      !ownerHasOAuth &&
      (isTestEmail(owner.email) || isPreviewIdentity(ownerAuth.providers) || setupPhase);

    if (canAdopt) {
      await transferProfileIdentity(
        sql,
        owner.user_id,
        userId,
        authUser.name,
        authUser.email,
      );
      await writeAudit(sql, {
        actorId: userId,
        actorName: authUser.name?.trim() || "Owner",
        action: "owner_identity_claimed",
        entity: "profile",
        entityId: userId,
        details: "Owner profile moved to this signed-in Google/X account",
      });
    }
  }
}

async function lookupAuthUser(
  sql: Sql,
  userId: string,
): Promise<{ name: string | null; email: string | null; providers: string[] }> {
  try {
    const users = await sql.query<UserRow>(
      `select id, name, email from "user" where id = $1`,
      [userId],
    );
    const accounts = await sql.query<{ providerId: string }>(
      `select "providerId" from account where "userId" = $1`,
      [userId],
    );
    return {
      name: users[0]?.name ?? null,
      email: users[0]?.email ?? null,
      providers: accounts.map((a) => a.providerId),
    };
  } catch {
    return { name: null, email: null, providers: [] };
  }
}

function isTestEmail(email: string | null): boolean {
  if (!email) return true;
  const value = email.toLowerCase();
  return (
    value.endsWith(".test") ||
    value.endsWith(".example") ||
    value.includes("balajiautomobiles.test")
  );
}

function isPreviewIdentity(providers: string[]): boolean {
  if (providers.length === 0) return true;
  return providers.every((p) => p === "credential" || p === "grok-gate");
}

async function transferProfileIdentity(
  sql: Sql,
  fromId: string,
  toId: string,
  name: string | null,
  email: string | null,
) {
  if (fromId === toId) return;
  await sql.query(`update enquiries set assigned_to = $1 where assigned_to = $2`, [toId, fromId]);
  await sql.query(`update enquiries set created_by = $1 where created_by = $2`, [toId, fromId]);
  await sql.query(`update follow_ups set staff_id = $1 where staff_id = $2`, [toId, fromId]);
  await sql.query(
    `update staff_assignment_history set previous_staff = $1 where previous_staff = $2`,
    [toId, fromId],
  );
  await sql.query(
    `update staff_assignment_history set new_staff = $1 where new_staff = $2`,
    [toId, fromId],
  );
  await sql.query(
    `update staff_assignment_history set changed_by = $1 where changed_by = $2`,
    [toId, fromId],
  );
  await sql.query(`update audit_log set actor_id = $1 where actor_id = $2`, [toId, fromId]);
  await sql.query(
    `update showroom_settings set updated_by = $1 where updated_by = $2`,
    [toId, fromId],
  );
  await sql.query(
    `update profiles
        set user_id = $1,
            full_name = coalesce(nullif($2, ''), full_name),
            email = coalesce(nullif($3, ''), email),
            updated_at = now()
      where user_id = $4`,
    [toId, name?.trim() ?? "", email?.trim() ?? "", fromId],
  );
}

export function requireOwner(profile: Profile) {
  if (profile.role !== "owner") {
    throw new ForbiddenError("Only the owner can access this.");
  }
}

export function canAccessEnquiry(profile: Profile, enquiry: { assigned_to: string | null; created_by: string }) {
  if (profile.role === "owner") return true;
  return enquiry.assigned_to === profile.user_id || enquiry.created_by === profile.user_id;
}

export async function loadEnquiry(
  sql: Sql,
  profile: Profile,
  id: string,
): Promise<Enquiry> {
  const rows = await sql<RawEnquiry>`
    select
      e.id,
      e.enquiry_date::text as enquiry_date,
      e.customer_name,
      e.mobile,
      e.village,
      e.vehicle,
      e.purchase_mode,
      e.expected_delivery::text as expected_delivery,
      e.lead_source,
      e.status,
      e.next_follow_up::text as next_follow_up,
      e.next_follow_up_time,
      e.assigned_to,
      ap.full_name as assigned_to_name,
      e.created_by,
      cp.full_name as created_by_name,
      e.estimated_value::text as estimated_value,
      e.exchange_required,
      e.exchange_vehicle,
      e.notes,
      e.is_demo,
      e.created_at::text as created_at,
      e.updated_at::text as updated_at
    from enquiries e
    left join profiles ap on ap.user_id = e.assigned_to
    left join profiles cp on cp.user_id = e.created_by
    where e.id = ${id}
  `;
  const raw = rows[0];
  if (!raw) throw new NotFoundError("Enquiry not found");
  const enquiry = mapEnquiry(raw);
  if (!canAccessEnquiry(profile, enquiry)) {
    throw new NotFoundError("Enquiry not found");
  }
  return enquiry;
}

type RawEnquiry = Omit<Enquiry, "estimated_value"> & { estimated_value: string | number | null };

export function mapEnquiry(raw: RawEnquiry): Enquiry {
  return {
    ...raw,
    estimated_value:
      raw.estimated_value == null || raw.estimated_value === ""
        ? null
        : Number(raw.estimated_value),
    exchange_required: Boolean(raw.exchange_required),
    is_demo: Boolean(raw.is_demo),
  };
}

export const ENQUIRY_SELECT = `
    e.id,
    e.enquiry_date::text as enquiry_date,
    e.customer_name,
    e.mobile,
    e.village,
    e.vehicle,
    e.purchase_mode,
    e.expected_delivery::text as expected_delivery,
    e.lead_source,
    e.status,
    e.next_follow_up::text as next_follow_up,
    e.next_follow_up_time,
    e.assigned_to,
    ap.full_name as assigned_to_name,
    e.created_by,
    cp.full_name as created_by_name,
    e.estimated_value::text as estimated_value,
    e.exchange_required,
    e.exchange_vehicle,
    e.notes,
    e.is_demo,
    e.created_at::text as created_at,
    e.updated_at::text as updated_at
`;

export async function writeAudit(
  sql: Sql,
  input: {
    actorId: string | null;
    actorName: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    details?: string | null;
  },
) {
  await sql`
    insert into audit_log (id, actor_id, actor_name, action, entity, entity_id, details)
    values (
      ${newId()},
      ${input.actorId},
      ${input.actorName},
      ${input.action},
      ${input.entity},
      ${input.entityId ?? null},
      ${input.details ?? null}
    )
  `;
}

export async function listStaffOptions(sql: Sql): Promise<
  { user_id: string; full_name: string; email: string | null; role: "owner" | "staff"; active: boolean }[]
> {
  return sql`
    select user_id, full_name, email, role, active
    from profiles
    order by role asc, full_name asc
  `;
}
