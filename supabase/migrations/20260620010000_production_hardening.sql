alter table app_settings
add column if not exists access_code_hash text;

create table if not exists rate_limits (
  key_hash text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_reset_at on rate_limits(reset_at);

create or replace function consume_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  current_reset timestamptz;
begin
  delete from rate_limits where reset_at <= now() and updated_at < now() - interval '1 day';

  insert into rate_limits (key_hash, attempt_count, reset_at, updated_at)
  values (p_key_hash, 1, now() + make_interval(secs => p_window_seconds), now())
  on conflict (key_hash) do update
  set attempt_count = case when rate_limits.reset_at <= now() then 1 else rate_limits.attempt_count + 1 end,
      reset_at = case when rate_limits.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else rate_limits.reset_at end,
      updated_at = now()
  returning attempt_count, reset_at into current_count, current_reset;

  return query select
    current_count <= p_limit,
    greatest(0, p_limit - current_count),
    greatest(1, ceil(extract(epoch from (current_reset - now())))::integer);
end;
$$;

revoke all on function consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, integer, integer) to service_role;

alter table sections enable row level security;
alter table students enable row level security;
alter table subjects enable row level security;
alter table subject_students enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
alter table app_settings enable row level security;
alter table subject_alert_settings enable row level security;
alter table sms_alerts enable row level security;
alter table rate_limits enable row level security;

select pg_notify('pgrst', 'reload schema');
