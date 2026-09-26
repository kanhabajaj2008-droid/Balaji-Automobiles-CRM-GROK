import type { Sql } from "@/lib/db";
import { addDaysIso, newId, todayIso } from "@/lib/utils";

type Demo = {
  name: string;
  mobile: string;
  village: string;
  vehicle: string;
  mode: string;
  source: string;
  status: string;
  followOffset: number | null;
  value: number;
  exchange?: string;
  notes: string;
  followNote?: string;
};

const DEMOS: Demo[] = [
  {
    name: "Rahul Sharma",
    mobile: "9876501001",
    village: "Sitapura",
    vehicle: "Splendor Plus",
    mode: "Finance",
    source: "Walk-in",
    status: "Follow-up",
    followOffset: -4,
    value: 89000,
    notes: "Asked for 24-month finance. Waiting on ID proof.",
    followNote: "Called, no answer. Try evening.",
  },
  {
    name: "Amit Verma",
    mobile: "9876501002",
    village: "Jagatpura",
    vehicle: "Xtreme 125R",
    mode: "Cash",
    source: "Phone",
    status: "Interested",
    followOffset: 0,
    value: 112000,
    notes: "Wants red colour. Comparing with Honda Shine.",
    followNote: "Today: confirm test ride slot.",
  },
  {
    name: "Priya Patel",
    mobile: "9876501003",
    village: "Mansarovar",
    vehicle: "Destini 125",
    mode: "Exchange",
    source: "Reference",
    status: "Negotiation",
    followOffset: 2,
    value: 98000,
    exchange: "Activa 5G, 2019, ~38,000 km",
    notes: "Exchange quote pending from workshop.",
  },
  {
    name: "Suresh Kumar",
    mobile: "9876501004",
    village: "Tonk Road",
    vehicle: "HF Deluxe",
    mode: "Cash",
    source: "Walk-in",
    status: "Sold",
    followOffset: null,
    value: 72000,
    notes: "Delivered. RC applied.",
  },
  {
    name: "Anjali Singh",
    mobile: "9876501005",
    village: "Vaishali Nagar",
    vehicle: "Glamour",
    mode: "Finance",
    source: "Online",
    status: "Lost",
    followOffset: null,
    value: 95000,
    notes: "Bought from another dealer on a festival offer.",
  },
  {
    name: "Vikram Joshi",
    mobile: "9876501006",
    village: "Chaksu",
    vehicle: "Xpulse 200 4V",
    mode: "Finance",
    source: "Walk-in",
    status: "Negotiation",
    followOffset: 1,
    value: 158000,
    notes: "Wants accessories pack in the deal.",
  },
  {
    name: "Meena Devi",
    mobile: "9876501007",
    village: "Phulera",
    vehicle: "Pleasure+ Xtec",
    mode: "Cash + Exchange",
    source: "Existing Customer",
    status: "Follow-up",
    followOffset: -1,
    value: 84000,
    exchange: "Pleasure 2016",
    notes: "Husband will visit on Sunday.",
  },
  {
    name: "Arjun Reddy",
    mobile: "9876501008",
    village: "Malviya Nagar",
    vehicle: "Super Splendor",
    mode: "Finance",
    source: "Phone",
    status: "Booked",
    followOffset: 3,
    value: 92000,
    notes: "Booking amount received. Waiting for black colour.",
  },
  {
    name: "Kavita Nair",
    mobile: "9876501009",
    village: "C-Scheme",
    vehicle: "Maestro Edge 125",
    mode: "Cash",
    source: "Online",
    status: "Interested",
    followOffset: 4,
    value: 91000,
    notes: "Requested home test ride.",
  },
  {
    name: "Ramesh Yadav",
    mobile: "9876501010",
    village: "Dausa",
    vehicle: "Passion Plus",
    mode: "Finance",
    source: "Walk-in",
    status: "New",
    followOffset: 1,
    value: 86000,
    notes: "First visit. Shared brochure.",
  },
  {
    name: "Deepak Shah",
    mobile: "9876501011",
    village: "Ajmer Road",
    vehicle: "Xtreme 160R",
    mode: "Finance",
    source: "Reference",
    status: "Follow-up",
    followOffset: -7,
    value: 139000,
    notes: "Loan under review at bank.",
    followNote: "Overdue: check bank status.",
  },
  {
    name: "Sunita Rao",
    mobile: "9876501012",
    village: "Sanganer",
    vehicle: "Splendor Plus",
    mode: "Exchange",
    source: "Walk-in",
    status: "Interested",
    followOffset: 0,
    value: 88000,
    exchange: "Splendor 2014, papers clear",
    notes: "Wants delivery before Navratri.",
  },
  {
    name: "Farhan Ali",
    mobile: "9876501013",
    village: "Bhiwadi",
    vehicle: "Karizma XMR",
    mode: "Cash",
    source: "Online",
    status: "New",
    followOffset: 5,
    value: 193000,
    notes: "Enquired on Instagram. Wants demo ride.",
  },
  {
    name: "Pooja Iyer",
    mobile: "9876501014",
    village: "Bani Park",
    vehicle: "Vida V1 Plus",
    mode: "Finance",
    source: "Phone",
    status: "Booked",
    followOffset: 6,
    value: 145000,
    notes: "Electric — charging query resolved. Booking done.",
  },
];

async function seedAudit(
  sql: Sql,
  actorId: string,
  actorName: string,
  action: string,
  entityId: string,
  details: string,
) {
  await sql`
    insert into audit_log (id, actor_id, actor_name, action, entity, entity_id, details)
    values (${newId()}, ${actorId}, ${actorName}, ${action}, ${"enquiry"}, ${entityId}, ${details})
  `;
}

export async function seedDemoEnquiries(sql: Sql, ownerId: string, ownerName: string) {
  const existing = await sql<{ n: number }>`select count(*)::int as n from enquiries`;
  if ((existing[0]?.n ?? 0) > 0) return;

  const today = todayIso();

  for (const [i, d] of DEMOS.entries()) {
    const id = newId();
    const enquiryDate = addDaysIso(today, -18 + i);
    const follow = d.followOffset == null ? null : addDaysIso(today, d.followOffset);
    const followTime = follow ? (i % 2 === 0 ? "11:00" : "17:30") : null;
    await sql`
      insert into enquiries (
        id, enquiry_date, customer_name, mobile, village, vehicle,
        purchase_mode, expected_delivery, lead_source, status,
        next_follow_up, next_follow_up_time, assigned_to, created_by,
        estimated_value, exchange_required, exchange_vehicle, notes, is_demo
      ) values (
        ${id},
        ${enquiryDate},
        ${d.name},
        ${d.mobile},
        ${d.village},
        ${d.vehicle},
        ${d.mode},
        ${d.status === "Booked" || d.status === "Sold" ? addDaysIso(today, 7) : null},
        ${d.source},
        ${d.status},
        ${follow},
        ${followTime},
        ${ownerId},
        ${ownerId},
        ${d.value},
        ${Boolean(d.exchange)},
        ${d.exchange ?? null},
        ${d.notes},
        true
      )
    `;

    await seedAudit(sql, ownerId, ownerName, "enquiry_created", id, `Demo enquiry for ${d.name} (${d.vehicle})`);

    if (d.followNote && follow) {
      await sql`
        insert into follow_ups (
          id, enquiry_id, staff_id, follow_up_date, follow_up_time,
          status, notes, next_follow_up_date, next_follow_up_time
        ) values (
          ${newId()},
          ${id},
          ${ownerId},
          ${addDaysIso(follow, -2)},
          ${"10:30"},
          ${d.followOffset != null && d.followOffset < 0 ? "No Response" : "Completed"},
          ${d.followNote},
          ${follow},
          ${followTime}
        )
      `;
    }

    if (d.status === "Sold" || d.status === "Lost" || d.status === "Booked") {
      await seedAudit(sql, ownerId, ownerName, "status_changed", id, `Status set to ${d.status}`);
    }
  }
}
