-- High-level plan availability windows (staff defines ranges; app expands to structural slots).

alter table public.plans
  add column if not exists session_duration_min int not null default 60;

create table if not exists public.plan_availability_windows (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  capacity int not null default 0 check (capacity >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_time > start_time)
);

create index if not exists idx_plan_availability_windows_plan_id on public.plan_availability_windows(plan_id);
create index if not exists idx_plan_availability_windows_day on public.plan_availability_windows(day_of_week);

create trigger trg_plan_availability_windows_set_updated_at
before update on public.plan_availability_windows
for each row
execute function public.set_updated_at();

alter table public.plan_availability_windows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plan_availability_windows'
      and policyname = 'plan_availability_windows_all_staff'
  ) then
    create policy plan_availability_windows_all_staff
      on public.plan_availability_windows
      for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end
$$;
