-- 0012_cuota_sigue_a_la_frecuencia.sql
-- Al cambiar la frecuencia de un atleta, la cuota PENDIENTE del período en curso
-- se actualiza al precio nuevo. Decisión de producto de Cris (2026-08-05):
-- preguntada si al pasar de 2x a 3x se borra la cuota anterior o se modifica,
-- respondió "Modifica a 3 días x semana" → misma fila, monto nuevo. No se duplica
-- la cuota ni se deja la vieja hasta el mes siguiente.
--
-- Reemplaza a admin_update_athlete_membership de 0011 agregándole este paso.
-- Reglas:
--   * Sólo cuotas `pending`. Una `paid` es un hecho cerrado: no se toca nunca
--     (si hay que cobrar una diferencia, se hace desde Pagos).
--   * Sólo la del período EN CURSO. Las pendientes de períodos anteriores son
--     deuda de meses que el atleta cursó con la frecuencia vieja: quedan como están.
--   * Si la cuota tenía descuento cargado, se recalcula con la misma fórmula que
--     usa el panel de Pagos (porcentual o monto fijo, nunca negativo).
--   * Queda registrado en payment_audit como 'update', igual que una edición manual.
--
-- Depende de 0006 (membership_period) y 0011.

CREATE OR REPLACE FUNCTION "public"."admin_update_athlete_membership"(
  "p_athlete_id" "uuid",
  "p_plan_id" "uuid",
  "p_visits_per_week" integer,
  "p_tier_price" numeric DEFAULT NULL,
  "p_plan_option" "text" DEFAULT NULL,
  "p_sync_balance" boolean DEFAULT true,
  "p_sync_pending_invoice" boolean DEFAULT true
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_date date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_prev_visits int;
  v_prev_price  numeric;
  v_prev_plan   uuid;
  v_join_date   date;
  v_price       numeric := p_tier_price;
  v_option      text    := nullif(trim(coalesce(p_plan_option, '')), '');
  v_counter_id  uuid;
  v_allowed     int;
  v_consumed    int;
  v_prev_allowed int;
  v_target      int;
  v_synced      boolean := false;
  v_clamped     boolean := false;
  v_ps date;
  v_pe date;
  v_inv         public.payments;
  v_inv_new     public.payments;
  v_inv_amount  numeric;
  v_inv_updated boolean := false;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede cambiar la membresía';
  end if;

  select a.visits_per_week, a.plan_tier_price, a.plan_id, a.join_date
    into v_prev_visits, v_prev_price, v_prev_plan, v_join_date
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

  -- Cuota pendiente del período en curso: sigue al precio nuevo.
  if p_sync_pending_invoice
     and v_price is distinct from v_prev_price
     and v_join_date is not null then

    select mp.period_start, mp.period_end into v_ps, v_pe
    from public.membership_period(v_join_date, v_local_date) mp;

    -- La cuota del período puede venir marcada con `period` (generación nueva) o,
    -- en filas viejas, sólo por payment_date dentro de la ventana.
    select * into v_inv
    from public.payments pay
    where pay.athlete_id = p_athlete_id
      and pay.status = 'pending'
      and (pay.period = v_ps
           or (pay.period is null and pay.payment_date between v_ps and v_pe))
    order by pay.period nulls last, pay.payment_date desc
    limit 1
    for update;

    if found then
      -- Misma fórmula que el panel de Pagos: descuento porcentual o monto fijo.
      if coalesce(v_inv.discount_value, 0) = 0 then
        v_inv_amount := v_price;
      elsif v_inv.discount_type = 'percent' then
        v_inv_amount := greatest(v_price - (v_price * v_inv.discount_value / 100), 0);
      else
        v_inv_amount := greatest(v_price - v_inv.discount_value, 0);
      end if;

      update public.payments
         set base_amount = v_price,
             amount      = v_inv_amount
       where id = v_inv.id
       returning * into v_inv_new;

      insert into public.payment_audit(payment_id, action, actor_id, reason, old_row, new_row)
      values (
        v_inv.id, 'update', auth.uid(),
        format('Cambio de frecuencia %sx → %sx: la cuota del período pasa a %s',
               coalesce(v_prev_visits, 0), p_visits_per_week, v_price),
        to_jsonb(v_inv), to_jsonb(v_inv_new)
      );

      v_inv_updated := true;
    end if;
  end if;

  return jsonb_build_object(
    'athlete_id',            p_athlete_id,
    'plan_id',               p_plan_id,
    'plan_changed',          v_prev_plan is distinct from p_plan_id,
    'previous_visits',       v_prev_visits,
    'visits_per_week',       p_visits_per_week,
    'previous_price',        v_prev_price,
    'plan_tier_price',       v_price,
    'balance_synced',        v_synced,
    'previous_allowed',      v_prev_allowed,
    'allowed_sessions',      case when v_synced then v_allowed else null end,
    'consumed_sessions',     case when v_synced then v_consumed else null end,
    'allowed_clamped',       v_clamped,
    'invoice_updated',       v_inv_updated,
    'invoice_previous_amount', case when v_inv_updated then v_inv.amount else null end,
    'invoice_amount',        case when v_inv_updated then v_inv_amount else null end,
    'invoice_period_start',  case when v_inv_updated then v_ps else null end
  );
end;
$$;

ALTER FUNCTION "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean, boolean) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean, boolean) TO "authenticated", "service_role";

-- La firma de 6 argumentos de 0011 queda huérfana: si no se elimina, PostgREST ve
-- dos sobrecargas y no sabe cuál resolver (PGRST203) cuando el cliente no manda
-- p_sync_pending_invoice.
DROP FUNCTION IF EXISTS "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean);
