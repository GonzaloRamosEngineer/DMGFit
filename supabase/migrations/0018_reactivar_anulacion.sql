-- 0018_reactivar_anulacion.sql
-- Anular deja de ser un camino de ida.
--
-- PROBLEMA QUE RESUELVE
--   El 2026-09-23, corrigiendo a Franco Marinaro, se anuló la cuota equivocada: la del
--   período 02/09 en vez de la del 02/08. Descubrimos que eso no tenía arreglo:
--     * `void_payment` no tiene reverso y `update_payment` rechaza cualquier pago anulado.
--     * El índice único (athlete_id, period) incluía las anuladas, así que la fila muerta
--       seguía ocupando el período y NINGÚN generador podía recrear la cuota — ni el cron
--       ni el botón "Generar Periodo".
--   Resultado: un click equivocado dejaba a un atleta sin facturar ese mes, para siempre
--   y en silencio. Hubo que arreglarlo escribiendo directo a la tabla con service_role.
--
-- Se arregla por los dos lados, porque cada uno tapa un caso distinto:
--   (1) El índice ignora las anuladas -> el sistema se recupera solo: si una cuota se
--       anula por error, el generador vuelve a crearla en su próxima corrida.
--   (2) admin_restore_payment() -> se puede deshacer a mano, sin esperar al generador y
--       recuperando el estado original (una cuota cobrada vuelve a 'paid', no a 'pending').
--
-- Depende de 0026_payments_integrity (archivada, en prod): payment_audit y void_payment.

-- =============================================================================
-- (1) El índice único deja de contar las anuladas
--     Una fila 'void' es un hecho archivado, no una cuota viva: no debe bloquear
--     que el período se vuelva a generar.
-- =============================================================================
DROP INDEX IF EXISTS "public"."payments_athlete_period_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "payments_athlete_period_uidx"
  ON "public"."payments" ("athlete_id", "period")
  WHERE "period" IS NOT NULL AND "status" <> 'void';

COMMENT ON INDEX "public"."payments_athlete_period_uidx" IS
  'Una sola cuota viva por (atleta, período). Las anuladas quedan fuera a propósito '
  '(0018): si no, una anulación por error bloqueaba para siempre la regeneración de '
  'ese período y el atleta dejaba de facturar sin que nada avisara.';

-- Los generadores tienen que repetir el predicado del índice para poder inferirlo
-- como árbitro del ON CONFLICT. Como siempre insertan 'pending', la condición
-- status <> 'void' se cumple sola; va escrita sólo para que la inferencia funcione.
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
  on conflict (athlete_id, period) where period is not null and status <> 'void' do nothing;

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
          and p.status <> 'void'
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
  on conflict (athlete_id, period) where period is not null and status <> 'void' do nothing;

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
-- (2) Reactivar una cuota anulada
--     Vuelve al estado que tenía ANTES de anularse, que lo sabe payment_audit:
--     una cuota que estaba cobrada vuelve a 'paid', no a 'pending'. Si no hay traza
--     (anulaciones viejas), se asume 'pending', que es el caso habitual.
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."admin_restore_payment"(
  "p_id" "uuid",
  "p_reason" "text" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_old    public.payments;
  v_new    public.payments;
  v_status text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede reactivar pagos';
  end if;

  select * into v_old from public.payments where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: pago % inexistente', p_id;
  end if;
  if v_old.status <> 'void' then
    raise exception 'NOT_VOID: el pago no está anulado, no hay nada que reactivar';
  end if;

  -- Estado original, según la última anulación registrada.
  select coalesce(pa.old_row->>'status', 'pending') into v_status
  from public.payment_audit pa
  where pa.payment_id = p_id and pa.action = 'void'
  order by pa.created_at desc
  limit 1;

  v_status := coalesce(v_status, 'pending');
  if v_status not in ('pending', 'paid') then
    v_status := 'pending';
  end if;

  -- Desde 0018 el índice único sólo cuenta las vivas, así que reactivar puede chocar
  -- con una cuota que se generó mientras ésta estaba anulada. Se avisa en criollo en
  -- vez de dejar salir el error de Postgres.
  if v_old.period is not null and exists (
    select 1 from public.payments p
    where p.athlete_id = v_old.athlete_id
      and p.period = v_old.period
      and p.status <> 'void'
      and p.id <> v_old.id
  ) then
    raise exception 'DUPLICADA: ya hay otra cuota viva para ese período. Revisá cuál corresponde antes de reactivar ésta.';
  end if;

  update public.payments set status = v_status where id = p_id returning * into v_new;

  insert into public.payment_audit(payment_id, action, actor_id, reason, old_row, new_row)
  values (
    p_id, 'update', auth.uid(),
    coalesce(nullif(trim(p_reason), ''), 'Anulación revertida'),
    to_jsonb(v_old), to_jsonb(v_new)
  );

  return to_jsonb(v_new);
end;
$$;

ALTER FUNCTION "public"."admin_restore_payment"("uuid", "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."admin_restore_payment"("uuid", "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."admin_restore_payment"("uuid", "text") FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."admin_restore_payment"("uuid", "text") TO "authenticated", "service_role";
