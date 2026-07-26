-- 0009_ajustar_saldo_accesos.sql
-- Ajuste manual del saldo de accesos del período vigente de un atleta.
-- Caso de uso: al arrancar el sistema, consumed_sessions está en ~0 porque los
-- ingresos previos no se registraron por el kiosco. La mayoría se acomoda solo en
-- el próximo aniversario (el contador se resetea), pero para los casos puntuales
-- donde el saldo real importa, el admin puede setear "accesos restantes".
--
-- Setea consumed = allowed - restantes (clamp a [0, allowed]) sobre el contador que
-- cubre hoy; si no existe, lo crea en la ventana de inscripción. Depende de 0006.

CREATE OR REPLACE FUNCTION "public"."admin_set_access_balance"("p_athlete_id" "uuid", "p_remaining" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_date date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_join    date;
  v_visits  int;
  v_ps date;
  v_pe date;
  v_id uuid;
  v_allowed int;
  v_consumed int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede ajustar el saldo de accesos';
  end if;
  if p_remaining is null or p_remaining < 0 then
    raise exception 'Los accesos restantes deben ser un número >= 0.';
  end if;

  select a.join_date, a.visits_per_week into v_join, v_visits
  from public.athletes a where a.id = p_athlete_id;

  -- Contador que cubre hoy
  select amc.id, amc.allowed_sessions
  into v_id, v_allowed
  from public.athlete_monthly_counters amc
  where amc.athlete_id = p_athlete_id
    and amc.period_start <= v_local_date
    and amc.period_end   >= v_local_date
  order by amc.period_start desc
  limit 1
  for update;

  -- Si no hay contador vigente, crearlo en la ventana de inscripción
  if v_id is null then
    select mp.period_start, mp.period_end into v_ps, v_pe
    from public.membership_period(v_join, v_local_date) mp;
    v_allowed := case when coalesce(v_visits, 0) > 0 then greatest(v_visits * 4, 1) else 12 end;
    insert into public.athlete_monthly_counters(athlete_id, period_start, period_end, allowed_sessions, consumed_sessions)
    values (p_athlete_id, v_ps, v_pe, v_allowed, 0)
    on conflict (athlete_id, period_start, period_end) do nothing
    returning id into v_id;
    if v_id is null then
      select amc.id, amc.allowed_sessions into v_id, v_allowed
      from public.athlete_monthly_counters amc
      where amc.athlete_id = p_athlete_id and amc.period_start = v_ps and amc.period_end = v_pe
      limit 1 for update;
    end if;
  end if;

  -- consumed = allowed - restantes, acotado a [0, allowed] (respeta el CHECK)
  v_consumed := greatest(v_allowed - least(p_remaining, v_allowed), 0);

  update public.athlete_monthly_counters
    set consumed_sessions = v_consumed, updated_at = timezone('utc', now())
  where id = v_id;

  select amc.allowed_sessions, amc.consumed_sessions, amc.period_start, amc.period_end
  into v_allowed, v_consumed, v_ps, v_pe
  from public.athlete_monthly_counters amc where amc.id = v_id;

  return jsonb_build_object(
    'remaining', greatest(v_allowed - v_consumed, 0),
    'allowed', v_allowed,
    'consumed', v_consumed,
    'period_start', v_ps,
    'period_end', v_pe
  );
end;
$$;

ALTER FUNCTION "public"."admin_set_access_balance"("uuid", integer) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_set_access_balance"("uuid", integer) TO "authenticated", "service_role";
