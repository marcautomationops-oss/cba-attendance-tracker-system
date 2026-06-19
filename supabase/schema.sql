create extension if not exists "pgcrypto";

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_number text unique not null,
  full_name text not null,
  section text,
  contact_number text,
  profile_photo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table students
add column if not exists contact_number text;

alter table students
add column if not exists profile_photo_path text;

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(section_id, name)
);

create table if not exists subject_students (
  subject_id uuid not null references subjects(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subject_id, student_id)
);

create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text unique not null,
  section_id uuid references sections(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  class_name text not null,
  subject text,
  section text,
  session_date date not null,
  start_time timestamptz not null,
  cutoff_time timestamptz not null,
  close_time timestamptz not null,
  created_at timestamptz not null default now(),
  constraint attendance_session_cutoff_after_start check (cutoff_time >= start_time),
  constraint attendance_session_close_after_cutoff check (close_time >= cutoff_time)
);

alter table attendance_sessions
add column if not exists section_id uuid references sections(id) on delete set null;

alter table attendance_sessions
add column if not exists subject_id uuid references subjects(id) on delete set null;

alter table attendance_sessions
add column if not exists close_time timestamptz;

update attendance_sessions
set close_time = cutoff_time
where close_time is null;

alter table attendance_sessions
alter column close_time set not null;

alter table attendance_sessions
drop constraint if exists attendance_session_close_after_cutoff;

alter table attendance_sessions
add constraint attendance_session_close_after_cutoff check (close_time >= cutoff_time);

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  submitted_at timestamptz default now(),
  status text not null check (status in ('on_time', 'late', 'absent', 'sick', 'leave', 'excused')),
  photo_path text,
  photo_deleted_at timestamptz,
  notes text,
  manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, student_id)
);

alter table attendance_records
add column if not exists photo_deleted_at timestamptz;

alter table attendance_records
alter column submitted_at drop not null;

create table if not exists app_settings (
  id integer primary key default 1 check (id = 1),
  semaphore_api_key text,
  semaphore_sender_name text,
  default_late_limit integer not null default 3,
  default_absent_limit integer not null default 2,
  default_automatic_sms boolean not null default false,
  proof_retention_days integer not null default 180,
  storage_warning_mb integer not null default 750,
  access_code_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists subject_alert_settings (
  subject_id uuid primary key references subjects(id) on delete cascade,
  automatic_sms boolean not null default false,
  late_limit integer not null default 3,
  absent_limit integer not null default 2,
  late_template text,
  absent_template text,
  late_milestones integer[] not null default array[3,5,7],
  absent_milestones integer[] not null default array[2,4,6],
  alert_period_start timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subject_alert_settings
add column if not exists late_template text;

alter table subject_alert_settings
add column if not exists absent_template text;

alter table subject_alert_settings
add column if not exists late_milestones integer[] not null default array[3,5,7];

alter table subject_alert_settings
add column if not exists absent_milestones integer[] not null default array[2,4,6];

create table if not exists sms_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('late', 'absent')),
  threshold integer not null,
  phone_number text,
  message text not null,
  sent_at timestamptz,
  provider_status text,
  alert_period_start timestamptz not null,
  created_at timestamptz not null default now(),
  unique(student_id, subject_id, trigger_type, threshold, alert_period_start)
);

alter table sms_alerts
drop constraint if exists sms_alerts_student_id_subject_id_trigger_type_alert_period_start_key;

alter table sms_alerts
drop constraint if exists sms_alerts_student_id_subject_id_trigger_type_threshold_alert_period_start_key;

alter table sms_alerts
add constraint sms_alerts_student_id_subject_id_trigger_type_threshold_alert_period_start_key
unique(student_id, subject_id, trigger_type, threshold, alert_period_start);

create index if not exists idx_students_section on students(section);
create index if not exists idx_students_active on students(is_active);
create index if not exists idx_sections_active on sections(is_active);
create index if not exists idx_subjects_section on subjects(section_id);
create index if not exists idx_subjects_active on subjects(is_active);
create index if not exists idx_subject_students_subject on subject_students(subject_id);
create index if not exists idx_subject_students_student on subject_students(student_id);
create index if not exists idx_sessions_token on attendance_sessions(session_token);
create index if not exists idx_sessions_date on attendance_sessions(session_date desc);
create index if not exists idx_sessions_section on attendance_sessions(section_id);
create index if not exists idx_sessions_subject on attendance_sessions(subject_id);
create index if not exists idx_records_session on attendance_records(session_id);
create index if not exists idx_records_student on attendance_records(student_id);
create index if not exists idx_records_status on attendance_records(status);
create index if not exists idx_sms_alerts_subject on sms_alerts(subject_id);
create index if not exists idx_sms_alerts_student on sms_alerts(student_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_students_updated_at on students;
create trigger set_students_updated_at
before update on students
for each row execute function set_updated_at();

drop trigger if exists set_sections_updated_at on sections;
create trigger set_sections_updated_at
before update on sections
for each row execute function set_updated_at();

drop trigger if exists set_subjects_updated_at on subjects;
create trigger set_subjects_updated_at
before update on subjects
for each row execute function set_updated_at();

drop trigger if exists set_attendance_records_updated_at on attendance_records;
create trigger set_attendance_records_updated_at
before update on attendance_records
for each row execute function set_updated_at();

drop trigger if exists set_app_settings_updated_at on app_settings;
create trigger set_app_settings_updated_at
before update on app_settings
for each row execute function set_updated_at();

drop trigger if exists set_subject_alert_settings_updated_at on subject_alert_settings;
create trigger set_subject_alert_settings_updated_at
before update on subject_alert_settings
for each row execute function set_updated_at();

insert into app_settings (id)
values (1)
on conflict (id) do nothing;

-- Optional demo seed students for local testing only:
-- insert into students (student_number, full_name, section)
-- values
-- ('STU-001', 'Juan Dela Cruz', 'ABM 12-A'),
-- ('STU-002', 'Maria Santos', 'ABM 12-A'),
-- ('STU-003', 'Carlo Reyes', 'ABM 12-A'),
-- ('STU-004', 'Angela Garcia', 'ABM 12-A'),
-- ('STU-005', 'Miguel Ramos', 'ABM 12-A')
-- on conflict (student_number) do nothing;

insert into sections (name)
select distinct trim(section)
from students
where section is not null and trim(section) <> ''
on conflict (name) do nothing;

insert into sections (name)
values ('ABM 12-A')
on conflict (name) do nothing;

insert into subjects (section_id, name)
select s.id, subject_name
from sections s
cross join (
  values
    ('Business Finance'),
    ('Organization and Management')
) as starter_subjects(subject_name)
where s.name = 'ABM 12-A'
on conflict (section_id, name) do nothing;

insert into subjects (section_id, name)
select distinct sec.id, trim(a.subject)
from attendance_sessions a
join sections sec on sec.name = a.section
where a.subject is not null and trim(a.subject) <> ''
on conflict (section_id, name) do nothing;

update attendance_sessions a
set section_id = sec.id
from sections sec
where a.section_id is null
  and a.section is not null
  and sec.name = a.section;

update attendance_sessions a
set subject_id = sub.id
from subjects sub
where a.subject_id is null
  and a.section_id = sub.section_id
  and a.subject is not null
  and sub.name = a.subject;

insert into subject_students (subject_id, student_id)
select sub.id, stu.id
from subjects sub
join sections sec on sec.id = sub.section_id
join students stu on stu.section = sec.name
where stu.is_active = true
on conflict (subject_id, student_id) do nothing;

-- Storage bucket:
-- 1. In Supabase Dashboard, open Storage.
-- 2. Create a private bucket named attendance-photos.
-- 3. Do not make the bucket public. The app serves teacher thumbnails using short-lived signed URLs.
--
-- Optional SQL bucket creation if storage schema is available:
-- insert into storage.buckets (id, name, public)
-- values ('attendance-photos', 'attendance-photos', false)
-- on conflict (id) do nothing;
--
-- RLS / server-side usage notes:
-- This app performs database writes and photo uploads only from Next.js server API routes.
-- The browser never receives SUPABASE_SECRET_KEY.
-- All table access is mediated by the service role on the server. RLS is enabled below with no
-- browser-facing policies. Keep student attendance inserts behind the server route.

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
