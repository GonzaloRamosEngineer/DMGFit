-- 0019_licencia_por_ausencia.sql
-- Un atleta puede avisar que no va a venir por uno o varios meses.
--
-- PEDIDO DE CRIS (2026-09-20):
--   "En el caso de que un atleta me avise que un mes o varios no va a concurrir,
--    ¿tengo forma de registrar eso?"
--   Hoy no. Lo único parecido era "dar de baja", que no sirve: le cierra las
--   asignaciones de horario y, además, desde el panel es un camino de ida (no hay
--   ninguna acción que vuelva a activar a un atleta inactivo).
--
-- Ya nos costó plata mal contada: a José Antonio Medina se le generó la cuota de julio
-- aunque no asistió, y hubo que anularla a mano el 2026-09-23 para sacarla de la deuda.
--
-- CÓMO FUNCIONA
--   * La licencia es un rango de fechas. Durante ese rango NO se le genera cuota.
--   * El atleta sigue activo: conserva su plan, su frecuencia y su historial.
--   * Cuando el rango termina, vuelve a facturar solo. No hay que acordarse de nada.
--   * No toca las cuotas que YA existen: si quedó una del período anterior, sigue ahí.
--     Misma regla que el resto del sistema (lo emitido no se reescribe).
--
-- Depende de 0007 (generate_due_invoices_auto) y 0017 (bonificaciones).

-- Necesaria para el EXCLUDE de abajo: permite mezclar uuid (=) con daterange (&&).
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TABLE IF NOT EXISTS "public"."athlete_leaves" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "athlete_id" uuid NOT NULL REFERENCES "public"."athletes"("id") ON DELETE CASCADE,
  "starts_on"  date NOT NULL,
  "ends_on"    date NOT NULL,
  "reason"     text,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT "athlete_leaves_rango_valido" CHECK ("ends_on" >= "starts_on")
);

COMMENT ON TABLE "public"."athlete_leaves" IS
  'Licencias: períodos en los que el atleta avisó que no va a venir. Mientras dura, no '
  'se le genera cuota, pero sigue activo y conserva su lugar. Pedido de Cris (2026-09-20).';
COMMENT ON COLUMN "public"."athlete_leaves"."ends_on" IS
  'Último día de la licencia, inclusive. Es obligatorio a propósito: una licencia sin '
  'fin es un atleta que deja de facturar para siempre sin que nadie se entere.';

-- Dos licencias del mismo atleta no se pueden pisar: si se superponen, nadie sabe cuál
-- manda y una baja mal cargada podría tapar a otra.
DO $$
begin
  if not exists (select 1 from pg_constraint where conname = 'athlete_leaves_sin_solapar') then
    alter table public.athlete_leaves
      add constraint athlete_leaves_sin_solapar
      exclude using gist (
        athlete_id with =,
        daterange(starts_on, ends_on, '[]') with &&
      );
  end if;
end $$;

CREATE INDEX IF NOT EXISTS "athlete_leaves_athlete_idx"
  ON "public"."athlete_leaves" ("athlete_id", "starts_on" DESC);

-- =============================================================================
-- RLS: la maneja el staff. El atleta no ve ni toca licencias.
-- =============================================================================
ALTER TABLE "public"."athlete_leaves" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_leaves_admin_all" ON "public"."athlete_leaves";
CREATE POLICY "athlete_leaves_admin_all" ON "public"."athlete_leaves"
  FOR ALL TO "authenticated"
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE "public"."athlete_leaves" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."athlete_leaves" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."athlete_leaves" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_leaves" TO "service_role";

-- =============================================================================
-- Helper: ¿está de licencia en tal fecha?
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."athlete_on_leave"(
  "p_athlete_id" "uuid",
  "p_date" date
) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.athlete_leaves l
    where l.athlete_id = p_athlete_id
      and p_date between l.starts_on and l.ends_on
  );
$$;

ALTER FUNCTION "public"."athlete_on_leave"("uuid", date) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."athlete_on_leave"("uuid", date)
  TO "authenticated", "service_role";

-- =============================================================================
-- Alta y baja de licencias (admin)
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."admin_add_athlete_leave"(
  "p_athlete_id" "uuid",
  "p_starts_on" date,
  "p_ends_on" date,
  "p_reason" "text" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.athlete_leaves;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede registrar licencias';
  end if;

  if p_starts_on is null or p_ends_on is null then
    raise exception 'Indicá desde cuándo y hasta cuándo no va a venir.';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'La fecha de vuelta no puede ser anterior a la de salida.';
  end if;
  if not exists (select 1 from public.athletes where id = p_athlete_id) then
    raise exception 'No se encontró el atleta.';
  end if;

  begin
    insert into public.athlete_leaves (athlete_id, starts_on, ends_on, reason, created_by)
    values (p_athlete_id, p_starts_on, p_ends_on, nullif(trim(p_reason), ''), auth.uid())
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'Ya hay una licencia cargada que se pisa con esas fechas.';
  end;

  return to_jsonb(v_row);
end;
$$;

ALTER FUNCTION "public"."admin_add_athlete_leave"("uuid", date, date, "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."admin_add_athlete_leave"("uuid", date, date, "text") FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."admin_add_athlete_leave"("uuid", date, date, "text")
  TO "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."admin_delete_athlete_leave"("p_id" "uuid")
RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede borrar licencias';
  end if;
  delete from public.athlete_leaves where id = p_id;
  return found;
end;
$$;

ALTER FUNCTION "public"."admin_delete_athlete_leave"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."admin_delete_athlete_leave"("uuid") FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."admin_delete_athlete_leave"("uuid")
  TO "authenticated", "service_role";

-- =============================================================================
-- Los generadores saltean al que está de licencia
--   El criterio es el PRIMER día del período: es el día en que la cuota se emitiría.
--   Si ese día está dentro de una licencia, no se genera. Cuando la licencia termina,
--   el período siguiente se genera solo.
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
      and not public.athlete_on_leave(a.id, mp.period_start)   -- 0019: de licencia, no factura
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
      and not public.athlete_on_leave(a.id, v_period)           -- 0019
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
