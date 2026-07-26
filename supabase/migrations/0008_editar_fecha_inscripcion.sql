-- 0008_editar_fecha_inscripcion.sql
-- Permite corregir la fecha de inscripción (athletes.join_date) de atletas ya
-- cargados. El ancla del ciclo (accesos + cuota) es SIEMPRE join_date; en altas
-- nuevas se setea al dar de alta. Esto es para el arranque del sistema: los ~17
-- atletas cargados por script traen un join_date = fecha de carga (no la real),
-- y hay que poder corregirlo.
--
-- admin_realign_athlete_counter: tras cambiar join_date, re-ancla el contador de
-- accesos vigente a la nueva ventana (membership_period), preservando lo consumido.
-- El estado de cuota (athlete_debt_state) ya recalcula en vivo desde join_date, así
-- que no requiere realineo. Idempotente y seguro ante colisiones.
--
-- Depende de 0006 (membership_period).

CREATE OR REPLACE FUNCTION "public"."admin_realign_athlete_counter"("p_athlete_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_join_date  date;
  v_local_date date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_ps date;
  v_pe date;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede realinear el contador';
  end if;

  select a.join_date into v_join_date from public.athletes a where a.id = p_athlete_id;
  if v_join_date is null then
    return jsonb_build_object('athlete_id', p_athlete_id, 'realigned', false, 'reason', 'sin join_date');
  end if;

  select mp.period_start, mp.period_end into v_ps, v_pe
  from public.membership_period(v_join_date, v_local_date) mp;

  -- Re-anclar el contador que hoy cubre la fecha a la nueva ventana, preservando
  -- consumed_sessions. Sólo si no existe ya un contador en la ventana destino.
  update public.athlete_monthly_counters amc
     set period_start = v_ps,
         period_end   = v_pe,
         updated_at   = timezone('utc', now())
   where amc.id = (
     select amc2.id
     from public.athlete_monthly_counters amc2
     where amc2.athlete_id = p_athlete_id
       and amc2.period_start <= v_local_date
       and amc2.period_end   >= v_local_date
     order by amc2.period_start desc
     limit 1
   )
   and not exists (
     select 1 from public.athlete_monthly_counters x
     where x.athlete_id = p_athlete_id
       and x.period_start = v_ps
       and x.period_end   = v_pe
   );

  return jsonb_build_object(
    'athlete_id', p_athlete_id, 'join_date', v_join_date,
    'period_start', v_ps, 'period_end', v_pe, 'realigned', true
  );
end;
$$;

ALTER FUNCTION "public"."admin_realign_athlete_counter"("uuid") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_realign_athlete_counter"("uuid") TO "authenticated", "service_role";
