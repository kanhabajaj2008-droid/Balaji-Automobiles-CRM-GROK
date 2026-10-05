import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { newId } from "@/lib/utils";
import { loadEnquiry, requireCrmUser, requireOwner, writeAudit } from "./authz";
import type { Tag } from "./types";

function tagKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function replaceEnquiryTags(sql: Awaited<ReturnType<typeof requireCrmUser>>["sql"], enquiryId: string, tagIds: string[]) {
  const unique = [...new Set(tagIds.filter(Boolean))];
  await sql`delete from enquiry_tags where enquiry_id = ${enquiryId}`;
  for (const tagId of unique) {
    await sql`
      insert into enquiry_tags (enquiry_id, tag_id)
      values (${enquiryId}, ${tagId})
      on conflict do nothing
    `;
  }
}

export const listTags = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Tag[]> => {
    const { sql } = await requireCrmUser(context.userId);
    return sql<Tag>`
      select t.id, t.name, t.created_at::text as created_at,
             (select count(*)::int from enquiry_tags et where et.tag_id = t.id) as enquiry_count
      from tags t
      order by lower(t.name)
    `;
  });

export const createTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ name: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ context, data }): Promise<Tag> => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const name = data.name.trim().replace(/\s+/g, " ");
    if (name.length < 2) throw new Error("Tag name must be at least 2 characters.");
    const key = tagKey(name);
    const existing = await sql<Tag>`
      select t.id, t.name, t.created_at::text as created_at,
             (select count(*)::int from enquiry_tags et where et.tag_id = t.id) as enquiry_count
      from tags t where t.name_key = ${key} limit 1
    `;
    if (existing[0]) return existing[0];

    const id = newId();
    await sql`
      insert into tags (id, name, name_key, created_by)
      values (${id}, ${name}, ${key}, ${profile.user_id})
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "tag_created",
      entity: "tag",
      entityId: id,
      details: `Created tag ${name}`,
    });
    return { id, name, created_at: new Date().toISOString(), enquiry_count: 0 };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    requireOwner(profile);
    const rows = await sql<{ name: string }>`select name from tags where id = ${data.id}`;
    await sql`delete from tags where id = ${data.id}`;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "tag_deleted",
      entity: "tag",
      entityId: data.id,
      details: `Deleted tag ${rows[0]?.name ?? data.id}`,
    });
    return { ok: true };
  });

export const setEnquiryTags = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ enquiryId: z.string().min(1), tagIds: z.array(z.string()) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const enquiry = await loadEnquiry(sql, profile, data.enquiryId);
    await replaceEnquiryTags(sql, data.enquiryId, data.tagIds);
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "enquiry_tags_updated",
      entity: "enquiry",
      entityId: data.enquiryId,
      details: `Tags updated for ${enquiry.customer_name}`,
    });
    return { ok: true };
  });
