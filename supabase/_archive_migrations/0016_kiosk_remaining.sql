-- 0016_kiosk_remaining.sql
-- Repone la RPC kiosk_remaining (el frontend la llama en el perfil/portal del atleta
-- pero no existía en prod -> fallaba silenciosamente). Devuelve el saldo del ciclo vigente.

create or replace function public.kiosk_remaining(
  p_athlete_id uuid,
  p_now timestamptz default now(),
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
stable
as $function$
declare
  v_local_date date := (p_now at time zone p_timezone)::date;
  v_allowed int;
  v_consumed int;
  v_period_start date;
  v_period_end date;
begin
  -- Autorización: staff (admin/profesor) o el propio atleta
  if not (
    public.is_staff()
    or exists (select 1 from public.athletes a where a.id = p_athlete_id and a.profile_id = auth.uid())
  ) then
    raise exception 'No autorizado para consultar el saldo de este atleta.' using errcode = '42501';
  end if;

  select amc.allowed_sessions, amc.consumed_sessions, amc.period_start, amc.period_end
  into v_allowed, v_consumed, v_period_start, v_period_end
  from public.athlete_monthly_counters amc
  where amc.athlete_id = p_athlete_id
    and amc.period_start <= v_local_date
    and amc.period_end >= v_local_date
  order by amc.period_start desc
  limit 1;

  if v_allowed is null then
    return jsonb_build_object(
      'remaining', null, 'allowed', null, 'consumed', null,
      'period_start', null, 'period_end', null
    );
  end if;

  return jsonb_build_object(
    'remaining', greatest(v_allowed - v_consumed, 0),
    'allowed', v_allowed,
    'consumed', v_consumed,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
end;
$function$;

grant execute on function public.kiosk_remaining(uuid, timestamptz, text) to authenticated;
