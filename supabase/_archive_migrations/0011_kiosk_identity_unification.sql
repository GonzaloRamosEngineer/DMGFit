-- Kiosk identity unification: profiles-based DNI/phone lookup + coach check-in support.

-- VALIDACIONES PREVIAS (ejecutar manualmente para inspección)
-- 1) ¿Existe la tabla de asignación de coaches?
-- select to_regclass('public.schedule_coaches') as schedule_coaches_regclass;
--
-- 2) ¿Qué columnas tiene?
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'schedule_coaches'
-- order by ordinal_position;
--
-- 3) ¿Qué FKs/constraints tiene?
-- select conname, pg_get_constraintdef(c.oid) as definition
-- from pg_constraint c
-- join pg_class t on t.oid = c.conrelid
-- join pg_namespace n on n.oid = t.relnamespace
-- where n.nspname = 'public'
--   and t.relname = 'schedule_coaches';

CREATE OR REPLACE FUNCTION public.only_digits(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(coalesce(p_text,''), '\D', '', 'g'), '');
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dni text,
  ADD COLUMN IF NOT EXISTS dni_normalized text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_normalized text;

UPDATE public.profiles p
SET
  dni = coalesce(p.dni, a.dni),
  dni_normalized = coalesce(p.dni_normalized, public.only_digits(a.dni)),
  phone = coalesce(p.phone, a.phone),
  phone_normalized = coalesce(p.phone_normalized, public.only_digits(a.phone))
FROM public.athletes a
WHERE a.profile_id = p.id;

UPDATE public.profiles p
SET
  phone = coalesce(p.phone, c.phone),
  phone_normalized = coalesce(p.phone_normalized, public.only_digits(c.phone))
FROM public.coaches c
WHERE c.profile_id = p.id;


create or replace function public.set_profiles_identity_normalized()
returns trigger
language plpgsql
as $$
begin
  new.dni_normalized := public.only_digits(new.dni);
  new.phone_normalized := public.only_digits(new.phone);
  return new;
end;
$$;

drop trigger if exists trg_profiles_identity_normalized on public.profiles;
create trigger trg_profiles_identity_normalized
before insert or update of dni, phone on public.profiles
for each row
execute function public.set_profiles_identity_normalized();

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_dni_normalized
  ON public.profiles(dni_normalized)
  WHERE dni_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_phone_normalized
  ON public.profiles(phone_normalized)
  WHERE phone_normalized IS NOT NULL;

ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS coach_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'access_logs_coach_id_fkey'
  ) then
    alter table public.access_logs
      add constraint access_logs_coach_id_fkey
      foreign key (coach_id) references public.coaches(id);
  end if;
end
$$;

CREATE INDEX IF NOT EXISTS idx_access_logs_coach_id
  ON public.access_logs(coach_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_access_logs_idempotency_coach
  ON public.access_logs(idempotency_key)
  WHERE coach_id IS NOT NULL;

insert into public.kiosk_reason_codes (code, category, description, is_active)
values
  ('MISSING_IDENTIFIER', 'DENIED', 'No se recibió DNI ni teléfono', true),
  ('USER_NOT_FOUND', 'DENIED', 'No se encontró usuario por DNI/teléfono', true),
  ('COACH_NOT_FOUND', 'DENIED', 'Perfil de profesor sin registro en coaches', true),
  ('COACH_OUT_OF_WINDOW', 'DENIED', 'Profesor fuera de horario asignado', true),
  ('COACH_SCHEDULE_NOT_CONFIGURED', 'SYSTEM', 'No existe configuración de schedule_coaches para validar coaches', true)
on conflict (code) do update
set
  category = excluded.category,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

create or replace function public.kiosk_check_in(
  p_dni text default null,
  p_phone text default null,
  p_now timestamptz default now(),
  p_timezone text default 'America/Argentina/Buenos_Aires'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identifier text := public.only_digits(coalesce(p_dni, p_phone));
  v_profile_id uuid;
  v_role text;
  v_full_name text;

  v_athlete_id uuid;
  v_athlete_status text;
  v_athlete_name text;
  v_plan_name text;
  v_avatar_url text;

  v_coach_id uuid;

  v_weekly_schedule_id uuid;
  v_slot_count integer := 0;
  v_day_assignment_count integer := 0;

  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_local_dow integer;

  v_cycle_start timestamptz;
  v_expiration timestamptz;
  v_counter_id uuid;
  v_remaining integer;

  v_idempotency_key text;
  v_allowed boolean := false;
  v_reason_code text := 'ERROR';
  v_message text := 'Error inesperado';
  v_actor_type text := null;
  v_has_schedule_coaches boolean := to_regclass('public.schedule_coaches') is not null;
begin
  v_local_now := p_now at time zone p_timezone;
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  v_local_dow := extract(dow from v_local_now)::integer;

  if v_identifier is null then
    v_reason_code := 'MISSING_IDENTIFIER';
    v_message := 'Debes ingresar DNI o teléfono.';
    v_idempotency_key := 'missing:none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'message', v_message,
      'weekly_schedule_id', null,
      'remaining', null,
      'actor_type', null,
      'athlete_id', null,
      'coach_id', null,
      'full_name', null
    );
  end if;

  -- 1) Source-of-truth lookup in profiles (normalized identity).
  select p.id, p.role, p.full_name
  into v_profile_id, v_role, v_full_name
  from public.profiles p
  where p.dni_normalized = v_identifier
  limit 1;

  if v_profile_id is null then
    select p.id, p.role, p.full_name
    into v_profile_id, v_role, v_full_name
    from public.profiles p
    where p.phone_normalized = v_identifier
    limit 1;
  end if;

  -- 2) Legacy fallback from athletes (transition period).
  if v_profile_id is null then
    select p.id, p.role, p.full_name, a.id, a.status
    into v_profile_id, v_role, v_full_name, v_athlete_id, v_athlete_status
    from public.athletes a
    join public.profiles p on p.id = a.profile_id
    where public.only_digits(a.dni) = v_identifier
       or public.only_digits(a.phone) = v_identifier
    limit 1;
  end if;

  if v_profile_id is null then
    v_reason_code := 'USER_NOT_FOUND';
    v_message := 'Usuario no encontrado.';
    v_idempotency_key := v_identifier || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'message', v_message,
      'weekly_schedule_id', null,
      'remaining', null,
      'actor_type', null,
      'athlete_id', null,
      'coach_id', null,
      'full_name', null
    );
  end if;

  -- Branch COACH
  if v_role = 'coach' or v_role = 'profesor' then
    v_actor_type := 'coach';

    select c.id
    into v_coach_id
    from public.coaches c
    where c.profile_id = v_profile_id
    limit 1;

    if v_coach_id is null then
      v_reason_code := 'COACH_NOT_FOUND';
      v_message := 'Perfil de profesor sin registro en coaches.';
      v_idempotency_key := coalesce(v_profile_id::text, v_identifier) || ':none:' || v_local_date::text;

      insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
      values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', null,
        'full_name', v_full_name
      );
    end if;

    if not v_has_schedule_coaches then
      v_reason_code := 'COACH_SCHEDULE_NOT_CONFIGURED';
      v_message := 'No existe configuración de horarios para profesores (schedule_coaches).';
      v_idempotency_key := v_coach_id::text || ':none:' || v_local_date::text;

      insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
      values (null, v_coach_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', v_coach_id,
        'full_name', v_full_name
      );
    end if;

    select count(*)::int
    into v_slot_count
    from public.schedule_coaches sc
    join public.weekly_schedule ws on ws.id = sc.schedule_id
    where sc.coach_id = v_coach_id
      and ws.day_of_week = v_local_dow
      and v_local_time >= ws.start_time
      and v_local_time < ws.end_time;

    if v_slot_count = 0 then
      v_reason_code := 'COACH_OUT_OF_WINDOW';
      v_message := 'Profesor fuera de horario asignado.';
      v_idempotency_key := v_coach_id::text || ':none:' || v_local_date::text;

      insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
      values (null, v_coach_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', v_coach_id,
        'full_name', v_full_name
      );
    end if;

    if v_slot_count > 1 then
      v_reason_code := 'AMBIGUOUS_SLOT';
      v_message := 'Más de un horario coincide para este check-in.';
      v_idempotency_key := v_coach_id::text || ':none:' || v_local_date::text;

      insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
      values (null, v_coach_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', v_coach_id,
        'full_name', v_full_name
      );
    end if;

    select ws.id
    into v_weekly_schedule_id
    from public.schedule_coaches sc
    join public.weekly_schedule ws on ws.id = sc.schedule_id
    where sc.coach_id = v_coach_id
      and ws.day_of_week = v_local_dow
      and v_local_time >= ws.start_time
      and v_local_time < ws.end_time
    limit 1;

    v_idempotency_key := v_coach_id::text || ':' || v_weekly_schedule_id::text || ':' || v_local_date::text;

    perform pg_advisory_xact_lock(
      hashtextextended(v_idempotency_key, 0)
    );

    if exists (
      select 1
      from public.access_logs al
      where al.coach_id = v_coach_id
        and al.weekly_schedule_id = v_weekly_schedule_id
        and al.local_checkin_date = v_local_date
        and al.access_granted is true
    ) then
      v_reason_code := 'DUPLICATE_CHECKIN';
      v_message := 'Check-in duplicado para este turno y día.';

      insert into public.access_logs (
        athlete_id, coach_id, weekly_schedule_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key
      ) values (
        null, v_coach_id, v_weekly_schedule_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key
      );

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', v_weekly_schedule_id,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', v_coach_id,
        'full_name', v_full_name
      );
    end if;

    v_allowed := true;
    v_reason_code := 'OK';
    v_message := 'Acceso permitido.';

    insert into public.access_logs (
      athlete_id, coach_id, weekly_schedule_id, access_granted, reason_code, rejection_reason, local_checkin_date, idempotency_key
    ) values (
      null, v_coach_id, v_weekly_schedule_id, true, v_reason_code, null, v_local_date, v_idempotency_key
    );

    return jsonb_build_object(
      'allowed', true,
      'reason_code', v_reason_code,
      'message', v_message,
      'weekly_schedule_id', v_weekly_schedule_id,
      'remaining', null,
      'actor_type', v_actor_type,
      'athlete_id', null,
      'coach_id', v_coach_id,
      'full_name', v_full_name
    );
  end if;

  -- Branch ATHLETE (existing behavior preserved; only identity lookup changed)
  v_actor_type := 'athlete';

  if v_athlete_id is null then
    select a.id, a.status
    into v_athlete_id, v_athlete_status
    from public.athletes a
    where a.profile_id = v_profile_id
    limit 1;
  end if;

  if v_athlete_id is not null then
    select p.full_name, pl.name, p.avatar_url
    into v_athlete_name, v_plan_name, v_avatar_url
    from public.athletes a
    left join public.profiles p on p.id = a.profile_id
    left join public.plans pl on pl.id = a.plan_id
    where a.id = v_athlete_id
    limit 1;
  end if;

  if v_athlete_id is null then
    v_reason_code := 'ATHLETE_NOT_FOUND';
    v_message := 'Atleta no encontrado.';
    v_idempotency_key := v_identifier || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', null,
      'coach_id', null,
      'weekly_schedule_id', null,
      'athlete_name', null,
      'plan_name', null,
      'avatar_url', null,
      'actor_type', v_actor_type,
      'full_name', v_full_name,
      'message', v_message
    );
  end if;

  if v_athlete_status <> 'active' then
    v_reason_code := 'NOT_ACTIVE';
    v_message := 'Atleta INACTIVO. Consulte en administración.';
    v_idempotency_key := v_athlete_id::text || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'coach_id', null,
      'weekly_schedule_id', null,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', v_message
    );
  end if;

  select count(*)::int
  into v_slot_count
  from public.athlete_slot_assignments asa
  join public.weekly_schedule ws on ws.id = asa.weekly_schedule_id
  where asa.athlete_id = v_athlete_id
    and asa.is_active is true
    and asa.starts_on <= v_local_date
    and (asa.ends_on is null or asa.ends_on >= v_local_date)
    and ws.day_of_week = v_local_dow
    and v_local_time >= ws.start_time
    and v_local_time < ws.end_time;

  if v_slot_count > 1 then
    v_reason_code := 'AMBIGUOUS_SLOT';
    v_message := 'Más de un horario coincide para este check-in.';
    v_idempotency_key := v_athlete_id::text || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'coach_id', null,
      'weekly_schedule_id', null,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', v_message
    );
  end if;

  if v_slot_count = 0 then
    select count(*)::int
    into v_day_assignment_count
    from public.athlete_slot_assignments asa
    join public.weekly_schedule ws on ws.id = asa.weekly_schedule_id
    where asa.athlete_id = v_athlete_id
      and asa.is_active is true
      and asa.starts_on <= v_local_date
      and (asa.ends_on is null or asa.ends_on >= v_local_date)
      and ws.day_of_week = v_local_dow;

    if v_day_assignment_count > 0 then
      v_reason_code := 'OUT_OF_WINDOW';
      v_message := 'Check-in fuera de la ventana horaria asignada.';
    else
      v_reason_code := 'NO_ASSIGNMENT';
      v_message := 'No hay asignación activa para este día/horario.';
    end if;

    v_idempotency_key := v_athlete_id::text || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'coach_id', null,
      'weekly_schedule_id', null,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', v_message
    );
  end if;

  select asa.weekly_schedule_id
  into v_weekly_schedule_id
  from public.athlete_slot_assignments asa
  join public.weekly_schedule ws on ws.id = asa.weekly_schedule_id
  where asa.athlete_id = v_athlete_id
    and asa.is_active is true
    and asa.starts_on <= v_local_date
    and (asa.ends_on is null or asa.ends_on >= v_local_date)
    and ws.day_of_week = v_local_dow
    and v_local_time >= ws.start_time
    and v_local_time < ws.end_time
  limit 1;

  v_idempotency_key := v_athlete_id::text || ':' || v_weekly_schedule_id::text || ':' || v_local_date::text;

  select p.payment_date::timestamptz
  into v_cycle_start
  from public.payments p
  where p.athlete_id = v_athlete_id
    and p.status = 'paid'
  order by p.payment_date desc
  limit 1;

  if v_cycle_start is null then
    v_cycle_start := p_now - interval '30 days';
  end if;

  v_expiration := v_cycle_start + interval '30 days';

  if p_now > v_expiration then
    v_reason_code := 'PAYMENT_BLOCKED';
    v_message := 'Cuota vencida. Regularizá tu pago para continuar.';

    insert into public.access_logs (
      athlete_id, coach_id, weekly_schedule_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key
    ) values (
      v_athlete_id, null, v_weekly_schedule_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key
    );

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'coach_id', null,
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', v_message
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_athlete_id::text || ':' || v_weekly_schedule_id::text || ':' || v_local_date::text, 0)
  );

  if exists (
    select 1
    from public.access_logs al
    where al.athlete_id = v_athlete_id
      and al.weekly_schedule_id = v_weekly_schedule_id
      and al.local_checkin_date = v_local_date
      and al.access_granted is true
  ) then
    select amc.allowed_sessions - amc.consumed_sessions
    into v_remaining
    from public.athlete_monthly_counters amc
    where amc.athlete_id = v_athlete_id
      and amc.period_start <= v_local_date
      and amc.period_end >= v_local_date
    order by amc.period_start desc
    limit 1;

    v_reason_code := 'DUPLICATE_CHECKIN';
    v_message := 'Check-in duplicado para este turno y día.';

    insert into public.access_logs (
      athlete_id,
      coach_id,
      weekly_schedule_id,
      access_granted,
      rejection_reason,
      reason_code,
      remaining_sessions,
      local_checkin_date,
      idempotency_key
    ) values (
      v_athlete_id,
      null,
      v_weekly_schedule_id,
      false,
      v_message,
      v_reason_code,
      v_remaining,
      v_local_date,
      v_idempotency_key
    );

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', v_remaining,
      'athlete_id', v_athlete_id,
      'coach_id', null,
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', v_message
    );
  end if;

  select amc.id
  into v_counter_id
  from public.athlete_monthly_counters amc
  where amc.athlete_id = v_athlete_id
    and amc.period_start <= v_local_date
    and amc.period_end >= v_local_date
  order by amc.period_start desc
  limit 1
  for update;

  if v_counter_id is null then
    v_reason_code := 'NO_BALANCE';
    v_message := 'No existe contador vigente para consumir sesiones.';

    insert into public.access_logs (
      athlete_id,
      coach_id,
      weekly_schedule_id,
      access_granted,
      rejection_reason,
      reason_code,
      local_checkin_date,
      idempotency_key
    ) values (
      v_athlete_id,
      null,
      v_weekly_schedule_id,
      false,
      v_message,
      v_reason_code,
      v_local_date,
      v_idempotency_key
    );

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'coach_id', null,
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', v_message
    );
  end if;

  update public.athlete_monthly_counters amc
  set consumed_sessions = amc.consumed_sessions + 1
  where amc.id = v_counter_id
    and amc.consumed_sessions < amc.allowed_sessions
  returning (amc.allowed_sessions - amc.consumed_sessions)
  into v_remaining;

  if not found then
    v_reason_code := 'NO_BALANCE';
    v_message := 'Sin saldo de sesiones disponible.';

    insert into public.access_logs (
      athlete_id,
      coach_id,
      weekly_schedule_id,
      access_granted,
      rejection_reason,
      reason_code,
      local_checkin_date,
      idempotency_key
    ) values (
      v_athlete_id,
      null,
      v_weekly_schedule_id,
      false,
      v_message,
      v_reason_code,
      v_local_date,
      v_idempotency_key
    );

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', 0,
      'athlete_id', v_athlete_id,
      'coach_id', null,
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', v_message
    );
  end if;

  v_allowed := true;
  v_reason_code := 'OK';
  v_message := 'Acceso permitido.';

  insert into public.access_logs (
    athlete_id,
    coach_id,
    weekly_schedule_id,
    access_granted,
    reason_code,
    rejection_reason,
    remaining_sessions,
    local_checkin_date,
    idempotency_key
  ) values (
    v_athlete_id,
    null,
    v_weekly_schedule_id,
    true,
    v_reason_code,
    null,
    v_remaining,
    v_local_date,
    v_idempotency_key
  );

  return jsonb_build_object(
    'allowed', v_allowed,
    'reason_code', v_reason_code,
    'remaining', v_remaining,
    'athlete_id', v_athlete_id,
    'coach_id', null,
    'weekly_schedule_id', v_weekly_schedule_id,
    'athlete_name', v_athlete_name,
    'plan_name', v_plan_name,
    'avatar_url', v_avatar_url,
    'actor_type', v_actor_type,
    'full_name', coalesce(v_athlete_name, v_full_name),
    'message', v_message
  );

exception
  when others then
    begin
      insert into public.access_logs (
        athlete_id,
        coach_id,
        weekly_schedule_id,
        access_granted,
        reason_code,
        rejection_reason,
        local_checkin_date,
        idempotency_key
      ) values (
        v_athlete_id,
        v_coach_id,
        v_weekly_schedule_id,
        false,
        'ERROR',
        coalesce(sqlerrm, 'Error inesperado.'),
        coalesce(v_local_date, (p_now at time zone p_timezone)::date),
        coalesce(v_idempotency_key, coalesce(v_identifier, 'unknown') || ':' || coalesce(v_weekly_schedule_id::text, 'none') || ':' || coalesce(v_local_date, (p_now at time zone p_timezone)::date)::text)
      );
    exception
      when others then
        null;
    end;

    return jsonb_build_object(
      'allowed', false,
      'reason_code', 'ERROR',
      'remaining', null,
      'athlete_id', v_athlete_id,
      'coach_id', v_coach_id,
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'actor_type', v_actor_type,
      'full_name', coalesce(v_athlete_name, v_full_name),
      'message', coalesce(sqlerrm, 'Error inesperado.')
    );
end;
$$;

comment on function public.kiosk_check_in(text, text, timestamptz, text) is
'Atomic kiosk check-in RPC. Identity lookup uses profiles normalized dni/phone first, then legacy athlete fallback; supports athlete+coach.';
