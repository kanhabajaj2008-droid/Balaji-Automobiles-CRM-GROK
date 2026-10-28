import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { isValidMobile, newId, normalizeMobile } from "@/lib/utils";
import { requireCrmUser, writeAudit } from "./authz";
import type { Booking } from "./types";

const filtersSchema = z.object({
  q: z.string().optional(),
  occasion: z.string().optional(),
  vehicle: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const bookingInput = z.object({
  id: z.string().optional(),
  booking_date: z.string().min(8),
  customer_name: z.string().trim().min(2).max(120),
  mobile: z.string().min(8),
  city: z.string().trim().max(120).default(""),
  vehicle: z.string().trim().min(1).max(80),
  amount: z.number().nonnegative(),
  delivery_date: z.string().nullable().optional(),
  occasion: z.string().trim().max(80).default(""),
  notes: z.string().nullable().optional(),
});

type BookingRow = Omit<Booking, "amount"> & { amount: number | string };

function mapBooking(row: BookingRow): Booking {
  return { ...row, amount: Number(row.amount) };
}

const SELECT = `
  b.id,
  b.booking_date::text as booking_date,
  b.customer_name,
  b.mobile,
  b.city,
  b.vehicle,
  b.amount,
  b.delivery_date::text as delivery_date,
  b.occasion,
  b.notes,
  b.created_by,
  p.full_name as created_by_name,
  b.created_at::text as created_at,
  b.updated_at::text as updated_at
`;

export const listBookings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => filtersSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const { sql } = await requireCrmUser(context.userId);
    const params: unknown[] = [];
    const where: string[] = [];

    if (data.q?.trim()) {
      params.push(`%${data.q.trim()}%`);
      const i = params.length;
      where.push(
        `(b.customer_name ilike $${i} OR b.mobile ilike $${i} OR b.city ilike $${i} OR b.vehicle ilike $${i} OR b.occasion ilike $${i})`,
      );
    }
    if (data.occasion) {
      params.push(data.occasion);
      where.push(`b.occasion = $${params.length}`);
    }
    if (data.vehicle) {
      params.push(data.vehicle);
      where.push(`b.vehicle = $${params.length}`);
    }
    if (data.from) {
      params.push(data.from);
      where.push(`b.booking_date >= $${params.length}`);
    }
    if (data.to) {
      params.push(data.to);
      where.push(`b.booking_date <= $${params.length}`);
    }

    const clause = where.length ? `where ${where.join(" and ")}` : "";
    const rows = await sql.query<BookingRow>(
      `select ${SELECT}
       from bookings b
       left join profiles p on p.user_id = b.created_by
       ${clause}
       order by b.booking_date desc, b.created_at desc`,
      params,
    );
    const occasions = await sql<{ occasion: string }>`
      select distinct occasion from bookings
      where occasion <> ''
      order by occasion
    `;
    return {
      rows: rows.map(mapBooking),
      occasions: occasions.map((o) => o.occasion),
    };
  });

export const saveBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => bookingInput.parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const mobile = normalizeMobile(data.mobile);
    if (!isValidMobile(mobile)) {
      throw new Error("Enter a valid 10-digit Indian mobile number.");
    }
    const id = data.id || newId();
    const city = data.city?.trim() ?? "";
    const occasion = data.occasion?.trim() ?? "";
    const notes = data.notes?.trim() || null;
    const delivery = data.delivery_date || null;

    if (data.id) {
      const existing = await sql<{ id: string }>`select id from bookings where id = ${data.id}`;
      if (!existing[0]) throw new Error("Booking not found.");
      await sql`
        update bookings set
          booking_date = ${data.booking_date},
          customer_name = ${data.customer_name.trim()},
          mobile = ${mobile},
          city = ${city},
          vehicle = ${data.vehicle.trim()},
          amount = ${data.amount},
          delivery_date = ${delivery},
          occasion = ${occasion},
          notes = ${notes},
          updated_at = now()
        where id = ${data.id}
      `;
      await writeAudit(sql, {
        actorId: profile.user_id,
        actorName: profile.full_name,
        action: "booking_updated",
        entity: "booking",
        entityId: data.id,
        details: `${data.customer_name.trim()} · ${mobile} · ₹${data.amount}`,
      });
      return { id: data.id };
    }

    await sql`
      insert into bookings (
        id, booking_date, customer_name, mobile, city, vehicle,
        amount, delivery_date, occasion, notes, created_by
      ) values (
        ${id}, ${data.booking_date}, ${data.customer_name.trim()}, ${mobile}, ${city},
        ${data.vehicle.trim()}, ${data.amount}, ${delivery}, ${occasion}, ${notes},
        ${profile.user_id}
      )
    `;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "booking_created",
      entity: "booking",
      entityId: id,
      details: `${data.customer_name.trim()} · ${mobile} · ₹${data.amount} · ${occasion || "no occasion"}`,
    });
    return { id };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    const { sql, profile } = await requireCrmUser(context.userId);
    const rows = await sql<{ customer_name: string; mobile: string }>`
      select customer_name, mobile from bookings where id = ${data.id}
    `;
    if (!rows[0]) throw new Error("Booking not found.");
    await sql`delete from bookings where id = ${data.id}`;
    await writeAudit(sql, {
      actorId: profile.user_id,
      actorName: profile.full_name,
      action: "booking_deleted",
      entity: "booking",
      entityId: data.id,
      details: `${rows[0].customer_name} · ${rows[0].mobile}`,
    });
    return { ok: true };
  });
