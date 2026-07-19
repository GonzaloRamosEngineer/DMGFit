-- PHASE 1: Kiosk domain model foundation.
-- Structure only. No policy or frontend wiring.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.athlete_slot_assignments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  weekly_schedule_id uuid not null,
  starts_on date not null,
  ends_on date,
  is_active boolean not null default true,
  assigned_reason_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint athlete_slot_assignments_dates_chk check (ends_on is null or ends_on >= starts_on),
  constraint athlete_slot_assignments_athlete_fk foreign key (athlete_id)
    references public.athletes (id),
  constraint athlete_slot_assignments_weekly_schedule_fk foreign key (weekly_schedule_id)
    references public.weekly_schedule (id)
);

-- Prevent overlapping active assignment windows per athlete.
alter table public.athlete_slot_assignments
  add constraint athlete_slot_assignments_no_overlap_excl
  exclude using gist (
    athlete_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  )
  where (is_active);

create index if not exists idx_athlete_slot_assignments_athlete_id
  on public.athlete_slot_assignments (athlete_id);

create index if not exists idx_athlete_slot_assignments_schedule_id
  on public.athlete_slot_assignments (weekly_schedule_id);

create table if not exists public.athlete_monthly_counters (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  period_start date not null,
  period_end date not null,
  allowed_sessions integer not null,
  consumed_sessions integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint athlete_monthly_counters_period_chk check (period_end >= period_start),
  constraint athlete_monthly_counters_consumed_chk check (consumed_sessions <= allowed_sessions),
  constraint athlete_monthly_counters_athlete_fk foreign key (athlete_id)
    references public.athletes (id),
  constraint athlete_monthly_counters_unique_period unique (athlete_id, period_start, period_end)
);

create index if not exists idx_athlete_monthly_counters_athlete_id
  on public.athlete_monthly_counters (athlete_id);

create index if not exists idx_athlete_monthly_counters_period
  on public.athlete_monthly_counters (period_start, period_end);

create table if not exists public.kiosk_reason_codes (
  code text primary key,
  category text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.athlete_slot_assignments
  add constraint athlete_slot_assignments_assigned_reason_code_fk
  foreign key (assigned_reason_code)
  references public.kiosk_reason_codes (code);

create trigger trg_athlete_slot_assignments_set_updated_at
before update on public.athlete_slot_assignments
for each row
execute function public.set_updated_at();

create trigger trg_athlete_monthly_counters_set_updated_at
before update on public.athlete_monthly_counters
for each row
execute function public.set_updated_at();

create trigger trg_kiosk_reason_codes_set_updated_at
before update on public.kiosk_reason_codes
for each row
execute function public.set_updated_at();

create index if not exists idx_kiosk_reason_codes_active
  on public.kiosk_reason_codes (is_active);
