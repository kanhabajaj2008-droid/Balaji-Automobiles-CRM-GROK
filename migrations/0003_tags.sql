-- Custom enquiry tags (e.g. Navratri, Exchange fair) for campaign lists.

create table if not exists tags (
  id          text primary key,
  name        text not null,
  name_key    text not null unique,
  created_by  text,
  created_at  timestamptz not null default now()
);

create table if not exists enquiry_tags (
  enquiry_id  text not null references enquiries (id) on delete cascade,
  tag_id      text not null references tags (id) on delete cascade,
  primary key (enquiry_id, tag_id)
);

create index if not exists enquiry_tags_tag_idx on enquiry_tags (tag_id);
