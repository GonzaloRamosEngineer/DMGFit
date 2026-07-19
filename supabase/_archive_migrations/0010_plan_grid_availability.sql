create or replace function public.plan_grid_availability(p_plan_id uuid)
returns table (
  weekly_schedule_id uuid,
  day_of_week int,
  start_time time,
  end_time time,
  capacity int,
  plan_assignments_count int,
  total_active_assignments_count int,
  remaining_total int
)
language sql
security definer
set search_path = public
stable
as $$
  with plan_slots as (
    select ws.id, ws.day_of_week, ws.start_time, ws.end_time, coalesce(ws.capacity, 0) as capacity
    from public.plan_schedule_slots pss
    join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
    where pss.plan_id = p_plan_id
  ),
  active_assignments as (
    select asa.weekly_schedule_id, a.id as athlete_id, a.plan_id
    from public.athlete_slot_assignments asa
    join public.athletes a on a.id = asa.athlete_id
    where asa.is_active = true
      and asa.starts_on <= current_date
      and (asa.ends_on is null or asa.ends_on >= current_date)
      and a.status = 'active'
  )
  select
    ps.id as weekly_schedule_id,
    ps.day_of_week,
    ps.start_time,
    ps.end_time,
    ps.capacity,
    count(distinct case when aa.plan_id = p_plan_id then aa.athlete_id end)::int as plan_assignments_count,
    count(distinct aa.athlete_id)::int as total_active_assignments_count,
    greatest(ps.capacity - count(distinct aa.athlete_id)::int, 0)::int as remaining_total
  from plan_slots ps
  left join active_assignments aa on aa.weekly_schedule_id = ps.id
  where public.is_staff()
  group by ps.id, ps.day_of_week, ps.start_time, ps.end_time, ps.capacity
  order by ps.day_of_week, ps.start_time;
$$;

grant execute on function public.plan_grid_availability(uuid) to authenticated;
