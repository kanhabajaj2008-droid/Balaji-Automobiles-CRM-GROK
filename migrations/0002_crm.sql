-- BALAJI AUTOMOBILES CRM schema
-- Authorization is enforced in server functions (authMiddleware + role checks).
-- The app never exposes the database to the browser.

create table if not exists profiles (
  user_id     text primary key,
  full_name   text not null,
  email       text,
  role        text not null check (role in ('owner', 'staff')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles (role);
create index if not exists profiles_active_idx on profiles (active);

create table if not exists showroom_settings (
  id                       integer primary key check (id = 1),
  showroom_name            text not null default 'BALAJI AUTOMOBILES',
  showroom_address         text not null default '',
  phone                    text not null default '',
  default_follow_up_days   integer not null default 2,
  updated_at               timestamptz not null default now(),
  updated_by               text
);

insert into showroom_settings (id, showroom_name, showroom_address, phone)
values (1, 'BALAJI AUTOMOBILES', 'Hero MotoCorp Authorised Dealer', '')
on conflict (id) do nothing;

create table if not exists enquiries (
  id                   text primary key,
  enquiry_date         date not null default current_date,
  customer_name        text not null,
  mobile               text not null,
  village              text not null default '',
  vehicle              text not null,
  purchase_mode        text not null check (purchase_mode in ('Cash', 'Finance', 'Exchange', 'Cash + Exchange')),
  expected_delivery    date,
  lead_source          text not null check (lead_source in ('Walk-in', 'Phone', 'Reference', 'Online', 'Existing Customer', 'Other')),
  status               text not null check (status in ('New', 'Follow-up', 'Interested', 'Negotiation', 'Booked', 'Sold', 'Lost')),
  next_follow_up       date,
  next_follow_up_time  text,
  assigned_to          text,
  created_by           text not null,
  estimated_value      numeric(12,2),
  exchange_required    boolean not null default false,
  exchange_vehicle     text,
  notes                text,
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists enquiries_assigned_to_idx on enquiries (assigned_to);
create index if not exists enquiries_created_by_idx on enquiries (created_by);
create index if not exists enquiries_status_idx on enquiries (status);
create index if not exists enquiries_mobile_idx on enquiries (mobile);
create index if not exists enquiries_next_follow_up_idx on enquiries (next_follow_up);
create index if not exists enquiries_enquiry_date_idx on enquiries (enquiry_date);
create index if not exists enquiries_vehicle_idx on enquiries (vehicle);
create index if not exists enquiries_customer_name_idx on enquiries (customer_name);

create table if not exists follow_ups (
  id                    text primary key,
  enquiry_id            text not null references enquiries (id) on delete cascade,
  staff_id              text not null,
  follow_up_date        date not null,
  follow_up_time        text,
  status                text not null check (status in (
    'Pending', 'Completed', 'No Response', 'Interested',
    'Not Interested', 'Call Later', 'Booked', 'Lost'
  )),
  notes                 text,
  next_follow_up_date   date,
  next_follow_up_time   text,
  created_at            timestamptz not null default now()
);

create index if not exists follow_ups_enquiry_id_idx on follow_ups (enquiry_id);
create index if not exists follow_ups_staff_id_idx on follow_ups (staff_id);
create index if not exists follow_ups_date_idx on follow_ups (follow_up_date);
create index if not exists follow_ups_status_idx on follow_ups (status);

create table if not exists staff_assignment_history (
  id              text primary key,
  enquiry_id      text not null references enquiries (id) on delete cascade,
  previous_staff  text,
  new_staff       text,
  changed_by      text not null,
  changed_at      timestamptz not null default now()
);

create index if not exists staff_assignment_enquiry_idx on staff_assignment_history (enquiry_id);

create table if not exists audit_log (
  id          text primary key,
  actor_id    text,
  actor_name  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on audit_log (created_at desc);
create index if not exists audit_log_actor_idx on audit_log (actor_id);
create index if not exists audit_log_entity_idx on audit_log (entity, entity_id);
