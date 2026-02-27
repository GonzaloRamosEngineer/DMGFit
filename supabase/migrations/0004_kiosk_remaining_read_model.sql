-- PHASE 3 / PR5: Read-only remaining sessions RPC.

create or replace function public.kiosk_remaining(
  p_athlete_id uuid,
  p_now timestamptz default now(),
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_date date;
  v_allowed boolean := false;
  v_allowed_sessions integer;
  v_consumed_sessions integer;
  v_period_start date;
  v_period_end date;
  v_remaining integer;
begin
  if p_athlete_id is null then
    raise exception 'p_athlete_id is required';
  end if;

  v_allowed := public.is_staff() or exists (
    select 1
    from public.athletes a
    where a.id = p_athlete_id
      and a.profile_id = auth.uid()
  );

  if not v_allowed then
    raise exception 'not authorized for athlete %', p_athlete_id using errcode = '42501';
  end if;

  v_local_date := (p_now at time zone p_timezone)::date;

  select amc.allowed_sessions, amc.consumed_sessions, amc.period_start, amc.period_end
  into v_allowed_sessions, v_consumed_sessions, v_period_start, v_period_end
  from public.athlete_monthly_counters amc
  where amc.athlete_id = p_athlete_id
    and amc.period_start <= v_local_date
    and amc.period_end >= v_local_date
  order by amc.period_start desc
  limit 1;

  if v_allowed_sessions is null then
    return jsonb_build_object(
      'athlete_id', p_athlete_id,
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'message', 'NO_COUNTER'
    );
  end if;

  v_remaining := greatest(v_allowed_sessions - v_consumed_sessions, 0);

  return jsonb_build_object(
    'athlete_id', p_athlete_id,
    'remaining', v_remaining,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'message', 'OK'
  );
end;
$$;

revoke execute on function public.kiosk_remaining(uuid, timestamptz, text) from public;
revoke execute on function public.kiosk_remaining(uuid, timestamptz, text) from anon;
grant execute on function public.kiosk_remaining(uuid, timestamptz, text) to authenticated;
