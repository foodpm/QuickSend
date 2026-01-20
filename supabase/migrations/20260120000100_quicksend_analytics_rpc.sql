create or replace function public.qs_analytics_insert_event(p_row jsonb)
returns void
language plpgsql
security definer
set search_path = public, quicksend_analytics
as $$
declare
  event_name text;
  installation_id text;
  session_id text;
  app_version text;
  platform text;
  is_frozen boolean;
  props jsonb;
begin
  if p_row is null then
    raise exception 'invalid_payload';
  end if;

  event_name := nullif(btrim(p_row->>'event_name'), '');
  installation_id := nullif(btrim(p_row->>'installation_id'), '');
  session_id := nullif(btrim(p_row->>'session_id'), '');
  app_version := nullif(btrim(p_row->>'app_version'), '');
  platform := nullif(btrim(p_row->>'platform'), '');
  is_frozen := (p_row->>'is_frozen')::boolean;
  props := coalesce(p_row->'props', '{}'::jsonb);

  if event_name is null then
    raise exception 'missing_event_name';
  end if;
  if installation_id is null then
    raise exception 'missing_installation_id';
  end if;
  if length(event_name) > 64 then
    raise exception 'event_name_too_long';
  end if;
  if length(installation_id) > 128 then
    raise exception 'installation_id_too_long';
  end if;
  if session_id is not null and length(session_id) > 128 then
    raise exception 'session_id_too_long';
  end if;
  if app_version is not null and length(app_version) > 32 then
    raise exception 'app_version_too_long';
  end if;
  if platform is not null and length(platform) > 16 then
    raise exception 'platform_too_long';
  end if;
  if jsonb_typeof(props) is distinct from 'object'::text then
    raise exception 'props_must_be_object';
  end if;
  if length(props::text) > 16000 then
    raise exception 'props_too_large';
  end if;
  if event_name not in ('install','app_open','file_upload','text_share') then
    raise exception 'invalid_event';
  end if;

  insert into quicksend_analytics.events_raw_v1 (
    event_name,
    installation_id,
    session_id,
    app_version,
    platform,
    is_frozen,
    props
  ) values (
    event_name,
    installation_id,
    session_id,
    app_version,
    platform,
    is_frozen,
    props
  );
end;
$$;

revoke all on function public.qs_analytics_insert_event(jsonb) from public;
grant execute on function public.qs_analytics_insert_event(jsonb) to anon, authenticated;
