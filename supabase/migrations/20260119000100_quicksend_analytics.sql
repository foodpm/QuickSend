create schema if not exists quicksend_analytics;

create table if not exists quicksend_analytics.events_raw_v1 (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event_name text not null,
  installation_id text not null,
  session_id text,
  app_version text,
  platform text,
  is_frozen boolean,
  props jsonb not null default '{}'::jsonb
);

alter table quicksend_analytics.events_raw_v1 enable row level security;

revoke all on schema quicksend_analytics from public;
revoke all on table quicksend_analytics.events_raw_v1 from public;

grant usage on schema quicksend_analytics to anon, authenticated;
grant insert on table quicksend_analytics.events_raw_v1 to anon, authenticated;
grant usage, select on sequence quicksend_analytics.events_raw_v1_id_seq to anon, authenticated;

drop policy if exists allow_insert_only on quicksend_analytics.events_raw_v1;
create policy allow_insert_only
on quicksend_analytics.events_raw_v1
for insert
to anon, authenticated
with check (true);

