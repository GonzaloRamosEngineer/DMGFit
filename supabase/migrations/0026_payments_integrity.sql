-- 0026_payments_integrity.sql
-- PAGOS como fuente de verdad contable.
-- Decisiones cerradas (docs/tarea-pagos.md, 2026-07-18):
--   A) "Vencido" = derivado, alineado al ciclo del kiosco (ultimo pago 'paid' + 30d + gracia).
--      Sin pg_cron: se deriva en lectura. status CHECK IN ('pending','paid','void') -> 'overdue'
--      NUNCA se almacena.
--   B) Idempotencia de cuotas: columna `period` (1er dia del mes) + unique parcial
--      (athlete_id, period). RPC de generacion con ON CONFLICT DO NOTHING.
--   C) Correccion de pagos: soft-delete (status='void') + tabla `payment_audit` (old/new jsonb).
--      RPCs admin-only update_payment / void_payment.
--   D) (fuera de esta migracion) limpieza de componentes muertos en el front.
--
-- RIESGO: payments esta en el camino critico del kiosco. kiosk_check_in (0024) lee el
-- ultimo pago 'paid' (status='paid'). Este migration NO toca kiosk_check_in; el helper
-- athlete_debt_state() REPLICA su formula de ciclo para que Pagos y kiosco den el MISMO
-- veredicto. 'void' queda naturalmente excluido del filtro status='paid' del kiosco.
--
-- APLICAR EN TRANSACCION. Probar con ROLLBACK antes del COMMIT real (integridad + doble
-- generacion no duplica). Comparar contra la definicion viva.

begin;

-- =====================================================================
-- 0) PRE-CHECKS: abortan si los datos vivos no cumplen los invariantes
-- =====================================================================
do $$
declare
  v_neg int;
  v_bad_status int;
  v_dupe int;
begin
  select count(*) into v_neg from public.payments where amount < 0;
  if v_neg > 0 then
    raise exception 'PRECHECK: % pago(s) con amount < 0; corregir antes del CHECK', v_neg;
  end if;

  select count(*) into v_bad_status
  from public.payments
  where status is null or status not in ('pending','paid','void');
  if v_bad_status > 0 then
    raise exception 'PRECHECK: % pago(s) con status fuera de (pending,paid,void)', v_bad_status;
  end if;

  -- Duplicados historicos de cuota por atleta+mes entre las pending (bug de doble-click).
  -- El backfill de `period` fallaria contra el unique si existieran; los detectamos antes.
  select count(*) into v_dupe from (
    select athlete_id, date_trunc('month', payment_date)::date as period
    from public.payments
    where status = 'pending'
    group by 1, 2
    having count(*) > 1
  ) d;
  if v_dupe > 0 then
    raise exception 'PRECHECK: % (atleta,mes) con cuota pending duplicada; deduplicar antes del backfill', v_dupe;
  end if;
end $$;

-- =====================================================================
-- 1) Columna `period` + backfill de cuotas existentes
-- =====================================================================
alter table public.payments add column if not exists period date;

comment on column public.payments.period is
  'Periodo de la cuota mensual generada (primer dia del mes). NULL para pagos manuales/inscripcion. Unicidad por (athlete_id, period).';

-- Las cuotas generadas hoy son las 'pending'. Les asignamos su periodo para que la nueva
-- generacion idempotente no las duplique.
update public.payments
   set period = date_trunc('month', payment_date)::date
 where status = 'pending' and period is null;

-- =====================================================================
-- 2) Constraints de integridad
-- =====================================================================
alter table public.payments
  add constraint payments_amount_nonneg check (amount >= 0);

alter table public.payments
  add constraint payments_status_valid check (status in ('pending','paid','void'));

-- =====================================================================
-- 3) Unicidad idempotente de cuotas (solo filas con period)
-- =====================================================================
create unique index if not exists payments_athlete_period_uidx
  on public.payments (athlete_id, period)
  where period is not null;

-- =====================================================================
-- 4) Tabla de auditoria de pagos (correcciones / anulaciones)
-- =====================================================================
create table if not exists public.payment_audit (
  id         uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  action     text not null check (action in ('update','void')),
  actor_id   uuid,            -- auth.uid() del admin que ejecuto la accion
  reason     text,
  old_row    jsonb,
  new_row    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_payment_idx on public.payment_audit(payment_id);

alter table public.payment_audit enable row level security;

-- Las RPCs escriben como SECURITY DEFINER (bypass RLS). Solo admin puede LEER la auditoria.
drop policy if exists "admin read payment_audit" on public.payment_audit;
create policy "admin read payment_audit" on public.payment_audit
  for select using (public.is_admin(auth.uid()));

revoke all on public.payment_audit from anon;

-- =====================================================================
-- 5) Helper: estado de deuda alineado al ciclo del kiosco (0024)
--    Formula IDENTICA a kiosk_check_in: ultimo pago 'paid' + 30 dias + gracia.
--    states: 'ok' | 'grace' | 'overdue' | 'pending' (nunca pago).
-- =====================================================================
create or replace function public.athlete_debt_state(
  p_athlete_id uuid,
  p_now        timestamptz default now(),
  p_timezone   text        default 'America/Argentina/Buenos_Aires',
  p_grace_days integer     default 3
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_last_paid_at timestamptz;
  v_expiration   timestamptz;
  v_days_late    integer := 0;
  v_state        text;
begin
  select p.payment_date::timestamptz into v_last_paid_at
  from public.payments p
  where p.athlete_id = p_athlete_id and p.status = 'paid'
  order by p.payment_date desc
  limit 1;

  -- Nunca pago: el kiosco lo deja entrar en ambar (OK_PENDING) pero contablemente adeuda.
  if v_last_paid_at is null then
    return jsonb_build_object(
      'state', 'pending', 'last_paid_at', null, 'expires_at', null,
      'days_late', null, 'grace_days', p_grace_days
    );
  end if;

  v_expiration := v_last_paid_at + interval '30 days';
  if p_now > v_expiration then
    v_days_late := floor(extract(epoch from (p_now - v_expiration)) / 86400)::int;
  end if;

  if p_now <= v_expiration then
    v_state := 'ok';
  elsif v_days_late <= greatest(coalesce(p_grace_days, 0), 0) then
    v_state := 'grace';
  else
    v_state := 'overdue';
  end if;

  return jsonb_build_object(
    'state', v_state, 'last_paid_at', v_last_paid_at, 'expires_at', v_expiration,
    'days_late', v_days_late, 'grace_days', p_grace_days
  );
end;
$function$;

-- Interna: solo la usa admin_billing_status (que corre como owner). Nadie la llama directo.
revoke all on function public.athlete_debt_state(uuid, timestamptz, text, integer) from public;

-- =====================================================================
-- 6) Estado de deuda de TODOS los atletas activos (admin, para Pagos)
--    Fuente unica de "vencido" que consume el front en vez de payment_date < today.
-- =====================================================================
create or replace function public.admin_billing_status(
  p_now        timestamptz default now(),
  p_timezone   text        default 'America/Argentina/Buenos_Aires',
  p_grace_days integer     default 3
)
returns table (
  athlete_id   uuid,
  state        text,
  last_paid_at timestamptz,
  expires_at   timestamptz,
  days_late    integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede consultar el estado de facturacion';
  end if;

  return query
  select a.id,
         s.st->>'state',
         nullif(s.st->>'last_paid_at','')::timestamptz,
         nullif(s.st->>'expires_at','')::timestamptz,
         nullif(s.st->>'days_late','')::int
  from public.athletes a
  cross join lateral (
    select public.athlete_debt_state(a.id, p_now, p_timezone, p_grace_days) as st
  ) s
  where a.status = 'active';
end;
$function$;

revoke all on function public.admin_billing_status(timestamptz, text, integer) from anon;

-- =====================================================================
-- 7) RPC: generacion idempotente de cuotas mensuales (admin)
--    Reemplaza la logica JS de generateMonthlyInvoices(). Fechas LOCALES.
--    Saltea a quien ya tiene CUALQUIER pago del mes (respeta la inscripcion,
--    como la logica JS previa) y usa ON CONFLICT como backstop de concurrencia.
-- =====================================================================
create or replace function public.generate_monthly_invoices(
  p_now      timestamptz default now(),
  p_timezone text        default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
           -- tier price si esta seteado (>0), si no el precio del plan, si no 0.
           -- (Corrige la ambiguedad null/0 del Number(...) del JS previo.)
           coalesce(nullif(a.plan_tier_price, 0), pl.price, 0) as amount,
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
    (athlete_id, amount, base_amount, status, method, period, payment_date, concept)
  select c.athlete_id,
         c.amount,
         c.amount,
         'pending',
         'efectivo',
         v_period,
         v_local_date,
         'Cuota ' || v_month_es || ' - ' || c.plan_name ||
           case when c.visits > 0
                then ' - ' || c.visits || ' ' || case when c.visits = 1 then 'vez' else 'veces' end || ' por semana'
                else '' end
  from candidates c
  -- El predicado repite el del indice parcial (requerido para inferir un unique parcial).
  on conflict (athlete_id, period) where period is not null do nothing;

  get diagnostics v_created = row_count;

  return jsonb_build_object(
    'created', v_created,
    'message', case when v_created = 0
                    then 'Todos los atletas estan al dia.'
                    else 'Se generaron ' || v_created || ' nuevas cuotas pendientes.' end
  );
end;
$function$;

revoke all on function public.generate_monthly_invoices(timestamptz, text) from anon;

-- =====================================================================
-- 8) RPC: editar un pago (admin) con auditoria
--    coalesce -> los NULL no pisan; para "sin descuento" mandar discount_value = 0.
-- =====================================================================
create or replace function public.update_payment(
  p_id             uuid,
  p_amount         numeric default null,
  p_base_amount    numeric default null,
  p_method         text    default null,
  p_concept        text    default null,
  p_payment_date   date    default null,
  p_discount_value numeric default null,
  p_discount_type  text    default null,
  p_reason         text    default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old public.payments;
  v_new public.payments;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede editar pagos';
  end if;

  select * into v_old from public.payments where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: pago % inexistente', p_id;
  end if;
  if v_old.status = 'void' then
    raise exception 'VOIDED: el pago esta anulado; no se puede editar';
  end if;

  update public.payments
     set amount         = coalesce(p_amount, amount),
         base_amount    = coalesce(p_base_amount, base_amount),
         method         = coalesce(p_method, method),
         concept        = coalesce(p_concept, concept),
         payment_date   = coalesce(p_payment_date, payment_date),
         discount_value = coalesce(p_discount_value, discount_value),
         discount_type  = coalesce(p_discount_type, discount_type)
   where id = p_id
   returning * into v_new;

  insert into public.payment_audit(payment_id, action, actor_id, reason, old_row, new_row)
  values (p_id, 'update', auth.uid(), p_reason, to_jsonb(v_old), to_jsonb(v_new));

  return to_jsonb(v_new);
end;
$function$;

revoke all on function public.update_payment(uuid, numeric, numeric, text, text, date, numeric, text, text) from anon;

-- =====================================================================
-- 9) RPC: anular un pago (soft-delete, admin) con auditoria
--    Anular un 'paid' lo saca del filtro status='paid' del kiosco -> puede re-bloquear
--    al atleta (comportamiento CORRECTO: la plata no entro). Avisar en la UI.
-- =====================================================================
create or replace function public.void_payment(
  p_id     uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old public.payments;
  v_new public.payments;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede anular pagos';
  end if;

  select * into v_old from public.payments where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND: pago % inexistente', p_id;
  end if;
  if v_old.status = 'void' then
    raise exception 'ALREADY_VOID: el pago ya estaba anulado';
  end if;

  update public.payments set status = 'void' where id = p_id returning * into v_new;

  insert into public.payment_audit(payment_id, action, actor_id, reason, old_row, new_row)
  values (p_id, 'void', auth.uid(), p_reason, to_jsonb(v_old), to_jsonb(v_new));

  return to_jsonb(v_new);
end;
$function$;

revoke all on function public.void_payment(uuid, text) from anon;

commit;
