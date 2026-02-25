-- PHASE 2 / PR2: Policy boundary hardening for atomic kiosk enforcement.
-- Additive only; focused on kiosk bypass vectors.

-- A) Helper aligned with F-01 pattern.
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'profesor')
  );
$$;

-- B1) athlete_monthly_counters: staff-only read/write.
alter table if exists public.athlete_monthly_counters enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_monthly_counters'
      and policyname = 'athlete_monthly_counters_read_authenticated'
  ) then
    drop policy athlete_monthly_counters_read_authenticated on public.athlete_monthly_counters;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_monthly_counters'
      and policyname = 'athlete_monthly_counters_read_staff'
  ) then
    create policy athlete_monthly_counters_read_staff
      on public.athlete_monthly_counters
      for select
      to authenticated
      using (public.is_staff());
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_monthly_counters'
      and policyname = 'athlete_monthly_counters_write_staff'
  ) then
    drop policy athlete_monthly_counters_write_staff on public.athlete_monthly_counters;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_monthly_counters'
      and policyname = 'athlete_monthly_counters_all_staff'
  ) then
    create policy athlete_monthly_counters_all_staff
      on public.athlete_monthly_counters
      for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end
$$;

-- B2) athlete_slot_assignments: staff-only read/write.
alter table if exists public.athlete_slot_assignments enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_slot_assignments'
      and policyname = 'athlete_slot_assignments_read_authenticated'
  ) then
    drop policy athlete_slot_assignments_read_authenticated on public.athlete_slot_assignments;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_slot_assignments'
      and policyname = 'athlete_slot_assignments_read_staff'
  ) then
    create policy athlete_slot_assignments_read_staff
      on public.athlete_slot_assignments
      for select
      to authenticated
      using (public.is_staff());
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_slot_assignments'
      and policyname = 'athlete_slot_assignments_write_staff'
  ) then
    drop policy athlete_slot_assignments_write_staff on public.athlete_slot_assignments;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_slot_assignments'
      and policyname = 'athlete_slot_assignments_all_staff'
  ) then
    create policy athlete_slot_assignments_all_staff
      on public.athlete_slot_assignments
      for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end
$$;

-- C) access_logs: staff-only read/update/delete; controlled inserts.
alter table if exists public.access_logs enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_logs'
      and policyname = 'access_logs_read_authenticated'
  ) then
    drop policy access_logs_read_authenticated on public.access_logs;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_logs'
      and policyname = 'access_logs_select_staff'
  ) then
    create policy access_logs_select_staff
      on public.access_logs
      for select
      to authenticated
      using (public.is_staff());
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_logs'
      and policyname = 'access_logs_insert_staff'
  ) then
    drop policy access_logs_insert_staff on public.access_logs;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_logs'
      and policyname = 'access_logs_insert_authenticated_controlled'
  ) then
    create policy access_logs_insert_authenticated_controlled
      on public.access_logs
      for insert
      to authenticated
      with check (
        (access_granted is false)
        or public.is_staff()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_logs'
      and policyname = 'access_logs_update_staff'
  ) then
    create policy access_logs_update_staff
      on public.access_logs
      for update
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'access_logs'
      and policyname = 'access_logs_delete_staff'
  ) then
    create policy access_logs_delete_staff
      on public.access_logs
      for delete
      to authenticated
      using (public.is_staff());
  end if;
end
$$;

-- D) RPC execute boundary for kiosk check-in (unchanged intent).
revoke execute on function public.kiosk_check_in(text, text, timestamptz, text) from public;
revoke execute on function public.kiosk_check_in(text, text, timestamptz, text) from anon;
grant execute on function public.kiosk_check_in(text, text, timestamptz, text) to authenticated;

-- E) Acceptance checks (manual copy/paste in SQL editor; non-executable comments)
-- 1) Non-staff authenticated cannot insert access_logs with access_granted=true:
--    insert into public.access_logs (athlete_id, access_granted, reason_code)
--    values ('<athlete-id>'::uuid, true, 'OK');
--
-- 2) Non-staff authenticated can insert access_logs with access_granted=false:
--    insert into public.access_logs (athlete_id, access_granted, reason_code, rejection_reason)
--    values ('<athlete-id>'::uuid, false, 'PAYMENT_BLOCKED', 'Test deny');
--
-- 3) Non-staff cannot update/delete access_logs:
--    update public.access_logs set rejection_reason = 'x' where id = '<log-id>'::uuid;
--    delete from public.access_logs where id = '<log-id>'::uuid;
--
-- 4) Staff can insert/update/delete:
--    insert into public.access_logs (athlete_id, access_granted, reason_code)
--    values ('<athlete-id>'::uuid, true, 'OK');
--    update public.access_logs set rejection_reason = 'staff edit' where id = '<log-id>'::uuid;
--    delete from public.access_logs where id = '<log-id>'::uuid;
--
-- 5) kiosk_check_in still inserts rows in access_logs successfully (SECURITY DEFINER path):
--    select public.kiosk_check_in(
--      p_dni := '12345678',
--      p_phone := null,
--      p_now := now(),
--      p_timezone := 'America/Argentina/Buenos_Aires'
--    );
