-- Additive model: plan pricing tiers + plan slot linkage + athlete visits per week
-- Keeps kiosk_check_in contract intact while enabling richer onboarding.

alter table public.athletes
  add column if not exists visits_per_week int;

alter table public.athletes
  add column if not exists plan_tier_price numeric;

-- Ensure weekly_schedule can represent slot windows and capacity.
alter table public.weekly_schedule
  add column if not exists capacity int not null default 0;

alter table public.weekly_schedule
  add column if not exists day_of_week int;

alter table public.weekly_schedule
  add column if not exists start_time time;

alter table public.weekly_schedule
  add column if not exists end_time time;

-- If legacy exclusion prevents multiple simultaneous weekly slots per athlete,
-- replace it with a per-slot overlap guard.
alter table public.athlete_slot_assignments
  drop constraint if exists athlete_slot_assignments_no_overlap_excl;

alter table public.athlete_slot_assignments
  add constraint athlete_slot_assignments_no_overlap_per_slot_excl
  exclude using gist (
    athlete_id with =,
    weekly_schedule_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  )
  where (is_active);

create table if not exists public.plan_pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  visits_per_week int not null check (visits_per_week > 0),
  price numeric not null check (price >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(plan_id, visits_per_week)
);

create table if not exists public.plan_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  weekly_schedule_id uuid not null references public.weekly_schedule(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(plan_id, weekly_schedule_id)
);

create index if not exists idx_plan_pricing_tiers_plan_id on public.plan_pricing_tiers(plan_id);
create index if not exists idx_plan_pricing_tiers_visits on public.plan_pricing_tiers(visits_per_week);
create index if not exists idx_plan_schedule_slots_plan_id on public.plan_schedule_slots(plan_id);
create index if not exists idx_plan_schedule_slots_schedule_id on public.plan_schedule_slots(weekly_schedule_id);
create index if not exists idx_weekly_schedule_day_time on public.weekly_schedule(day_of_week, start_time, end_time);

create trigger trg_plan_pricing_tiers_set_updated_at
before update on public.plan_pricing_tiers
for each row
execute function public.set_updated_at();

alter table public.plan_pricing_tiers enable row level security;
alter table public.plan_schedule_slots enable row level security;

-- Staff-only management and read for configuration tables.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'plan_pricing_tiers' and policyname = 'plan_pricing_tiers_all_staff'
  ) then
    create policy plan_pricing_tiers_all_staff
      on public.plan_pricing_tiers
      for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'plan_schedule_slots' and policyname = 'plan_schedule_slots_all_staff'
  ) then
    create policy plan_schedule_slots_all_staff
      on public.plan_schedule_slots
      for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end
$$;

create or replace function public.plan_slot_availability(p_plan_id uuid)
returns table (
  weekly_schedule_id uuid,
  day_of_week int,
  start_time time,
  end_time time,
  capacity int,
  active_assignments_count int,
  remaining int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ws.id as weekly_schedule_id,
    ws.day_of_week,
    ws.start_time,
    ws.end_time,
    coalesce(ws.capacity, 0) as capacity,
    count(distinct a.id)::int as active_assignments_count,
    greatest(coalesce(ws.capacity, 0) - count(distinct a.id)::int, 0) as remaining
  from public.plan_schedule_slots pss
  join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
  left join public.athlete_slot_assignments asa
    on asa.weekly_schedule_id = ws.id
    and asa.is_active = true
    and asa.starts_on <= current_date
    and (asa.ends_on is null or asa.ends_on >= current_date)
  left join public.athletes a
    on a.id = asa.athlete_id
    and a.status = 'active'
  where pss.plan_id = p_plan_id
    and public.is_staff()
  group by ws.id, ws.day_of_week, ws.start_time, ws.end_time, ws.capacity
  order by ws.day_of_week, ws.start_time;
$$;

grant execute on function public.plan_slot_availability(uuid) to authenticated;
