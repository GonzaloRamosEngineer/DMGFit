-- 0011_editar_frecuencia_atleta.sql
-- Permite cambiar la MEMBRESÍA de un atleta ya cargado: plan, frecuencia semanal
-- (visits_per_week) y cuota (plan_tier_price). Hasta ahora la frecuencia sólo se
-- definía en el alta (create_full_athlete_atomic) y no había forma de editarla:
-- el perfil sólo guardaba plan_id/plan_option, así que un atleta cargado como 2x
-- quedaba encerrado en 2x para siempre (y el kiosco le seguía dando 8 accesos).
--
-- En el modelo flexible (ver docs/acceso-flexible.md) la frecuencia es el dato que
-- manda: define el saldo mensual de accesos (frecuencia * 4) y el tier de precio.
-- Por eso las tres cosas se mueven juntas y en una sola transacción:
--   1) athletes.visits_per_week + plan_tier_price (+ plan_id / plan_option)
--   2) allowed_sessions del contador VIGENTE, preservando lo ya consumido
--
-- Sobre el contador (p_sync_balance, default true): al subir la frecuencia a mitad
-- de período el atleta pasa a tener más accesos desde hoy; al bajarla, allowed nunca
-- baja de consumed_sessions (lo impide athlete_monthly_counters_consumed_chk y sería
-- quitarle accesos que ya usó). El próximo aniversario ya se autocrea con el valor
-- nuevo en kiosk_check_in, así que esto es sólo para el período en curso.
--
-- NO toca pagos: las cuotas pendientes ya generadas conservan su monto. El precio
-- nuevo aplica desde la próxima cuota que se genere. Si hay que cobrar la diferencia
-- del período en curso, se hace desde Pagos.
--
-- Depende de 0006 (membership_period) y del baseline (plan_pricing_tiers).

CREATE OR REPLACE FUNCTION "public"."admin_update_athlete_membership"(
  "p_athlete_id" "uuid",
  "p_plan_id" "uuid",
  "p_visits_per_week" integer,
  "p_tier_price" numeric DEFAULT NULL,
  "p_plan_option" "text" DEFAULT NULL,
  "p_sync_balance" boolean DEFAULT true
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_date date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_prev_visits int;
  v_prev_price  numeric;
  v_prev_plan   uuid;
  v_price       numeric := p_tier_price;
  v_option      text    := nullif(trim(coalesce(p_plan_option, '')), '');
  v_counter_id  uuid;
  v_allowed     int;
  v_consumed    int;
  v_prev_allowed int;
  v_target      int;
  v_synced      boolean := false;
  v_clamped     boolean := false;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede cambiar la membresía';
  end if;

  select a.visits_per_week, a.plan_tier_price, a.plan_id
    into v_prev_visits, v_prev_price, v_prev_plan
  from public.athletes a
  where a.id = p_athlete_id
  for update;

  if not found then
    raise exception 'No se encontró el atleta.';
  end if;

  if p_plan_id is null then
    raise exception 'Debes seleccionar un plan.';
  end if;

  if not exists (select 1 from public.plans p where p.id = p_plan_id) then
    raise exception 'El plan seleccionado no existe.';
  end if;

  if p_visits_per_week is null or p_visits_per_week <= 0 or p_visits_per_week > 7 then
    raise exception 'La frecuencia debe ser un número entre 1 y 7 días por semana.';
  end if;

  if v_price is not null and v_price < 0 then
    raise exception 'La cuota no puede ser negativa.';
  end if;

  -- Precio: el explícito (cliente especial) o el del tier plan+frecuencia.
  -- Si el plan no tiene tier para esa frecuencia, se conserva el precio actual.
  if v_price is null then
    select pt.price into v_price
    from public.plan_pricing_tiers pt
    where pt.plan_id = p_plan_id and pt.visits_per_week = p_visits_per_week
    limit 1;
  end if;
  v_price := coalesce(v_price, v_prev_price);

  -- plan_option sólo se pisa si vino explícito; si no, se conserva el actual.
  update public.athletes a
     set plan_id          = p_plan_id,
         visits_per_week  = p_visits_per_week,
         plan_tier_price  = v_price,
         plan_option      = coalesce(v_option, a.plan_option)
   where a.id = p_athlete_id;

  -- Contador vigente: acompañar el cambio de frecuencia sin tocar lo consumido.
  if p_sync_balance and coalesce(v_prev_visits, 0) <> p_visits_per_week then
    select amc.id, amc.allowed_sessions, amc.consumed_sessions
      into v_counter_id, v_prev_allowed, v_consumed
    from public.athlete_monthly_counters amc
    where amc.athlete_id = p_athlete_id
      and amc.period_start <= v_local_date
      and amc.period_end   >= v_local_date
    order by amc.period_start desc
    limit 1
    for update;

    if v_counter_id is not null then
      v_target  := greatest(p_visits_per_week * 4, 1);
      -- Nunca por debajo de lo ya consumido (CHECK consumed <= allowed).
      v_allowed := greatest(v_target, v_consumed);
      v_clamped := v_allowed <> v_target;

      update public.athlete_monthly_counters
         set allowed_sessions = v_allowed,
             updated_at       = timezone('utc', now())
       where id = v_counter_id;

      v_synced := true;
    end if;
  end if;

  return jsonb_build_object(
    'athlete_id',        p_athlete_id,
    'plan_id',           p_plan_id,
    'plan_changed',      v_prev_plan is distinct from p_plan_id,
    'previous_visits',   v_prev_visits,
    'visits_per_week',   p_visits_per_week,
    'previous_price',    v_prev_price,
    'plan_tier_price',   v_price,
    'balance_synced',    v_synced,
    'previous_allowed',  v_prev_allowed,
    'allowed_sessions',  case when v_synced then v_allowed else null end,
    'consumed_sessions', case when v_synced then v_consumed else null end,
    'allowed_clamped',   v_clamped
  );
end;
$$;

ALTER FUNCTION "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean) TO "authenticated", "service_role";
