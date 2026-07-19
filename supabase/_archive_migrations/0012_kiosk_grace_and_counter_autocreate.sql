-- Kiosk hotfix: auto-create athlete counters + payment grace period + UI-friendly RPC payload.

insert into public.kiosk_reason_codes (code, category, description, is_active)
values
  ('PAYMENT_LATE_GRACE', 'WARNING', 'Pago vencido dentro de período de gracia', true),
  ('COUNTER_CREATED', 'SYSTEM', 'Contador mensual creado automáticamente', true)
on conflict (code) do update
set
  category = excluded.category,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

create unique index if not exists uq_athlete_monthly_counters_period
  on public.athlete_monthly_counters(athlete_id, period_start, period_end);

create or replace function public.kiosk_check_in(
  p_dni text default null,
  p_phone text default null,
  p_now timestamptz default now(),
  p_timezone text default 'America/Argentina/Buenos_Aires',
  p_grace_days integer default 3,
  p_autocreate_counter boolean default true
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

  v_last_paid_at timestamptz;
  v_cycle_start timestamptz;
  v_expiration timestamptz;
  v_days_late integer := 0;
  v_is_grace boolean := false;

  v_counter_id uuid;
  v_period_start date;
  v_period_end date;
  v_allowed_sessions integer;
  v_visits_per_week integer;
  v_remaining integer;

  v_idempotency_key text;
  v_allowed boolean := false;
  v_reason_code text := 'ERROR';
  v_message text := 'Error inesperado';
  v_actor_type text := null;
  v_has_schedule_coaches boolean := to_regclass('public.schedule_coaches') is not null;
  v_ui_status text := 'DENIED';
  v_ui_color text := 'red';
  v_details jsonb := '{}'::jsonb;
begin
  v_local_now := p_now at time zone p_timezone;
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  v_local_dow := extract(dow from v_local_now)::integer;

  if v_identifier is null then
    v_reason_code := 'MISSING_IDENTIFIER';
    v_message := 'Debes ingresar DNI o teléfono.';
    v_idempotency_key := 'missing:none:' || v_local_date::text;
    v_ui_status := 'DENIED';
    v_ui_color := 'red';

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'expires_at', null,
      'days_late', null,
      'grace_days', p_grace_days,
      'plan_name', null,
      'actor_type', null,
      'weekly_schedule_id', null,
      'local_date', v_local_date
    );

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'message', v_message,
      'weekly_schedule_id', null,
      'remaining', null,
      'actor_type', null,
      'athlete_id', null,
      'coach_id', null,
      'full_name', null,
      'athlete_name', null,
      'plan_name', null,
      'avatar_url', null,
      'ui_status', v_ui_status,
      'ui_color', v_ui_color,
      'details', v_details
    );
  end if;

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

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'expires_at', null,
      'days_late', null,
      'grace_days', p_grace_days,
      'plan_name', null,
      'actor_type', null,
      'weekly_schedule_id', null,
      'local_date', v_local_date
    );

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'message', v_message,
      'weekly_schedule_id', null,
      'remaining', null,
      'actor_type', null,
      'athlete_id', null,
      'coach_id', null,
      'full_name', null,
      'athlete_name', null,
      'plan_name', null,
      'avatar_url', null,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
    );
  end if;

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

      v_details := jsonb_build_object(
        'remaining', null,
        'period_start', null,
        'period_end', null,
        'expires_at', null,
        'days_late', null,
        'grace_days', p_grace_days,
        'plan_name', null,
        'actor_type', v_actor_type,
        'weekly_schedule_id', null,
        'local_date', v_local_date
      );

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', null,
        'full_name', v_full_name,
        'athlete_name', null,
        'plan_name', null,
        'avatar_url', null,
        'ui_status', 'DENIED',
        'ui_color', 'red',
        'details', v_details
      );
    end if;

    if not v_has_schedule_coaches then
      v_reason_code := 'COACH_SCHEDULE_NOT_CONFIGURED';
      v_message := 'No existe configuración de horarios para profesores (schedule_coaches).';
      v_idempotency_key := v_coach_id::text || ':none:' || v_local_date::text;

      insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
      values (null, v_coach_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

      v_details := jsonb_build_object(
        'remaining', null,
        'period_start', null,
        'period_end', null,
        'expires_at', null,
        'days_late', null,
        'grace_days', p_grace_days,
        'plan_name', null,
        'actor_type', v_actor_type,
        'weekly_schedule_id', null,
        'local_date', v_local_date
      );

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', v_coach_id,
        'full_name', v_full_name,
        'athlete_name', null,
        'plan_name', null,
        'avatar_url', null,
        'ui_status', 'DENIED',
        'ui_color', 'red',
        'details', v_details
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

      v_details := jsonb_build_object(
        'remaining', null,
        'period_start', null,
        'period_end', null,
        'expires_at', null,
        'days_late', null,
        'grace_days', p_grace_days,
        'plan_name', null,
        'actor_type', v_actor_type,
        'weekly_schedule_id', null,
        'local_date', v_local_date
      );

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', v_coach_id,
        'full_name', v_full_name,
        'athlete_name', null,
        'plan_name', null,
        'avatar_url', null,
        'ui_status', 'DENIED',
        'ui_color', 'red',
        'details', v_details
      );
    end if;

    if v_slot_count > 1 then
      v_reason_code := 'AMBIGUOUS_SLOT';
      v_message := 'Más de un horario coincide para este check-in.';
      v_idempotency_key := v_coach_id::text || ':none:' || v_local_date::text;

      insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
      values (null, v_coach_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

      v_details := jsonb_build_object(
        'remaining', null,
        'period_start', null,
        'period_end', null,
        'expires_at', null,
        'days_late', null,
        'grace_days', p_grace_days,
        'plan_name', null,
        'actor_type', v_actor_type,
        'weekly_schedule_id', null,
        'local_date', v_local_date
      );

      return jsonb_build_object(
        'allowed', false,
        'reason_code', v_reason_code,
        'message', v_message,
        'weekly_schedule_id', null,
        'remaining', null,
        'actor_type', v_actor_type,
        'athlete_id', null,
        'coach_id', v_coach_id,
        'full_name', v_full_name,
        'athlete_name', null,
        'plan_name', null,
        'avatar_url', null,
        'ui_status', 'DENIED',
        'ui_color', 'red',
        'details', v_details
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

    perform pg_advisory_xact_lock(hashtextextended(v_idempotency_key, 0));

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

      v_details := jsonb_build_object(
        'remaining', null,
        'period_start', null,
        'period_end', null,
        'expires_at', null,
        'days_late', null,
        'grace_days', p_grace_days,
        'plan_name', null,
        'actor_type', v_actor_type,
        'weekly_schedule_id', v_weekly_schedule_id,
        'local_date', v_local_date
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
        'full_name', v_full_name,
        'athlete_name', null,
        'plan_name', null,
        'avatar_url', null,
        'ui_status', 'DENIED',
        'ui_color', 'red',
        'details', v_details
      );
    end if;

    v_reason_code := 'OK';
    v_message := 'Acceso permitido.';

    insert into public.access_logs (
      athlete_id, coach_id, weekly_schedule_id, access_granted, reason_code, rejection_reason, local_checkin_date, idempotency_key
    ) values (
      null, v_coach_id, v_weekly_schedule_id, true, v_reason_code, null, v_local_date, v_idempotency_key
    );

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'expires_at', null,
      'days_late', null,
      'grace_days', p_grace_days,
      'plan_name', null,
      'actor_type', v_actor_type,
      'weekly_schedule_id', v_weekly_schedule_id,
      'local_date', v_local_date
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
      'full_name', v_full_name,
      'athlete_name', null,
      'plan_name', null,
      'avatar_url', null,
      'ui_status', 'SUCCESS',
      'ui_color', 'green',
      'details', v_details
    );
  end if;

  v_actor_type := 'athlete';

  if v_athlete_id is null then
    select a.id, a.status
    into v_athlete_id, v_athlete_status
    from public.athletes a
    where a.profile_id = v_profile_id
    limit 1;
  end if;

  if v_athlete_id is not null then
    select p.full_name, pl.name, p.avatar_url, a.visits_per_week
    into v_athlete_name, v_plan_name, v_avatar_url, v_visits_per_week
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

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'expires_at', null,
      'days_late', null,
      'grace_days', p_grace_days,
      'plan_name', null,
      'actor_type', v_actor_type,
      'weekly_schedule_id', null,
      'local_date', v_local_date
    );

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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
    );
  end if;

  if v_athlete_status <> 'active' then
    v_reason_code := 'NOT_ACTIVE';
    v_message := 'Atleta INACTIVO. Consulte en administración.';
    v_idempotency_key := v_athlete_id::text || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'expires_at', null,
      'days_late', null,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', null,
      'local_date', v_local_date
    );

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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
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

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'expires_at', null,
      'days_late', null,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', null,
      'local_date', v_local_date
    );

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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
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

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', null,
      'period_end', null,
      'expires_at', null,
      'days_late', null,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', null,
      'local_date', v_local_date
    );

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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
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
  into v_last_paid_at
  from public.payments p
  where p.athlete_id = v_athlete_id
    and p.status = 'paid'
  order by p.payment_date desc
  limit 1;

  if v_last_paid_at is null then
    v_cycle_start := p_now;
    v_period_start := v_local_date;
    v_period_end := v_local_date + 29;
  else
    v_cycle_start := v_last_paid_at;
    v_period_start := (v_last_paid_at at time zone p_timezone)::date;
    v_period_end := v_period_start + 29;
  end if;

  v_expiration := v_cycle_start + interval '30 days';

  if p_now > v_expiration then
    v_days_late := floor(extract(epoch from (p_now - v_expiration)) / 86400)::int;
  else
    v_days_late := 0;
  end if;

  if p_now > v_expiration and v_days_late > greatest(coalesce(p_grace_days, 0), 0) then
    v_reason_code := 'PAYMENT_BLOCKED';
    v_message := 'Cuota vencida. Regularizá tu pago para continuar.';

    insert into public.access_logs (
      athlete_id, coach_id, weekly_schedule_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key
    ) values (
      v_athlete_id, null, v_weekly_schedule_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key
    );

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'expires_at', v_expiration,
      'days_late', v_days_late,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', v_weekly_schedule_id,
      'local_date', v_local_date
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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
    );
  end if;

  if p_now > v_expiration and v_days_late <= greatest(coalesce(p_grace_days, 0), 0) then
    v_is_grace := true;
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
    select (amc.allowed_sessions - amc.consumed_sessions)
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

    v_details := jsonb_build_object(
      'remaining', v_remaining,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'expires_at', v_expiration,
      'days_late', v_days_late,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', v_weekly_schedule_id,
      'local_date', v_local_date
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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
    );
  end if;

  select amc.id, amc.allowed_sessions, amc.consumed_sessions
  into v_counter_id, v_allowed_sessions, v_remaining
  from public.athlete_monthly_counters amc
  where amc.athlete_id = v_athlete_id
    and amc.period_start <= v_local_date
    and amc.period_end >= v_local_date
  order by amc.period_start desc
  limit 1
  for update;

  if v_counter_id is null and coalesce(p_autocreate_counter, true) then
    v_allowed_sessions := case
      when coalesce(v_visits_per_week, 0) > 0 then greatest(v_visits_per_week * 4, 1)
      else 12
    end;

    insert into public.athlete_monthly_counters(
      athlete_id,
      period_start,
      period_end,
      allowed_sessions,
      consumed_sessions
    ) values (
      v_athlete_id,
      v_period_start,
      v_period_end,
      v_allowed_sessions,
      0
    ) on conflict (athlete_id, period_start, period_end) do nothing;

    select amc.id, amc.allowed_sessions, amc.consumed_sessions
    into v_counter_id, v_allowed_sessions, v_remaining
    from public.athlete_monthly_counters amc
    where amc.athlete_id = v_athlete_id
      and amc.period_start <= v_local_date
      and amc.period_end >= v_local_date
    order by amc.period_start desc
    limit 1
    for update;
  end if;

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

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'expires_at', v_expiration,
      'days_late', v_days_late,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', v_weekly_schedule_id,
      'local_date', v_local_date
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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
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

    v_details := jsonb_build_object(
      'remaining', 0,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'expires_at', v_expiration,
      'days_late', v_days_late,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', v_weekly_schedule_id,
      'local_date', v_local_date
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
      'message', v_message,
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
    );
  end if;

  v_allowed := true;
  if v_is_grace then
    v_reason_code := 'PAYMENT_LATE_GRACE';
    v_message := format('Acceso permitido con excepción: cuota vencida hace %s días. Pasá por recepción.', v_days_late);
    v_ui_status := 'WARNING';
    v_ui_color := 'yellow';
  else
    v_reason_code := 'OK';
    v_message := 'Acceso permitido.';
    v_ui_status := 'SUCCESS';
    v_ui_color := 'green';
  end if;

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

  v_details := jsonb_build_object(
    'remaining', v_remaining,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'expires_at', v_expiration,
    'days_late', v_days_late,
    'grace_days', p_grace_days,
    'plan_name', v_plan_name,
    'actor_type', v_actor_type,
    'weekly_schedule_id', v_weekly_schedule_id,
    'local_date', v_local_date
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
    'message', v_message,
    'ui_status', v_ui_status,
    'ui_color', v_ui_color,
    'details', v_details
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

    v_details := jsonb_build_object(
      'remaining', null,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'expires_at', v_expiration,
      'days_late', v_days_late,
      'grace_days', p_grace_days,
      'plan_name', v_plan_name,
      'actor_type', v_actor_type,
      'weekly_schedule_id', v_weekly_schedule_id,
      'local_date', coalesce(v_local_date, (p_now at time zone p_timezone)::date)
    );

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
      'message', coalesce(sqlerrm, 'Error inesperado.'),
      'ui_status', 'DENIED',
      'ui_color', 'red',
      'details', v_details
    );
end;
$$;

comment on function public.kiosk_check_in(text, text, timestamptz, text, integer, boolean) is
'Atomic kiosk check-in RPC with profiles-based identity, coach support, grace period and counter auto-create.';

-- SQL TEST CHECKLIST (manual)
-- 1) Atleta con assignment válido y sin counter:
--    select public.kiosk_check_in(p_dni := '<dni>', p_now := now(), p_timezone := 'America/Argentina/Buenos_Aires');
--    => Debe autocrear counter y permitir.
--
-- 2) Pago vencido y days_late <= grace:
--    select public.kiosk_check_in(p_dni := '<dni>', p_grace_days := 3);
--    => allowed=true, reason_code=PAYMENT_LATE_GRACE, ui_status=WARNING.
--
-- 3) Pago vencido y days_late > grace:
--    select public.kiosk_check_in(p_dni := '<dni>', p_grace_days := 0);
--    => allowed=false, reason_code=PAYMENT_BLOCKED, ui_status=DENIED.
--
-- 4) Repetido mismo día/slot:
--    Ejecutar dos veces el mismo check-in en el día.
--    => segundo: DUPLICATE_CHECKIN y sin consumo adicional.
--
-- 5) Coach con schedule_coaches asignado en ventana:
--    select public.kiosk_check_in(p_phone := '<phone_coach>');
--    => allowed=true, actor_type=coach, ui_status=SUCCESS.
