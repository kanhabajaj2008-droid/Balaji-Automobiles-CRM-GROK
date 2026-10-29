-- Indexes only. No rows are changed or deleted.

create index if not exists enquiries_updated_at_idx on enquiries (updated_at desc);
create index if not exists enquiries_open_follow_idx on enquiries (next_follow_up)
  where next_follow_up is not null and status not in ('Sold', 'Lost');
create index if not exists follow_ups_enquiry_idx on follow_ups (enquiry_id);
create index if not exists audit_log_entity_idx on audit_log (entity_id, created_at desc);
