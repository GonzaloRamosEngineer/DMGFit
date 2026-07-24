-- 0001_kiosk_flexible_access.sql
-- Flexibiliza el control de acceso del kiosco (rama ATLETA) sin romper la
-- idempotencia, el consumo de saldo ni el registro de intentos.
--
-- Decisiones de producto (2026-07-22):
--   * NO_TURNO       (fuera de sus días/horarios asignados) -> se PERMITE con
--                    aviso (WARNING) y se le recuerdan los turnos que eligió.
--   * TURNO_FULL     (turno completo)                       -> se PERMITE con aviso.
--   * PAYMENT_BLOCKED(cuota vencida más allá de la gracia)  -> se PERMITE con aviso.
--   * NO_BALANCE     (sin accesos del mes)                  -> SIGUE denegando (rojo).
--   * NOT_ACTIVE     (cuenta inactiva/baja)                 -> SIGUE denegando (rojo).
--   * No encontrados (MISSING/USER/ATHLETE/COACH_NOT_FOUND) -> estado NEUTRO
--                    (ui_status='NOTICE', NO rojo). Se registra el intento igual.
--
-- La rama COACH queda BYTE-IDÉNTICA a 0024_coach_flexible_checkin (fichaje flexible).
-- Todos los caminos siguen insertando en public.access_logs (registro de intentos).

CREATE OR REPLACE FUNCTION "public"."kiosk_check_in"("p_dni" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_now" timestamp with time zone DEFAULT "now"(), "p_timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text", "p_grace_days" integer DEFAULT 3, "p_autocreate_counter" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$

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
  v_ui_status text := 'DENIED';
  v_ui_color text := 'red';
  v_details jsonb := '{}'::jsonb;
  v_plan_id uuid;
  v_capacity integer;
  v_occupied integer := 0;
  v_slot_start time;
  v_already_today boolean := false;

  -- Flexibilización (rama atleta)
  v_assigned_text text;
  v_has_assignments boolean := false;
  v_in_own_slot boolean := false;
  v_off_schedule boolean := false;
  v_overdue boolean := false;
  v_capacity_full boolean := false;
  v_warn boolean := false;
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

    v_details := jsonb_build_object(
      'remaining', null, 'period_start', null, 'period_end', null, 'expires_at', null,
      'days_late', null, 'grace_days', p_grace_days, 'plan_name', null,
      'actor_type', null, 'weekly_schedule_id', null, 'local_date', v_local_date
    );

    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', null, 'remaining', null, 'actor_type', null, 'athlete_id', null,
      'coach_id', null, 'full_name', null, 'athlete_name', null, 'plan_name', null, 'avatar_url', null,
      'ui_status', 'NOTICE', 'ui_color', 'stone', 'details', v_details
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
    -- No encontrado: estado NEUTRO (no rojo), pero registramos el intento.
    v_reason_code := 'USER_NOT_FOUND';
    v_message := 'No te encontramos. Pasá por recepción.';
    v_idempotency_key := v_identifier || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    v_details := jsonb_build_object(
      'remaining', null, 'period_start', null, 'period_end', null, 'expires_at', null,
      'days_late', null, 'grace_days', p_grace_days, 'plan_name', null,
      'actor_type', null, 'weekly_schedule_id', null, 'local_date', v_local_date
    );

    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', null, 'remaining', null, 'actor_type', null, 'athlete_id', null,
      'coach_id', null, 'full_name', null, 'athlete_name', null, 'plan_name', null, 'avatar_url', null,
      'ui_status', 'NOTICE', 'ui_color', 'stone', 'details', v_details
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
        'remaining', null, 'period_start', null, 'period_end', null, 'expires_at', null,
        'days_late', null, 'grace_days', p_grace_days, 'plan_name', null,
        'actor_type', v_actor_type, 'weekly_schedule_id', null, 'local_date', v_local_date
      );

      return jsonb_build_object(
        'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
        'weekly_schedule_id', null, 'remaining', null, 'actor_type', v_actor_type,
        'athlete_id', null, 'coach_id', null, 'full_name', v_full_name, 'athlete_name', null,
        'plan_name', null, 'avatar_url', null, 'ui_status', 'NOTICE', 'ui_color', 'stone', 'details', v_details
      );
    end if;

    -- Asistencia FLEXIBLE del profe: ficha cuando llega, tenga o no un turno
    -- asignado a esa hora. El turno es un "plus": si hay uno que matchea se
    -- adjunta (weekly_schedule_id); si no, se registra igual ("cuándo vino").
    select ws.id
    into v_weekly_schedule_id
    from public.plan_schedule_slot_coaches pssc
    join public.plan_schedule_slots pss on pss.id = pssc.plan_schedule_slot_id
    join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
    where pssc.coach_id = v_coach_id
      and ws.day_of_week = v_local_dow
      and v_local_time >= ws.start_time
      and v_local_time < ws.end_time
    order by ws.start_time desc
    limit 1;

    -- Un fichaje por día (lock + idempotencia por coach+día).
    v_idempotency_key := v_coach_id::text || ':day:' || v_local_date::text;
    perform pg_advisory_xact_lock(hashtextextended(v_idempotency_key, 0));

    if exists (
      select 1 from public.access_logs al
      where al.coach_id = v_coach_id
        and al.local_checkin_date = v_local_date
        and al.access_granted is true
    ) then
      v_reason_code := 'ALREADY_TODAY';
      v_message := 'Ya registraste tu asistencia de hoy. ¡Buena clase!';
      v_details := jsonb_build_object(
        'remaining', null, 'period_start', null, 'period_end', null, 'expires_at', null,
        'days_late', null, 'grace_days', p_grace_days, 'plan_name', null,
        'actor_type', v_actor_type, 'weekly_schedule_id', v_weekly_schedule_id,
        'local_date', v_local_date, 'already_today', true
      );
      return jsonb_build_object(
        'allowed', true, 'reason_code', v_reason_code, 'message', v_message,
        'weekly_schedule_id', v_weekly_schedule_id, 'remaining', null, 'actor_type', v_actor_type,
        'athlete_id', null, 'coach_id', v_coach_id, 'full_name', v_full_name, 'athlete_name', null,
        'plan_name', null, 'avatar_url', null, 'ui_status', 'SUCCESS', 'ui_color', 'green', 'details', v_details
      );
    end if;

    v_reason_code := 'OK';
    v_message := '¡Hola, ' || coalesce(v_full_name, 'profe') || '! Asistencia registrada.';

    insert into public.access_logs (
      athlete_id, coach_id, weekly_schedule_id, access_granted, reason_code, rejection_reason, local_checkin_date, idempotency_key
    ) values (
      null, v_coach_id, v_weekly_schedule_id, true, v_reason_code, null, v_local_date, v_idempotency_key
    );

    v_details := jsonb_build_object(
      'remaining', null, 'period_start', null, 'period_end', null, 'expires_at', null,
      'days_late', null, 'grace_days', p_grace_days, 'plan_name', null,
      'actor_type', v_actor_type, 'weekly_schedule_id', v_weekly_schedule_id, 'local_date', v_local_date
    );

    return jsonb_build_object(
      'allowed', true, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', v_weekly_schedule_id, 'remaining', null, 'actor_type', v_actor_type,
      'athlete_id', null, 'coach_id', v_coach_id, 'full_name', v_full_name, 'athlete_name', null,
      'plan_name', null, 'avatar_url', null, 'ui_status', 'SUCCESS', 'ui_color', 'green', 'details', v_details
    );
  end if;

  v_actor_type := 'athlete';

  -- Resolver atleta a partir del perfil (si no vino de la búsqueda por athletes.dni)
  if v_athlete_id is null then
    select a.id, a.status
    into v_athlete_id, v_athlete_status
    from public.athletes a
    where a.profile_id = v_profile_id
    limit 1;
  end if;

  if v_athlete_id is not null then
    select p.full_name, pl.name, p.avatar_url, a.visits_per_week, a.plan_id
    into v_athlete_name, v_plan_name, v_avatar_url, v_visits_per_week, v_plan_id
    from public.athletes a
    left join public.profiles p on p.id = a.profile_id
    left join public.plans pl on pl.id = a.plan_id
    where a.id = v_athlete_id
    limit 1;
  end if;

  -- (1) ¿Existe el atleta?  (perfil sin athletes -> NEUTRO, se registra igual)
  if v_athlete_id is null then
    v_reason_code := 'ATHLETE_NOT_FOUND';
    v_message := 'No te encontramos como atleta. Consultá en administración.';
    v_idempotency_key := v_identifier || ':none:' || v_local_date::text;
    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);
    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', null, 'remaining', null, 'actor_type', v_actor_type, 'athlete_id', null,
      'coach_id', null, 'full_name', v_full_name, 'athlete_name', null, 'plan_name', null, 'avatar_url', null,
      'ui_status', 'NOTICE', 'ui_color', 'stone',
      'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type));
  end if;

  -- (2) ¿Está activo?  (baja/inactivo -> SIGUE DENEGANDO, rojo)
  if v_athlete_status is distinct from 'active' then
    v_reason_code := 'NOT_ACTIVE';
    v_message := 'Cuenta inactiva. Consultá en administración.';
    v_idempotency_key := v_athlete_id::text || ':none:' || v_local_date::text;
    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);
    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', null, 'remaining', null, 'actor_type', v_actor_type, 'athlete_id', v_athlete_id,
      'coach_id', null, 'full_name', coalesce(v_athlete_name, v_full_name), 'athlete_name', v_athlete_name, 'plan_name', v_plan_name, 'avatar_url', v_avatar_url,
      'ui_status', 'DENIED', 'ui_color', 'red',
      'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name));
  end if;

  -- (3) Turno EN CURSO del plan del atleta (start <= ahora < end). El más reciente iniciado.
  --     Ya NO se deniega si no hay: la ausencia de turno pasa a ser un aviso (WARNING).
  select ws.id, ws.start_time, ws.capacity
  into v_weekly_schedule_id, v_slot_start, v_capacity
  from public.plan_schedule_slots pss
  join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
  where pss.plan_id = v_plan_id
    and ws.day_of_week = v_local_dow
    and v_local_time >= ws.start_time
    and v_local_time < ws.end_time
  order by ws.start_time desc
  limit 1;

  -- Turnos que el atleta ELIGIÓ (para el recordatorio y para detectar "fuera de sus días").
  select string_agg(
           (case ws.day_of_week
              when 0 then 'Dom' when 1 then 'Lun' when 2 then 'Mar' when 3 then 'Mié'
              when 4 then 'Jue' when 5 then 'Vie' when 6 then 'Sáb' end)
           || ' ' || to_char(ws.start_time, 'HH24:MI'),
           ', ' order by ws.day_of_week, ws.start_time)
  into v_assigned_text
  from public.athlete_slot_assignments asa
  join public.weekly_schedule ws on ws.id = asa.weekly_schedule_id
  where asa.athlete_id = v_athlete_id
    and asa.is_active = true
    and asa.starts_on <= v_local_date
    and (asa.ends_on is null or asa.ends_on >= v_local_date);

  v_has_assignments := v_assigned_text is not null;

  select exists(
    select 1
    from public.athlete_slot_assignments asa
    join public.weekly_schedule ws on ws.id = asa.weekly_schedule_id
    where asa.athlete_id = v_athlete_id
      and asa.is_active = true
      and asa.starts_on <= v_local_date
      and (asa.ends_on is null or asa.ends_on >= v_local_date)
      and ws.day_of_week = v_local_dow
      and v_local_time >= ws.start_time
      and v_local_time < ws.end_time
  ) into v_in_own_slot;

  -- Fuera de horario si: no hay clase del plan a esta hora, o el atleta tiene
  -- turnos elegidos y ninguno matchea el momento actual.
  v_off_schedule := (v_weekly_schedule_id is null) or (v_has_assignments and not v_in_own_slot);

  -- Lock por atleta+día (evita doble consumo concurrente)
  perform pg_advisory_xact_lock(hashtextextended(v_athlete_id::text || ':' || v_local_date::text, 0));
  v_idempotency_key := v_athlete_id::text || ':' || coalesce(v_weekly_schedule_id::text, 'noslot') || ':' || v_local_date::text;

  -- Saldo vigente (para mostrar / consumir)
  select amc.id, amc.allowed_sessions, (amc.allowed_sessions - amc.consumed_sessions)
  into v_counter_id, v_allowed_sessions, v_remaining
  from public.athlete_monthly_counters amc
  where amc.athlete_id = v_athlete_id
    and amc.period_start <= v_local_date
    and amc.period_end >= v_local_date
  order by amc.period_start desc
  limit 1
  for update;

  -- (4) ¿Ya entró hoy? (1 acceso = 1 día). Permitir sin descontar, sin re-loguear.
  select exists(
    select 1 from public.access_logs al
    where al.athlete_id = v_athlete_id
      and al.local_checkin_date = v_local_date
      and al.access_granted is true
  ) into v_already_today;

  if v_already_today then
    v_reason_code := 'ALREADY_TODAY';
    v_message := 'Ya registraste tu acceso de hoy. ¡Buen entrenamiento!';
    return jsonb_build_object(
      'allowed', true, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', v_weekly_schedule_id, 'remaining', v_remaining, 'actor_type', v_actor_type, 'athlete_id', v_athlete_id,
      'coach_id', null, 'full_name', coalesce(v_athlete_name, v_full_name), 'athlete_name', v_athlete_name, 'plan_name', v_plan_name, 'avatar_url', v_avatar_url,
      'ui_status', 'SUCCESS', 'ui_color', 'green',
      'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name, 'remaining', v_remaining, 'weekly_schedule_id', v_weekly_schedule_id, 'already_today', true));
  end if;

  -- (5) Pago al día (ciclo 30 días desde el último pago + gracia)
  select p.payment_date::timestamptz into v_last_paid_at
  from public.payments p
  where p.athlete_id = v_athlete_id and p.status = 'paid'
  order by p.payment_date desc limit 1;

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

  -- Cuota vencida más allá de la gracia: ANTES denegaba (PAYMENT_BLOCKED).
  -- Ahora se PERMITE con aviso.
  v_overdue := (p_now > v_expiration and v_days_late > greatest(coalesce(p_grace_days, 0), 0));
  v_is_grace := (p_now > v_expiration and v_days_late <= greatest(coalesce(p_grace_days, 0), 0));

  -- (6) Cupo del turno EN VIVO (atletas distintos que ya entraron hoy a este turno).
  --     ANTES denegaba (TURNO_FULL). Ahora se PERMITE con aviso.
  if v_weekly_schedule_id is not null then
    select count(distinct al.athlete_id) into v_occupied
    from public.access_logs al
    where al.weekly_schedule_id = v_weekly_schedule_id
      and al.local_checkin_date = v_local_date
      and al.access_granted is true;

    v_capacity_full := (v_capacity is not null and v_capacity > 0 and v_occupied >= v_capacity);
  end if;

  -- (7) Saldo de accesos (autocrear contador del ciclo si falta)
  if v_counter_id is null and coalesce(p_autocreate_counter, true) then
    v_allowed_sessions := case when coalesce(v_visits_per_week, 0) > 0 then greatest(v_visits_per_week * 4, 1) else 12 end;
    insert into public.athlete_monthly_counters(athlete_id, period_start, period_end, allowed_sessions, consumed_sessions)
    values (v_athlete_id, v_period_start, v_period_end, v_allowed_sessions, 0)
    on conflict (athlete_id, period_start, period_end) do nothing;
    select amc.id, amc.allowed_sessions, (amc.allowed_sessions - amc.consumed_sessions)
    into v_counter_id, v_allowed_sessions, v_remaining
    from public.athlete_monthly_counters amc
    where amc.athlete_id = v_athlete_id and amc.period_start <= v_local_date and amc.period_end >= v_local_date
    order by amc.period_start desc limit 1 for update;
  end if;

  -- (8) Sin saldo: SIGUE DENEGANDO (rojo). Es el único tope duro que queda.
  if v_counter_id is null or coalesce(v_remaining, 0) <= 0 then
    v_reason_code := 'NO_BALANCE';
    v_message := 'Sin accesos disponibles este mes. Consultá en administración.';
    insert into public.access_logs (athlete_id, coach_id, weekly_schedule_id, access_granted, rejection_reason, reason_code, remaining_sessions, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, v_weekly_schedule_id, false, v_message, v_reason_code, coalesce(v_remaining, 0), v_local_date, v_idempotency_key || ':bal');
    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', v_weekly_schedule_id, 'remaining', coalesce(v_remaining, 0), 'actor_type', v_actor_type, 'athlete_id', v_athlete_id,
      'coach_id', null, 'full_name', coalesce(v_athlete_name, v_full_name), 'athlete_name', v_athlete_name, 'plan_name', v_plan_name, 'avatar_url', v_avatar_url,
      'ui_status', 'DENIED', 'ui_color', 'red',
      'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name, 'remaining', coalesce(v_remaining, 0), 'weekly_schedule_id', v_weekly_schedule_id));
  end if;

  -- (9) ACCESO CONCEDIDO -> consumir 1 acceso y registrar.
  update public.athlete_monthly_counters
    set consumed_sessions = consumed_sessions + 1, updated_at = timezone('utc', now())
  where id = v_counter_id;
  v_remaining := v_remaining - 1;

  v_warn := (v_off_schedule or v_overdue or v_is_grace or v_capacity_full or v_last_paid_at is null);

  -- Código de log (precedencia: la excepción "más fuerte" gana).
  v_reason_code := case
    when v_overdue       then 'OK_OVERDUE'
    when v_off_schedule  then 'OK_OFF_SCHEDULE'
    when v_capacity_full then 'OK_TURNO_FULL'
    when v_is_grace      then 'OK_GRACE'
    when v_last_paid_at is null then 'OK_PENDING'
    else 'OK'
  end;

  v_ui_status := case when v_warn then 'WARNING' else 'SUCCESS' end;
  v_ui_color  := case when v_warn then 'amber' else 'green' end;

  v_message := '¡Bienvenido, ' || coalesce(v_athlete_name, v_full_name, 'Atleta') || '! Te quedan ' || v_remaining || ' accesos.';

  if v_slot_start is not null and v_local_time > v_slot_start then
    v_message := v_message || ' (La clase comenzó a las ' || to_char(v_slot_start, 'HH24:MI') || '.)';
  end if;

  if v_off_schedule then
    if v_has_assignments then
      v_message := v_message || ' Recordá que tus días/horarios asignados son: ' || v_assigned_text || '.';
    else
      v_message := v_message || ' Recordá venir en tus días y horarios asignados.';
    end if;
  end if;

  if v_capacity_full then
    v_message := v_message || ' El turno está completo, te dejamos pasar igual.';
  end if;

  if v_overdue then
    v_message := v_message || ' Cuota vencida: pasá por administración a regularizar tu pago.';
  elsif v_is_grace then
    v_message := v_message || ' Cuota vencida: regularizá tu pago (quedan ' || (greatest(coalesce(p_grace_days, 0), 0) - v_days_late) || ' días de gracia).';
  elsif v_last_paid_at is null then
    v_message := v_message || ' Cuota pendiente: pasá por administración a registrar tu pago.';
  end if;

  insert into public.access_logs (athlete_id, coach_id, weekly_schedule_id, access_granted, reason_code, remaining_sessions, local_checkin_date, idempotency_key)
  values (v_athlete_id, null, v_weekly_schedule_id, true, v_reason_code, v_remaining, v_local_date, v_idempotency_key);

  return jsonb_build_object(
    'allowed', true, 'reason_code', v_reason_code, 'message', v_message,
    'weekly_schedule_id', v_weekly_schedule_id, 'remaining', v_remaining, 'actor_type', v_actor_type, 'athlete_id', v_athlete_id,
    'coach_id', null, 'full_name', coalesce(v_athlete_name, v_full_name), 'athlete_name', v_athlete_name, 'plan_name', v_plan_name, 'avatar_url', v_avatar_url,
    'ui_status', v_ui_status, 'ui_color', v_ui_color,
    'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name, 'remaining', v_remaining, 'period_start', v_period_start, 'period_end', v_period_end, 'expires_at', v_expiration, 'days_late', v_days_late, 'weekly_schedule_id', v_weekly_schedule_id, 'capacity', v_capacity, 'occupied', v_occupied + 1, 'off_schedule', v_off_schedule, 'overdue', v_overdue, 'capacity_full', v_capacity_full, 'assigned_slots', v_assigned_text));
end;

$$;
