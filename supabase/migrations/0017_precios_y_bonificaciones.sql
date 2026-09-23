-- 0017_precios_y_bonificaciones.sql
-- El precio de lista baja a las fichas, y la bonificación pasa a ser un dato propio.
--
-- PROBLEMA QUE RESUELVE
--   `save_plan_configuration` actualizaba `plans.price` y `plan_pricing_tiers` (la lista),
--   pero nunca `athletes.plan_tier_price` (la ficha). Y las cuotas se generan con la ficha.
--   Resultado: al 2026-09-20 había 23 atletas facturando por debajo de la tarifa vigente,
--   ~$280.000/mes. No se podía corregir en masa porque el sistema no distinguía un precio
--   bonificado de uno que quedó viejo: los dos son el mismo número en `plan_tier_price`.
--
-- DEFINICIONES DE CRIS (2026-09-20), que son las reglas de abajo:
--   1. "Actualización a todos"  -> al cambiar el precio del plan se pisa la ficha de todos
--      los atletas activos de ese plan, según el tier de su frecuencia.
--   2. "Respetarla"             -> la cuota YA generada del período en curso no se toca.
--   3. "No"                     -> las pendientes de períodos anteriores tampoco.
--   4. "No dejar fuera de la actualización, el desc siempre es un %"
--                               -> a los bonificados también se les pisa la ficha. La
--      bonificación deja de estar escondida en el precio y pasa a `discount_percent`,
--      que se aplica al generar la cuota.
--
-- La regla 4 es la que desata todo: si el descuento vive aparte, la ficha puede llevar
-- SIEMPRE el precio de lista, y deja de existir el número ambiguo.
--
-- Depende de 0006 (membership_period), 0007 (generador automático), 0011/0012 (membresía).

-- =============================================================================
-- (1) La bonificación como dato propio del atleta
-- =============================================================================
ALTER TABLE "public"."athletes"
  ADD COLUMN IF NOT EXISTS "discount_percent" numeric(5,2) NOT NULL DEFAULT 0;

DO $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'athletes_discount_percent_valid'
  ) then
    alter table public.athletes
      add constraint athletes_discount_percent_valid
      check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end $$;

COMMENT ON COLUMN "public"."athletes"."discount_percent" IS
  'Bonificación permanente del atleta, en porcentaje sobre el precio de lista (0 = sin '
  'bonificación). Decisión de Cris (2026-09-20): el descuento SIEMPRE es un %. La ficha '
  '(plan_tier_price) lleva el precio de lista; este campo es el único lugar donde vive '
  'la bonificación, para poder distinguirla de un precio que quedó viejo.';

COMMENT ON COLUMN "public"."athletes"."plan_tier_price" IS
  'Precio de lista del tier (plan + frecuencia) que le corresponde al atleta. Desde 0017 '
  'lo pisa admin_apply_plan_prices al actualizar el plan: NO se usa más para guardar '
  'precios especiales, eso va en discount_percent.';

-- =============================================================================
-- (2) Backfill de los bonificados confirmados por Cris
--     Sólo estos cuatro: son los únicos que confirmó por escrito (20 y 22/09/2026).
--     El resto de las fichas por debajo de lista quedan como están hasta que pase
--     la lista completa; pisarlas a ciegas borraría una bonificación real.
-- =============================================================================
DO $$
declare
  v_rec record;
  v_list numeric;
begin
  for v_rec in
    select * from (values
      ('42211254', 10.0),  -- Lara Agostina Caro
      ('40467235', 10.0),  -- Franco Marinaro
      ('20194573', 50.0),  -- María Eugenia Cuellar
      ('11241860', 50.0)   -- Pascual Gordillo
    ) as t(dni, pct)
  loop
    -- Precio de lista del tier que le corresponde hoy.
    select pt.price into v_list
    from public.athletes a
    join public.plan_pricing_tiers pt
      on pt.plan_id = a.plan_id and pt.visits_per_week = a.visits_per_week
    where a.dni = v_rec.dni;

    update public.athletes a
       set discount_percent = v_rec.pct,
           plan_tier_price  = coalesce(v_list, a.plan_tier_price)
     where a.dni = v_rec.dni;
  end loop;
end $$;

-- =============================================================================
-- (3) Precio efectivo: una sola fórmula, usada por todos los generadores
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."athlete_effective_amount"(
  "p_base" numeric,
  "p_discount_percent" numeric
) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select greatest(
    round(coalesce(p_base, 0) - (coalesce(p_base, 0) * coalesce(p_discount_percent, 0) / 100)),
    0
  );
$$;

ALTER FUNCTION "public"."athlete_effective_amount"(numeric, numeric) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."athlete_effective_amount"(numeric, numeric)
  TO "authenticated", "service_role";

-- =============================================================================
-- (4) Bajar el precio de lista a las fichas (regla 1 + regla 4)
--     No toca ninguna cuota: las reglas 2 y 3 dicen que lo ya generado se respeta.
--     p_dry_run permite ver a quiénes alcanzaría antes de confirmar.
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."admin_apply_plan_prices"(
  "p_plan_id" "uuid",
  "p_dry_run" boolean DEFAULT false
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rows jsonb;
  v_count int := 0;
  v_delta numeric := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede actualizar precios';
  end if;

  if p_plan_id is null or not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'El plan seleccionado no existe.';
  end if;

  -- A quiénes alcanza: activos del plan cuya ficha difiere del tier de su frecuencia.
  -- Los bonificados entran igual (regla 4): se les pisa la ficha y su % sigue aparte.
  with afectados as (
    select a.id,
           p.full_name           as nombre,
           a.visits_per_week     as frecuencia,
           a.plan_tier_price     as precio_anterior,
           pt.price              as precio_nuevo,
           a.discount_percent    as bonificacion
    from public.athletes a
    join public.profiles p on p.id = a.profile_id
    join public.plan_pricing_tiers pt
      on pt.plan_id = a.plan_id and pt.visits_per_week = a.visits_per_week
    where a.status = 'active'
      and a.plan_id = p_plan_id
      and a.plan_tier_price is distinct from pt.price
  )
  select coalesce(jsonb_agg(to_jsonb(afectados) order by afectados.nombre), '[]'::jsonb),
         count(*),
         coalesce(sum(afectados.precio_nuevo - afectados.precio_anterior), 0)
    into v_rows, v_count, v_delta
  from afectados;

  if not p_dry_run and v_count > 0 then
    update public.athletes a
       set plan_tier_price = pt.price
      from public.plan_pricing_tiers pt
     where pt.plan_id = a.plan_id
       and pt.visits_per_week = a.visits_per_week
       and a.status = 'active'
       and a.plan_id = p_plan_id
       and a.plan_tier_price is distinct from pt.price;
  end if;

  return jsonb_build_object(
    'dry_run',        p_dry_run,
    'plan_id',        p_plan_id,
    'actualizados',   v_count,
    'diferencia_mensual', v_delta,
    'detalle',        v_rows
  );
end;
$$;

ALTER FUNCTION "public"."admin_apply_plan_prices"("uuid", boolean) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_apply_plan_prices"("uuid", boolean)
  TO "authenticated", "service_role";

-- =============================================================================
-- (5) Los generadores aplican la bonificación
--     La cuota sale ya con el descuento hecho: base_amount = precio de lista,
--     amount = lo que realmente paga. Se deja discount_type/value cargados para que
--     el comprobante y el panel de Pagos lo muestren igual que un descuento manual.
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."generate_due_invoices_auto"("p_now" timestamp with time zone DEFAULT "now"(), "p_timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_date date := (p_now at time zone p_timezone)::date;
  v_created int := 0;
begin
  with per as (
    select a.id as athlete_id,
           coalesce(nullif(a.plan_tier_price, 0), pl.price, 0) as base_amount,
           coalesce(a.discount_percent, 0) as discount_percent,
           coalesce(pl.name, 'Membresia General') as plan_name,
           mp.period_start as ps,
           mp.period_end   as pe
    from public.athletes a
    left join public.plans pl on pl.id = a.plan_id
    cross join lateral public.membership_period(a.join_date, v_local_date) mp
    where a.status = 'active' and a.join_date is not null
      and mp.period_start <= v_local_date
  ),
  candidates as (
    select p.*
    from per p
    where not exists (
      select 1 from public.payments pay
      where pay.athlete_id = p.athlete_id
        and pay.status in ('paid', 'pending')
        and (
          pay.period = p.ps
          or (pay.payment_date >= p.ps and pay.payment_date <= p.pe)
        )
    )
    and not exists (
      select 1 from public.payments pay2
      where pay2.athlete_id = p.athlete_id
        and pay2.status = 'pending'
    )
  )
  insert into public.payments
    (athlete_id, amount, base_amount, status, method, period, payment_date, concept,
     discount_type, discount_value)
  select c.athlete_id,
         public.athlete_effective_amount(c.base_amount, c.discount_percent),
         c.base_amount,
         'pending', 'efectivo', c.ps, v_local_date,
         'Cuota ' || to_char(c.ps, 'DD/MM') || '–' || to_char(c.pe, 'DD/MM') || ' - ' || c.plan_name,
         case when c.discount_percent > 0 then 'percent' else null end,
         case when c.discount_percent > 0 then c.discount_percent else 0 end
  from candidates c
  on conflict (athlete_id, period) where period is not null do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

ALTER FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") TO "service_role";

CREATE OR REPLACE FUNCTION "public"."generate_monthly_invoices"("p_now" timestamp with time zone DEFAULT "now"(), "p_timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_date  date := (p_now at time zone p_timezone)::date;
  v_period      date := date_trunc('month', v_local_date)::date;
  v_month_start date := v_period;
  v_month_end   date := (v_period + interval '1 month - 1 day')::date;
  v_month_es    text := (array['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
                        )[extract(month from v_period)::int];
  v_created int := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede generar cuotas';
  end if;

  with candidates as (
    select a.id as athlete_id,
           coalesce(nullif(a.plan_tier_price, 0), pl.price, 0) as base_amount,
           coalesce(a.discount_percent, 0) as discount_percent,
           coalesce(pl.name, 'Membresia General') as plan_name,
           coalesce(a.visits_per_week, 0) as visits
    from public.athletes a
    left join public.plans pl on pl.id = a.plan_id
    where a.status = 'active'
      and not exists (
        select 1 from public.payments p
        where p.athlete_id = a.id
          and (
            p.period = v_period
            or (p.payment_date >= v_month_start and p.payment_date <= v_month_end)
          )
      )
  )
  insert into public.payments
    (athlete_id, amount, base_amount, status, method, period, payment_date, concept,
     discount_type, discount_value)
  select c.athlete_id,
         public.athlete_effective_amount(c.base_amount, c.discount_percent),
         c.base_amount,
         'pending', 'efectivo', v_period, v_local_date,
         'Cuota ' || v_month_es || ' - ' || c.plan_name ||
           case when c.visits > 0
                then ' - ' || c.visits || ' ' || case when c.visits = 1 then 'vez' else 'veces' end || ' por semana'
                else '' end,
         case when c.discount_percent > 0 then 'percent' else null end,
         case when c.discount_percent > 0 then c.discount_percent else 0 end
  from candidates c
  on conflict (athlete_id, period) where period is not null do nothing;

  get diagnostics v_created = row_count;

  return jsonb_build_object(
    'created', v_created,
    'message', case when v_created = 0
                    then 'Todos los atletas estan al dia.'
                    else 'Se generaron ' || v_created || ' nuevas cuotas pendientes.' end
  );
end;
$$;

ALTER FUNCTION "public"."generate_monthly_invoices"(timestamp with time zone, "text") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."generate_monthly_invoices"(timestamp with time zone, "text")
  TO "authenticated", "service_role";

-- =============================================================================
-- (6) Cambio de membresía: acepta la bonificación y la usa al ajustar la cuota
--     Reemplaza la firma de 0012 agregando p_discount_percent.
--     NULL = "no tocar la bonificación actual" (mismo criterio que 0013/0014).
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."admin_update_athlete_membership"(
  "p_athlete_id" "uuid",
  "p_plan_id" "uuid",
  "p_visits_per_week" integer,
  "p_tier_price" numeric DEFAULT NULL,
  "p_plan_option" "text" DEFAULT NULL,
  "p_sync_balance" boolean DEFAULT true,
  "p_sync_pending_invoice" boolean DEFAULT true,
  "p_discount_percent" numeric DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_date date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_prev_visits int;
  v_prev_price  numeric;
  v_prev_plan   uuid;
  v_prev_disc   numeric;
  v_join_date   date;
  v_price       numeric := p_tier_price;
  v_disc        numeric;
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

  select a.visits_per_week, a.plan_tier_price, a.plan_id, a.join_date, a.discount_percent
    into v_prev_visits, v_prev_price, v_prev_plan, v_join_date, v_prev_disc
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

  if p_discount_percent is not null
     and (p_discount_percent < 0 or p_discount_percent > 100) then
    raise exception 'La bonificación debe estar entre 0 y 100%%.';
  end if;

  v_disc := coalesce(p_discount_percent, v_prev_disc, 0);

  if v_price is null then
    select pt.price into v_price
    from public.plan_pricing_tiers pt
    where pt.plan_id = p_plan_id and pt.visits_per_week = p_visits_per_week
    limit 1;
  end if;
  v_price := coalesce(v_price, v_prev_price);

  update public.athletes a
     set plan_id          = p_plan_id,
         visits_per_week  = p_visits_per_week,
         plan_tier_price  = v_price,
         discount_percent = v_disc,
         plan_option      = coalesce(v_option, a.plan_option)
   where a.id = p_athlete_id;

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
      v_allowed := greatest(v_target, v_consumed);
      v_clamped := v_allowed <> v_target;

      update public.athlete_monthly_counters
         set allowed_sessions = v_allowed,
             updated_at       = timezone('utc', now())
       where id = v_counter_id;

      v_synced := true;
    end if;
  end if;

  -- Cuota pendiente del período en curso: sigue al precio nuevo Y a la bonificación.
  if p_sync_pending_invoice
     and (v_price is distinct from v_prev_price or v_disc is distinct from coalesce(v_prev_disc, 0))
     and v_join_date is not null then

    select mp.period_start, mp.period_end into v_ps, v_pe
    from public.membership_period(v_join_date, v_local_date) mp;

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
      v_inv_amount := public.athlete_effective_amount(v_price, v_disc);

      update public.payments
         set base_amount    = v_price,
             amount         = v_inv_amount,
             discount_type  = case when v_disc > 0 then 'percent' else null end,
             discount_value = case when v_disc > 0 then v_disc else 0 end
       where id = v_inv.id
       returning * into v_inv_new;

      insert into public.payment_audit(payment_id, action, actor_id, reason, old_row, new_row)
      values (
        v_inv.id, 'update', auth.uid(),
        format('Cambio de membresía %sx → %sx (cuota %s, bonificación %s%%): la cuota del período pasa a %s',
               coalesce(v_prev_visits, 0), p_visits_per_week, v_price, v_disc, v_inv_amount),
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
    'previous_discount',     v_prev_disc,
    'discount_percent',      v_disc,
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

ALTER FUNCTION "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean, boolean, numeric) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean, boolean, numeric) TO "authenticated", "service_role";

-- La firma de 7 argumentos de 0012 queda huérfana: si no se elimina, PostgREST ve dos
-- sobrecargas y no resuelve la llamada (PGRST203). Mismo motivo que en 0012.
DROP FUNCTION IF EXISTS "public"."admin_update_athlete_membership"("uuid", "uuid", integer, numeric, "text", boolean, boolean);
