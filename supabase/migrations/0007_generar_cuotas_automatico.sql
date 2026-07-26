-- 0007_generar_cuotas_automatico.sql
-- Generación automática de la cuota mensual, "estratégica" (pedido de Cris, 2026-07-25):
--   * La cuota del socio AL DÍA se genera sola el día que se cumple el mes (día 0
--     del período anclado a la inscripción). Los días de gracia hacen de aviso.
--   * Guard "al día": solo se auto-genera si el socio NO tiene ninguna cuota
--     pendiente. Si ya debe (tiene una pendiente), el cron NO apila más; la
--     siguiente se genera ÚNICAMENTE si registra un nuevo ingreso por el kiosco
--     (bloque 9b de kiosk_check_in, migración 0006).
--   * Resultado: la lista de Deudores queda autoritativa (están todos los que deben,
--     hayan venido o no) SIN inflar deuda de los que dejaron de venir: el que se va
--     acumula 1 sola cuota y ahí se frena.
--
-- Depende de 0006 (membership_period, modelo de período anclado a la inscripción).
--
-- Requiere pg_cron habilitado en el proyecto. Si `create extension pg_cron` falla,
-- habilitarlo en Supabase (Dashboard -> Database -> Extensions -> pg_cron) y
-- reaplicar esta migración. La función queda igual disponible para disparo manual.

-- =============================================================================
-- (1) Auto-generador (lo corre el CRON, rol postgres): SIN guard de auth.
--     Genera la cuota del período vigente para atletas activos AL DÍA.
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
           coalesce(nullif(a.plan_tier_price, 0), pl.price, 0) as amount,
           coalesce(pl.name, 'Membresia General') as plan_name,
           mp.period_start as ps,
           mp.period_end   as pe
    from public.athletes a
    left join public.plans pl on pl.id = a.plan_id
    cross join lateral public.membership_period(a.join_date, v_local_date) mp
    where a.status = 'active' and a.join_date is not null
      and mp.period_start <= v_local_date          -- el período ya arrancó (día 0 en adelante)
  ),
  candidates as (
    select p.*
    from per p
    where not exists (  -- no tiene ya una cuota (paga o pendiente) que cubra ESTE período
      select 1 from public.payments pay
      where pay.athlete_id = p.athlete_id
        and pay.status in ('paid', 'pending')
        and (
          pay.period = p.ps
          or (pay.payment_date >= p.ps and pay.payment_date <= p.pe)
        )
    )
    and not exists (  -- guard "AL DÍA": no debe ninguna cuota pendiente (de ningún período)
      select 1 from public.payments pay2
      where pay2.athlete_id = p.athlete_id
        and pay2.status = 'pending'
    )
  )
  insert into public.payments
    (athlete_id, amount, base_amount, status, method, period, payment_date, concept)
  select c.athlete_id, c.amount, c.amount, 'pending', 'efectivo', c.ps, v_local_date,
         'Cuota ' || to_char(c.ps, 'DD/MM') || '–' || to_char(c.pe, 'DD/MM') || ' - ' || c.plan_name
  from candidates c
  on conflict (athlete_id, period) where period is not null do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

ALTER FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") OWNER TO "postgres";
-- No exponer por la API (no tiene guard de admin): solo la corre el cron / service_role.
REVOKE ALL ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."generate_due_invoices_auto"(timestamp with time zone, "text") TO "service_role";

-- =============================================================================
-- (2) Agenda diaria con pg_cron. Corre 09:00 UTC = 06:00 America/Argentina
--     (antes de que abra el gimnasio; la función igual resuelve la fecha en hora AR).
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pg_cron";

do $$
begin
  if exists (select 1 from cron.job where jobname = 'generate-due-invoices-daily') then
    perform cron.unschedule('generate-due-invoices-daily');
  end if;
end $$;

select cron.schedule(
  'generate-due-invoices-daily',
  '0 9 * * *',
  $cron$ select public.generate_due_invoices_auto(); $cron$
);
