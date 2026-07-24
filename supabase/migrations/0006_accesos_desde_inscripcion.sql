-- 0006_accesos_desde_inscripcion.sql
-- El "mes" del atleta (accesos + vencimiento de cuota) corre desde su fecha de
-- inscripción (athletes.join_date), con cadencia de MES CALENDARIO (aniversario
-- del día de inscripción), no desde el último pago ni desde el primer ingreso.
--
-- Decisiones de producto (2026-07-24, pedido de Cris):
--   * Cadencia: mes calendario anclado a join_date. Inscripto el 15 -> el mes se
--     cumple el 15 de cada mes (inscripto el 31 -> último día en meses cortos).
--   * Alcance: la ventana ancla TANTO la renovación de accesos COMO el
--     'cuota vencida/gracia' que muestra el kiosco.
--   * "Cuota del período vigente": se considera paga si hay un pago 'paid' con
--     fecha >= inicio del período actual. Si no, desde el día que se cumple el
--     mes empiezan a correr los días de gracia y luego queda vencida (se PERMITE
--     con aviso, igual que la lógica flexible de 0001: el único tope duro sigue
--     siendo NO_BALANCE).
--
-- Cambios:
--   (A) create_full_athlete_atomic: el primer contador cierra a fin de mes
--       calendario (join_date + 1 mes - 1 día), no join_date + 29.
--   (B) kiosk_check_in: reproduce 0001 y SOLO cambia (a) el cálculo de la ventana
--       del período -ahora desde join_date, mes calendario- reutilizándola para
--       accesos y cuota, y (b) el desacople del vencimiento respecto del último
--       pago. Además auto-sana: si el atleta trae un contador viejo (anclado a
--       pago/hoy) que cubre hoy, lo realinea a la inscripción preservando lo
--       consumido.
--   (C) Realineo inicial (una vez) de los contadores vigentes de atletas activos.
--
-- No introduce reason_codes nuevos (reutiliza OK / OK_GRACE / OK_PENDING /
-- OK_OVERDUE / OK_OFF_SCHEDULE / OK_TURNO_FULL), así que no toca kiosk_reason_codes.

-- =============================================================================
-- (A) Alta del atleta: primer contador a fin de mes calendario
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."create_full_athlete_atomic"("p_payload" "jsonb") RETURNS "public"."athletes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_athlete public.athletes%rowtype;
  v_plan_id uuid := (p_payload->>'plan_id')::uuid;
  v_visits_per_week int := nullif(p_payload->>'visits_per_week', '')::int;
  v_tier_price numeric := nullif(p_payload->>'tier_price', '')::numeric;
  v_join_date date := coalesce(nullif(p_payload->>'join_date', '')::date, current_date);
  v_email text := nullif(trim(p_payload->>'email'), '');
  v_dni text := regexp_replace(coalesce(p_payload->>'dni', ''), '\D', '', 'g');
  v_monthly_accesses int := nullif(p_payload->>'monthly_accesses', '')::int;
  v_plan_name text;
  v_plan_price numeric;
  v_pay_amount numeric := nullif(p_payload->>'payment_amount', '')::numeric;
  v_pay_method text := nullif(trim(p_payload->>'payment_method'), '');
  v_register_payment boolean := coalesce(nullif(p_payload->>'register_payment', '')::boolean, true);
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Solo staff puede crear atletas' using errcode = '42501';
  end if;
  if v_plan_id is null then
    raise exception 'Debes seleccionar un plan obligatorio.';
  end if;
  if v_dni = '' then
    raise exception 'El DNI es obligatorio.';
  end if;
  if exists(select 1 from public.athletes where regexp_replace(coalesce(dni, ''), '\D', '', 'g') = v_dni) then
    raise exception 'El DNI ya existe en el sistema.';
  end if;
  if v_email is not null and exists(select 1 from public.profiles where email = v_email) then
    raise exception 'Este correo ya está registrado en el sistema.';
  end if;
  if v_visits_per_week is null or v_visits_per_week <= 0 then
    raise exception 'Debes indicar visitas por semana válidas.';
  end if;

  -- Precio del tier (si no vino explícito) y nombre/precio del plan
  if v_tier_price is null then
    select pt.price into v_tier_price
    from public.plan_pricing_tiers pt
    where pt.plan_id = v_plan_id and pt.visits_per_week = v_visits_per_week
    limit 1;
  end if;
  select p.name, p.price into v_plan_name, v_plan_price from public.plans p where p.id = v_plan_id;

  -- Saldo mensual de accesos: explícito o visitas*4
  v_monthly_accesses := coalesce(v_monthly_accesses, greatest(v_visits_per_week * 4, 1));

  insert into public.profiles(id, full_name, email, role, dni, phone)
  values (
    v_profile_id,
    coalesce(nullif(trim(p_payload->>'full_name'), ''), 'Atleta sin nombre'),
    v_email,
    'atleta',
    nullif(v_dni, ''),
    nullif(p_payload->>'phone', '')
  );

  insert into public.athletes(
    profile_id, dni, phone, plan_id, plan_option, coach_id, visits_per_week, plan_tier_price,
    status, join_date, birth_date, gender, address, city,
    emergency_contact_name, emergency_contact_phone, medical_conditions, membership_type
  ) values (
    v_profile_id, v_dni, nullif(p_payload->>'phone', ''), v_plan_id,
    nullif(trim(coalesce(p_payload->>'plan_option', '')), ''), nullif(p_payload->>'coach_id', '')::uuid,
    v_visits_per_week, v_tier_price, 'active', v_join_date,
    nullif(p_payload->>'birth_date', '')::date, nullif(p_payload->>'gender', ''), nullif(p_payload->>'address', ''),
    nullif(p_payload->>'city', ''), nullif(p_payload->>'emergency_contact_name', ''),
    nullif(p_payload->>'emergency_contact_phone', ''), nullif(p_payload->>'medical_conditions', ''),
    nullif(p_payload->>'membership_type', '')
  ) returning * into v_athlete;

  -- Saldo mensual de accesos: primer período anclado a la inscripción, cerrando a
  -- fin de mes calendario (aniversario del día de inscripción menos un día).
  insert into public.athlete_monthly_counters(athlete_id, period_start, period_end, allowed_sessions, consumed_sessions)
  values (v_athlete.id, v_join_date, (v_join_date + interval '1 month')::date - 1, v_monthly_accesses, 0)
  on conflict (athlete_id, period_start, period_end) do nothing;

  -- Primer pago (registra la cuota del período de inscripción). Monto = explícito o tier o precio del plan.
  -- Pago del alta: 'paid' si se cobra en el momento; 'pending' si es "cobrar despues".
  -- El pendiente queda como deuda registrada (visible en Pagos) y el kiosco avisara
  -- "cuota pendiente" hasta que se salde desde Pagos (misma fila pending -> paid).
  insert into public.payments(athlete_id, amount, base_amount, status, method, concept, payment_date)
  values (
    v_athlete.id,
    coalesce(v_pay_amount, v_tier_price, v_plan_price, 0),
    coalesce(v_pay_amount, v_tier_price, v_plan_price, 0),
    case when v_register_payment then 'paid' else 'pending' end,
    coalesce(v_pay_method, 'efectivo'),
    'Inscripción - ' || coalesce(v_plan_name, 'Plan') || case when v_register_payment then '' else ' (pendiente)' end,
    v_join_date
  );

  return v_athlete;
end;
$$;

ALTER FUNCTION "public"."create_full_athlete_atomic"("p_payload" "jsonb") OWNER TO "postgres";

-- =============================================================================
-- (B) Kiosco: ventana del "mes" anclada a la inscripción (mes calendario)
--     Reproduce 0001 y cambia SOLO el cálculo de la ventana (accesos + cuota).
-- =============================================================================
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

  v_join_date date;
  v_k integer := 0;

  v_last_paid_at timestamptz;
  v_paid_current boolean := false;
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
    select p.full_name, pl.name, p.avatar_url, a.visits_per_week, a.plan_id, a.join_date
    into v_athlete_name, v_plan_name, v_avatar_url, v_visits_per_week, v_plan_id, v_join_date
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

  -- ---------------------------------------------------------------------------
  -- Ventana del "mes" anclada a la inscripción (mes calendario / aniversario).
  -- k = meses completos transcurridos desde join_date hasta hoy. period_start es
  -- el aniversario vigente; period_end, el día previo al próximo aniversario.
  -- Postgres ajusta a fin de mes en meses cortos (join 31-ene + 1 mes -> 28/29-feb).
  -- Esta ventana ancla TANTO los accesos COMO el vencimiento de cuota.
  -- ---------------------------------------------------------------------------
  v_join_date := coalesce(v_join_date, v_local_date);
  v_k := greatest(
           (extract(year  from age(v_local_date, v_join_date)) * 12
          + extract(month from age(v_local_date, v_join_date)))::int, 0);
  v_period_start := (v_join_date + make_interval(months => v_k))::date;
  -- Ajustes de borde por si age() redondea distinto según la duración del mes.
  while v_period_start > v_local_date and v_k > 0 loop
    v_k := v_k - 1;
    v_period_start := (v_join_date + make_interval(months => v_k))::date;
  end loop;
  while (v_join_date + make_interval(months => v_k + 1))::date <= v_local_date loop
    v_k := v_k + 1;
    v_period_start := (v_join_date + make_interval(months => v_k))::date;
  end loop;
  v_period_end := (v_join_date + make_interval(months => v_k + 1))::date - 1;

  -- Lock por atleta+día (evita doble consumo concurrente)
  perform pg_advisory_xact_lock(hashtextextended(v_athlete_id::text || ':' || v_local_date::text, 0));
  v_idempotency_key := v_athlete_id::text || ':' || coalesce(v_weekly_schedule_id::text, 'noslot') || ':' || v_local_date::text;

  -- Saldo vigente: contador de la ventana de inscripción actual.
  select amc.id, amc.allowed_sessions, (amc.allowed_sessions - amc.consumed_sessions)
  into v_counter_id, v_allowed_sessions, v_remaining
  from public.athlete_monthly_counters amc
  where amc.athlete_id = v_athlete_id
    and amc.period_start = v_period_start
    and amc.period_end   = v_period_end
  limit 1
  for update;

  -- Compatibilidad / auto-sanado: si el atleta trae un contador viejo (anclado a
  -- pago/hoy por la lógica anterior) que cubre hoy pero con otra ventana, lo
  -- realineamos a la inscripción preservando lo ya consumido en este ciclo.
  if v_counter_id is null then
    update public.athlete_monthly_counters amc
       set period_start = v_period_start,
           period_end   = v_period_end,
           updated_at   = timezone('utc', now())
     where amc.id = (
       select amc2.id
       from public.athlete_monthly_counters amc2
       where amc2.athlete_id = v_athlete_id
         and amc2.period_start <= v_local_date
         and amc2.period_end   >= v_local_date
         and (amc2.period_start <> v_period_start or amc2.period_end <> v_period_end)
       order by amc2.period_start desc
       limit 1
     )
    returning amc.id, amc.allowed_sessions, (amc.allowed_sessions - amc.consumed_sessions)
         into v_counter_id, v_allowed_sessions, v_remaining;
  end if;

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

  -- (5) Cuota del período vigente: el "mes" corre desde la inscripción (mismo
  --     aniversario que la ventana de accesos), NO desde el último pago.
  --     Se considera paga si hay un pago 'paid' con fecha dentro del período actual.
  select p.payment_date::timestamptz into v_last_paid_at
  from public.payments p
  where p.athlete_id = v_athlete_id and p.status = 'paid'
  order by p.payment_date desc limit 1;

  v_paid_current := (v_last_paid_at is not null
                     and (v_last_paid_at at time zone p_timezone)::date >= v_period_start);

  -- La cuota del período vigente vence al comenzar el próximo (siguiente aniversario).
  v_cycle_start := (v_period_start::timestamp at time zone p_timezone);
  v_expiration  := ((v_period_end + 1)::timestamp at time zone p_timezone);

  if v_paid_current then
    v_days_late := 0;
  else
    -- días transcurridos desde que se cumplió el mes (inicio del período vigente)
    v_days_late := greatest((v_local_date - v_period_start), 0);
  end if;

  -- Cuota vencida más allá de la gracia: se PERMITE con aviso (igual que 0001).
  v_overdue  := (not v_paid_current and v_days_late >  greatest(coalesce(p_grace_days, 0), 0));
  v_is_grace := (not v_paid_current and v_last_paid_at is not null
                 and v_days_late <= greatest(coalesce(p_grace_days, 0), 0));

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

  -- (7) Saldo de accesos (autocrear contador del período de inscripción si falta)
  if v_counter_id is null and coalesce(p_autocreate_counter, true) then
    v_allowed_sessions := case when coalesce(v_visits_per_week, 0) > 0 then greatest(v_visits_per_week * 4, 1) else 12 end;
    insert into public.athlete_monthly_counters(athlete_id, period_start, period_end, allowed_sessions, consumed_sessions)
    values (v_athlete_id, v_period_start, v_period_end, v_allowed_sessions, 0)
    on conflict (athlete_id, period_start, period_end) do nothing;
    select amc.id, amc.allowed_sessions, (amc.allowed_sessions - amc.consumed_sessions)
    into v_counter_id, v_allowed_sessions, v_remaining
    from public.athlete_monthly_counters amc
    where amc.athlete_id = v_athlete_id and amc.period_start = v_period_start and amc.period_end = v_period_end
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

-- =============================================================================
-- (B2) Estado de deuda alineado al kiosco: athlete_debt_state ahora usa la MISMA
--      ventana mes-calendario anclada a la inscripción. Lo consume admin_billing_status
--      (RPC del panel de Pagos), así que "vencido/gracia/pendiente" del panel queda
--      alineado con lo que muestra el kiosco. Misma precedencia que kiosk_check_in:
--        - pagó el período vigente        -> 'ok'
--        - no pagó y días > gracia         -> 'overdue'
--        - nunca pagó y dentro de gracia   -> 'pending'
--        - pagó un período anterior, gracia -> 'grace'
-- =============================================================================
CREATE OR REPLACE FUNCTION "public"."athlete_debt_state"("p_athlete_id" "uuid", "p_now" timestamp with time zone DEFAULT "now"(), "p_timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text", "p_grace_days" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_join_date    date;
  v_local_date   date;
  v_k            integer := 0;
  v_period_start date;
  v_period_end   date;
  v_last_paid_at timestamptz;
  v_paid_current boolean := false;
  v_expiration   timestamptz;
  v_days_late    integer := 0;
  v_state        text;
begin
  select a.join_date into v_join_date from public.athletes a where a.id = p_athlete_id;
  v_local_date := (p_now at time zone p_timezone)::date;
  v_join_date  := coalesce(v_join_date, v_local_date);

  -- Ventana del "mes" (misma cadencia que kiosk_check_in): mes calendario desde join_date.
  v_k := greatest(
           (extract(year  from age(v_local_date, v_join_date)) * 12
          + extract(month from age(v_local_date, v_join_date)))::int, 0);
  v_period_start := (v_join_date + make_interval(months => v_k))::date;
  while v_period_start > v_local_date and v_k > 0 loop
    v_k := v_k - 1;
    v_period_start := (v_join_date + make_interval(months => v_k))::date;
  end loop;
  while (v_join_date + make_interval(months => v_k + 1))::date <= v_local_date loop
    v_k := v_k + 1;
    v_period_start := (v_join_date + make_interval(months => v_k))::date;
  end loop;
  v_period_end := (v_join_date + make_interval(months => v_k + 1))::date - 1;
  v_expiration := ((v_period_end + 1)::timestamp at time zone p_timezone);

  select p.payment_date::timestamptz into v_last_paid_at
  from public.payments p
  where p.athlete_id = p_athlete_id and p.status = 'paid'
  order by p.payment_date desc
  limit 1;

  v_paid_current := (v_last_paid_at is not null
                     and (v_last_paid_at at time zone p_timezone)::date >= v_period_start);

  if v_paid_current then
    v_state := 'ok';
    v_days_late := 0;
  else
    v_days_late := greatest((v_local_date - v_period_start), 0);
    if v_days_late > greatest(coalesce(p_grace_days, 0), 0) then
      v_state := 'overdue';
    elsif v_last_paid_at is null then
      v_state := 'pending';
    else
      v_state := 'grace';
    end if;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'last_paid_at', v_last_paid_at,
    'expires_at', v_expiration,
    'days_late', case when v_paid_current then 0 else v_days_late end,
    'grace_days', p_grace_days
  );
end;
$$;

-- =============================================================================
-- (C) Realineo inicial (una vez): llevar el contador vigente de cada atleta
--     activo a la ventana anclada a su inscripción, preservando consumed_sessions.
--     Seguro ante colisiones: solo si NO existe ya un contador en la ventana
--     destino. Los atletas que no se toquen acá se auto-sanan en su próximo
--     ingreso por el kiosco (bloque de "auto-sanado" de kiosk_check_in).
-- =============================================================================
with hoy as (
  select (timezone('America/Argentina/Buenos_Aires', now()))::date as d
),
tgt as (
  select
    a.id as athlete_id,
    (a.join_date + make_interval(months =>
        greatest((extract(year  from age((select d from hoy), a.join_date)) * 12
                + extract(month from age((select d from hoy), a.join_date)))::int, 0)))::date as ps
  from public.athletes a
  where a.status = 'active' and a.join_date is not null
),
tgt2 as (
  select athlete_id, ps, ((ps + interval '1 month')::date - 1) as pe
  from tgt
  where ps <= (select d from hoy)
),
cur as (
  select distinct on (amc.athlete_id) amc.id, amc.athlete_id
  from public.athlete_monthly_counters amc
  where amc.period_start <= (select d from hoy)
    and amc.period_end   >= (select d from hoy)
  order by amc.athlete_id, amc.period_start desc
)
update public.athlete_monthly_counters amc
   set period_start = t.ps,
       period_end   = t.pe,
       updated_at   = timezone('utc', now())
from cur c
join tgt2 t on t.athlete_id = c.athlete_id
where amc.id = c.id
  and (amc.period_start <> t.ps or amc.period_end <> t.pe)
  and not exists (
    select 1 from public.athlete_monthly_counters x
    where x.athlete_id = t.athlete_id
      and x.period_start = t.ps
      and x.period_end   = t.pe
  );
