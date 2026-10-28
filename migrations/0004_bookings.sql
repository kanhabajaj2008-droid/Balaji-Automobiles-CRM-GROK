-- Shared booking register. Owner and staff can both read and write.

create table if not exists bookings (
  id              text primary key,
  booking_date    date not null default current_date,
  customer_name   text not null,
  mobile          text not null,
  city            text not null default '',
  vehicle         text not null,
  amount          numeric(12,2) not null default 0,
  delivery_date   date,
  occasion        text not null default '',
  notes           text,
  created_by      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bookings_booking_date_idx on bookings (booking_date);
create index if not exists bookings_delivery_date_idx on bookings (delivery_date);
create index if not exists bookings_mobile_idx on bookings (mobile);
create index if not exists bookings_occasion_idx on bookings (occasion);
