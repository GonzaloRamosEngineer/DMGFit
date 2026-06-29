-- ============================================================
-- schema_snapshot.sql — FOTO COMPLETA del esquema public (rebuild reference)
-- Generado desde producción. Sirve para reconstruir la base desde cero.
-- NO se aplica junto a las migraciones 0001+; es el estado completo actual.
-- Incluye tablas base, RLS, políticas, funciones (incl. handle_new_user) y triggers.
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict eXtEDLGdIWJEfSAj9F7qXB76Qr5LpF7IwMtIen5mBGzBtM3wFcxg8sBiEFcxytF

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'profesor',
    'atleta'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: plan_schedule_slot_coaches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_schedule_slot_coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_schedule_slot_id uuid NOT NULL,
    coach_id uuid NOT NULL,
    weekly_schedule_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pssc_time_order CHECK ((end_time > start_time))
);


--
-- Name: assign_coach_to_plan_slot(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_coach_to_plan_slot(p_plan_id uuid, p_weekly_schedule_id uuid, p_coach_id uuid) RETURNS public.plan_schedule_slot_coaches
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_plan_slot_id uuid;
  v_row public.plan_schedule_slot_coaches;
begin
  if not public.is_staff() then
    raise exception 'Not allowed: staff only';
  end if;

  if p_plan_id is null or p_weekly_schedule_id is null or p_coach_id is null then
    raise exception 'p_plan_id, p_weekly_schedule_id and p_coach_id are required';
  end if;

  -- validar existencia plan-slot
  select pss.id
    into v_plan_slot_id
  from public.plan_schedule_slots pss
  where pss.plan_id = p_plan_id
    and pss.weekly_schedule_id = p_weekly_schedule_id
  limit 1;

  if v_plan_slot_id is null then
    raise exception 'No plan_schedule_slots row for plan_id=% and weekly_schedule_id=%', p_plan_id, p_weekly_schedule_id;
  end if;

  -- upsert por (plan_schedule_slot_id, coach_id)
  insert into public.plan_schedule_slot_coaches (
    plan_schedule_slot_id,
    coach_id
  )
  values (
    v_plan_slot_id,
    p_coach_id
  )
  on conflict (plan_schedule_slot_id, coach_id)
  do update set updated_at = now()
  returning *
  into v_row;

  return v_row;
end $$;


--
-- Name: athlete_id_for_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.athlete_id_for_user(uid uuid) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select a.id from athletes a
  join profiles p on p.id = a.profile_id
  where p.id = uid;
$$;


--
-- Name: coach_id_for_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coach_id_for_user(uid uuid) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select c.id from coaches c
  join profiles p on p.id = c.profile_id
  where p.id = uid;
$$;


--
-- Name: coach_planned_hours(date, date, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coach_planned_hours(p_start date, p_end date, p_grain text DEFAULT 'week'::text, p_coach_id uuid DEFAULT NULL::uuid) RETURNS TABLE(coach_id uuid, period_start date, total_minutes integer, total_hours numeric, slot_occurrences integer, distinct_slots integer)
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_is_staff boolean;
  v_self_coach uuid;
begin
  if p_start is null or p_end is null then
    raise exception 'p_start and p_end are required';
  end if;

  if p_end < p_start then
    raise exception 'p_end must be >= p_start';
  end if;

  v_is_staff := public.is_staff();
  v_self_coach := public.current_coach_id();

  if not v_is_staff then
    if v_self_coach is null then
      return;
    end if;

    if p_coach_id is not null and p_coach_id <> v_self_coach then
      raise exception 'Not allowed: non-staff can only access own hours';
    end if;
  end if;

  return query
  with days as (
    select
      d::date as day,
      (case when extract(dow from d)=0 then 7 else extract(dow from d)::int end) as dow_1_7,
      (case
        when lower(p_grain)='month' then date_trunc('month', d)::date
        else date_trunc('week', d)::date
      end) as period_start
    from generate_series(p_start::date, p_end::date, interval '1 day') d
  ),
  slots as (
    select
      pssc.coach_id,
      pssc.weekly_schedule_id,
      pssc.day_of_week,
      pssc.start_time,
      pssc.end_time,
      greatest(
        0,
        (extract(epoch from (pssc.end_time - pssc.start_time)) / 60)::int
      ) as duration_minutes
    from public.plan_schedule_slot_coaches pssc
    where
      (v_is_staff and p_coach_id is null)
      or (pssc.coach_id = coalesce(p_coach_id, v_self_coach))
  ),
  matches as (
    select
      s.coach_id,
      d.period_start,
      s.weekly_schedule_id,
      s.duration_minutes
    from slots s
    join days d on d.dow_1_7 = s.day_of_week
    where s.duration_minutes > 0
  )
  select
    m.coach_id as coach_id,
    m.period_start as period_start,
    sum(m.duration_minutes)::int as total_minutes,
    round((sum(m.duration_minutes)::numeric / 60.0), 2) as total_hours,
    count(*)::int as slot_occurrences,
    count(distinct m.weekly_schedule_id)::int as distinct_slots
  from matches m
  group by m.coach_id, m.period_start
  order by m.coach_id, m.period_start;

end $$;


--
-- Name: athletes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.athletes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    phone text,
    join_date date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    membership_type text,
    coach_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    dni text,
    birth_date date,
    gender text,
    address text,
    city text,
    emergency_contact_name text,
    emergency_contact_phone text,
    medical_conditions text,
    plan_id uuid NOT NULL,
    visits_per_week integer,
    plan_tier_price numeric,
    plan_option text
);


--
-- Name: create_full_athlete_atomic(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_full_athlete_atomic(p_payload jsonb) RETURNS public.athletes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  if not public.is_staff() then
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

  -- Saldo mensual de accesos
  insert into public.athlete_monthly_counters(athlete_id, period_start, period_end, allowed_sessions, consumed_sessions)
  values (v_athlete.id, v_join_date, v_join_date + 29, v_monthly_accesses, 0)
  on conflict (athlete_id, period_start, period_end) do nothing;

  -- Primer pago (arranca el ciclo de 30 días). Monto = explícito o tier o precio del plan.
  if v_register_payment then
    insert into public.payments(athlete_id, amount, base_amount, status, method, concept, payment_date)
    values (
      v_athlete.id,
      coalesce(v_pay_amount, v_tier_price, v_plan_price, 0),
      coalesce(v_pay_amount, v_tier_price, v_plan_price, 0),
      'paid',
      coalesce(v_pay_method, 'efectivo'),
      'Inscripción - ' || coalesce(v_plan_name, 'Plan'),
      v_join_date
    );
  end if;

  return v_athlete;
end;
$$;


--
-- Name: current_coach_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_coach_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select c.id
  from public.coaches c
  where c.profile_id = public.current_profile_id()
  limit 1
$$;


--
-- Name: current_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select p.id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  target_id uuid;
  target_role_text text;
BEGIN
  -- 1. Identificar al "Fantasma" (por email exacto o por nombre si es .internal)
  SELECT id, role::text INTO target_id, target_role_text
  FROM public.profiles
  WHERE email = new.email 
     OR (full_name = COALESCE(new.raw_user_meta_data->>'full_name', '') AND email LIKE '%@dmg.internal')
  LIMIT 1;

  -- 2. PRIMERO: Crear o actualizar el perfil oficial (New ID)
  -- Esto asegura que el ID de Auth ya exista en la tabla profiles
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(target_role_text, new.raw_user_meta_data->>'role', 'atleta')::public.user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  -- 3. SEGUNDO: Si había un fantasma, migramos las fichas al nuevo ID
  IF target_id IS NOT NULL AND target_id != new.id THEN
    -- Movemos las referencias
    UPDATE public.coaches SET profile_id = new.id WHERE profile_id = target_id;
    UPDATE public.athletes SET profile_id = new.id WHERE profile_id = target_id;
    
    -- TERCERO: Ahora que nadie usa el ID viejo, lo borramos con seguridad
    DELETE FROM public.profiles WHERE id = target_id;
  END IF;

  RETURN new;
END;
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(uid uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'admin'
  );
END;
$$;


--
-- Name: is_athlete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_athlete(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1 from profiles
    where id = uid and role = 'atleta'
  );
$$;


--
-- Name: is_coach(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_coach(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1 from profiles
    where id = uid and role = 'profesor'
  );
$$;


--
-- Name: is_coach_of_athlete(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_coach_of_athlete(_user_uid uuid, _athlete_uuid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM athletes a
    JOIN coaches c ON a.coach_id = c.id
    WHERE a.id = _athlete_uuid
    AND c.profile_id = _user_uid
  );
$$;


--
-- Name: is_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'profesor')
  );
$$;


--
-- Name: kiosk_check_in(text, text, timestamp with time zone, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kiosk_check_in(p_dni text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_now timestamp with time zone DEFAULT now(), p_timezone text DEFAULT 'America/Argentina/Buenos_Aires'::text, p_grace_days integer DEFAULT 3, p_autocreate_counter boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

    select count(*)::int
    into v_slot_count
    from public.plan_schedule_slot_coaches pssc
    join public.plan_schedule_slots pss on pss.id = pssc.plan_schedule_slot_id
    join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
    where pssc.coach_id = v_coach_id
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
    from public.plan_schedule_slot_coaches pssc
    join public.plan_schedule_slots pss on pss.id = pssc.plan_schedule_slot_id
    join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
    where pssc.coach_id = v_coach_id
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

  -- (1) ¿Existe el atleta?
  if v_athlete_id is null then
    v_reason_code := 'ATHLETE_NOT_FOUND';
    v_message := 'No te encontramos. Consultá en administración.';
    v_idempotency_key := v_identifier || ':none:' || v_local_date::text;
    insert into public.access_logs (athlete_id, coach_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);
    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', null, 'remaining', null, 'actor_type', v_actor_type, 'athlete_id', null,
      'coach_id', null, 'full_name', v_full_name, 'athlete_name', null, 'plan_name', null, 'avatar_url', null,
      'ui_status', 'DENIED', 'ui_color', 'red',
      'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type));
  end if;

  -- (2) ¿Está activo?
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

  if v_weekly_schedule_id is null then
    v_reason_code := 'NO_TURNO';
    v_message := 'No hay clase en este horario.';
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

  -- Lock por atleta+día (evita doble consumo concurrente)
  perform pg_advisory_xact_lock(hashtextextended(v_athlete_id::text || ':' || v_local_date::text, 0));
  v_idempotency_key := v_athlete_id::text || ':' || v_weekly_schedule_id::text || ':' || v_local_date::text;

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

  if p_now > v_expiration and v_days_late > greatest(coalesce(p_grace_days, 0), 0) then
    v_reason_code := 'PAYMENT_BLOCKED';
    v_message := 'Cuota vencida. Regularizá tu pago para continuar.';
    insert into public.access_logs (athlete_id, coach_id, weekly_schedule_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, v_weekly_schedule_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key || ':pay');
    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', v_weekly_schedule_id, 'remaining', v_remaining, 'actor_type', v_actor_type, 'athlete_id', v_athlete_id,
      'coach_id', null, 'full_name', coalesce(v_athlete_name, v_full_name), 'athlete_name', v_athlete_name, 'plan_name', v_plan_name, 'avatar_url', v_avatar_url,
      'ui_status', 'DENIED', 'ui_color', 'red',
      'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name, 'expires_at', v_expiration, 'days_late', v_days_late, 'period_start', v_period_start, 'period_end', v_period_end, 'weekly_schedule_id', v_weekly_schedule_id));
  end if;

  v_is_grace := (p_now > v_expiration and v_days_late <= greatest(coalesce(p_grace_days, 0), 0));

  -- (6) Cupo del turno EN VIVO (atletas distintos que ya entraron hoy a este turno)
  select count(distinct al.athlete_id) into v_occupied
  from public.access_logs al
  where al.weekly_schedule_id = v_weekly_schedule_id
    and al.local_checkin_date = v_local_date
    and al.access_granted is true;

  if v_capacity is not null and v_capacity > 0 and v_occupied >= v_capacity then
    v_reason_code := 'TURNO_FULL';
    v_message := 'Turno completo. Consultar en administración.';
    insert into public.access_logs (athlete_id, coach_id, weekly_schedule_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, null, v_weekly_schedule_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key || ':full');
    return jsonb_build_object(
      'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
      'weekly_schedule_id', v_weekly_schedule_id, 'remaining', v_remaining, 'actor_type', v_actor_type, 'athlete_id', v_athlete_id,
      'coach_id', null, 'full_name', coalesce(v_athlete_name, v_full_name), 'athlete_name', v_athlete_name, 'plan_name', v_plan_name, 'avatar_url', v_avatar_url,
      'ui_status', 'DENIED', 'ui_color', 'red',
      'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name, 'capacity', v_capacity, 'occupied', v_occupied, 'weekly_schedule_id', v_weekly_schedule_id));
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

  -- (8) OK -> consumir 1 acceso y registrar
  update public.athlete_monthly_counters
    set consumed_sessions = consumed_sessions + 1, updated_at = timezone('utc', now())
  where id = v_counter_id;
  v_remaining := v_remaining - 1;

  v_reason_code := case when v_is_grace then 'OK_GRACE' else 'OK' end;
  v_ui_status := case when v_is_grace then 'WARNING' else 'SUCCESS' end;
  v_ui_color := case when v_is_grace then 'amber' else 'green' end;
  v_message := '¡Bienvenido, ' || coalesce(v_athlete_name, v_full_name, 'Atleta') || '! Te quedan ' || v_remaining || ' accesos.';
  if v_local_time > v_slot_start then
    v_message := v_message || ' (La clase comenzó a las ' || to_char(v_slot_start, 'HH24:MI') || '.)';
  end if;
  if v_is_grace then
    v_message := v_message || ' Cuota vencida: regularizá tu pago (quedan ' || (greatest(coalesce(p_grace_days, 0), 0) - v_days_late) || ' días de gracia).';
  end if;

  insert into public.access_logs (athlete_id, coach_id, weekly_schedule_id, access_granted, reason_code, remaining_sessions, local_checkin_date, idempotency_key)
  values (v_athlete_id, null, v_weekly_schedule_id, true, v_reason_code, v_remaining, v_local_date, v_idempotency_key);

  return jsonb_build_object(
    'allowed', true, 'reason_code', v_reason_code, 'message', v_message,
    'weekly_schedule_id', v_weekly_schedule_id, 'remaining', v_remaining, 'actor_type', v_actor_type, 'athlete_id', v_athlete_id,
    'coach_id', null, 'full_name', coalesce(v_athlete_name, v_full_name), 'athlete_name', v_athlete_name, 'plan_name', v_plan_name, 'avatar_url', v_avatar_url,
    'ui_status', v_ui_status, 'ui_color', v_ui_color,
    'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name, 'remaining', v_remaining, 'period_start', v_period_start, 'period_end', v_period_end, 'expires_at', v_expiration, 'days_late', v_days_late, 'weekly_schedule_id', v_weekly_schedule_id, 'capacity', v_capacity, 'occupied', v_occupied + 1));
end;
$$;


--
-- Name: FUNCTION kiosk_check_in(p_dni text, p_phone text, p_now timestamp with time zone, p_timezone text, p_grace_days integer, p_autocreate_counter boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.kiosk_check_in(p_dni text, p_phone text, p_now timestamp with time zone, p_timezone text, p_grace_days integer, p_autocreate_counter boolean) IS 'Atomic kiosk check-in RPC with profiles-based identity; coach validation uses plan_schedule_slot_coaches via plan_schedule_slots.';


--
-- Name: only_digits(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.only_digits(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT nullif(regexp_replace(coalesce(p_text,''), '\D', '', 'g'), '');
$$;


--
-- Name: plan_grid_availability(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.plan_grid_availability(p_plan_id uuid) RETURNS TABLE(weekly_schedule_id uuid, day_of_week integer, start_time time without time zone, end_time time without time zone, capacity integer, plan_assignments_count integer, total_active_assignments_count integer, remaining_total integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with plan_slots as (
    select ws.id, ws.day_of_week, ws.start_time, ws.end_time, coalesce(ws.capacity, 0) as capacity
    from public.plan_schedule_slots pss
    join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
    where pss.plan_id = p_plan_id
  ),
  active_assignments as (
    select asa.weekly_schedule_id, a.id as athlete_id, a.plan_id
    from public.athlete_slot_assignments asa
    join public.athletes a on a.id = asa.athlete_id
    where asa.is_active = true
      and asa.starts_on <= current_date
      and (asa.ends_on is null or asa.ends_on >= current_date)
      and a.status = 'active'
  )
  select
    ps.id as weekly_schedule_id,
    ps.day_of_week,
    ps.start_time,
    ps.end_time,
    ps.capacity,
    count(distinct case when aa.plan_id = p_plan_id then aa.athlete_id end)::int as plan_assignments_count,
    count(distinct aa.athlete_id)::int as total_active_assignments_count,
    greatest(ps.capacity - count(distinct aa.athlete_id)::int, 0)::int as remaining_total
  from plan_slots ps
  left join active_assignments aa on aa.weekly_schedule_id = ps.id
  where public.is_staff()
  group by ps.id, ps.day_of_week, ps.start_time, ps.end_time, ps.capacity
  order by ps.day_of_week, ps.start_time;
$$;


--
-- Name: plan_slot_availability(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.plan_slot_availability(p_plan_id uuid) RETURNS TABLE(weekly_schedule_id uuid, day_of_week integer, start_time time without time zone, end_time time without time zone, capacity integer, active_assignments_count integer, remaining integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    ws.id as weekly_schedule_id,
    ws.day_of_week,
    ws.start_time,
    ws.end_time,
    coalesce(ws.capacity, 0) as capacity,
    count(distinct a.id)::int as active_assignments_count,
    greatest(coalesce(ws.capacity, 0) - count(distinct a.id)::int, 0) as remaining
  from public.plan_schedule_slots pss
  join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
  left join public.athlete_slot_assignments asa
    on asa.weekly_schedule_id = ws.id
    and asa.is_active = true
    and asa.starts_on <= current_date
    and (asa.ends_on is null or asa.ends_on >= current_date)
  left join public.athletes a
    on a.id = asa.athlete_id
    and a.status = 'active'
  where pss.plan_id = p_plan_id
    and public.is_staff()
  group by ws.id, ws.day_of_week, ws.start_time, ws.end_time, ws.capacity
  order by ws.day_of_week, ws.start_time;
$$;


--
-- Name: populate_workout_result_athlete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.populate_workout_result_athlete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Si no nos dan el athlete_id, lo buscamos en la sesión
  IF NEW.athlete_id IS NULL THEN
    SELECT athlete_id INTO NEW.athlete_id
    FROM workout_sessions
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: profiles_public_list(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profiles_public_list() RETURNS TABLE(id uuid, full_name text, avatar_url text, role public.user_role)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Admin: all profiles (public fields only)
  if public.is_admin(auth.uid()) then
    return query
    select p.id, p.full_name, p.avatar_url, p.role
    from public.profiles p;
    return;
  end if;

  -- Coach: assigned athletes + own profile (public fields only)
  if exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'profesor'
  ) then
    return query
    select distinct p.id, p.full_name, p.avatar_url, p.role
    from public.profiles p
    where p.id = auth.uid()
       or p.id in (
         select a.profile_id
         from public.athletes a
         join public.coaches c on c.id = a.coach_id
         where c.profile_id = auth.uid()
           and a.profile_id is not null
       );
    return;
  end if;

  -- Athlete or any other authenticated role: only own profile.
  return query
  select p.id, p.full_name, p.avatar_url, p.role
  from public.profiles p
  where p.id = auth.uid();
end;
$$;


--
-- Name: pssc_resolve_timeslot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pssc_resolve_timeslot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_weekly_id uuid;
  v_day int;
  v_start time;
  v_end time;
begin
  select pss.weekly_schedule_id
    into v_weekly_id
  from public.plan_schedule_slots pss
  where pss.id = new.plan_schedule_slot_id;

  if v_weekly_id is null then
    raise exception 'Invalid plan_schedule_slot_id: %', new.plan_schedule_slot_id;
  end if;

  select ws.day_of_week, ws.start_time, ws.end_time
    into v_day, v_start, v_end
  from public.weekly_schedule ws
  where ws.id = v_weekly_id;

  if v_day is null or v_start is null or v_end is null then
    raise exception 'weekly_schedule % incomplete timeslot data', v_weekly_id;
  end if;

  new.weekly_schedule_id := v_weekly_id;
  new.day_of_week := v_day;
  new.start_time := v_start;
  new.end_time := v_end;
  new.updated_at := now();

  return new;
end $$;


--
-- Name: reassign_athlete_slots_atomic(uuid, uuid, integer, uuid[], date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reassign_athlete_slots_atomic(p_athlete_id uuid, p_plan_id uuid, p_visits_per_week integer, p_selected_weekly_schedule_ids uuid[], p_effective_date date DEFAULT CURRENT_DATE) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_selected uuid[] := array(select distinct unnest(coalesce(p_selected_weekly_schedule_ids, '{}')));
  v_count int := coalesce(array_length(v_selected, 1), 0);
  v_current uuid[];
  v_slot uuid;
  v_remaining int;
begin
  if not public.is_staff() then
    raise exception 'Solo staff puede reasignar horarios' using errcode = '42501';
  end if;

  if p_athlete_id is null or p_plan_id is null then
    return jsonb_build_object('success', false, 'error', 'Falta atleta o plan para reasignar horarios.');
  end if;

  if coalesce(p_visits_per_week, 0) <= 0 then
    return jsonb_build_object('success', false, 'error', 'El atleta no tiene una frecuencia semanal válida.');
  end if;

  if v_count <> p_visits_per_week then
    return jsonb_build_object('success', false, 'error', format('Debes seleccionar exactamente %s horarios.', p_visits_per_week));
  end if;

  if (
    select count(*)
    from public.plan_schedule_slots
    where plan_id = p_plan_id and weekly_schedule_id = any(v_selected)
  ) <> v_count then
    return jsonb_build_object('success', false, 'error', 'Se detectaron horarios fuera del plan del atleta.');
  end if;

  perform 1
  from public.athlete_slot_assignments asa
  where asa.athlete_id = p_athlete_id
    and asa.is_active = true
    and asa.starts_on <= p_effective_date
    and (asa.ends_on is null or asa.ends_on >= p_effective_date)
  for update;

  select array_agg(asa.weekly_schedule_id)
  into v_current
  from public.athlete_slot_assignments asa
  where asa.athlete_id = p_athlete_id
    and asa.is_active = true
    and asa.starts_on <= p_effective_date
    and (asa.ends_on is null or asa.ends_on >= p_effective_date);

  for v_slot in select unnest(v_selected)
  loop
    if v_current is not null and v_slot = any(v_current) then
      continue;
    end if;

    select greatest(
  ws.capacity - count(distinct case when a.id is not null then asa.id end),
  0
)::int
    into v_remaining
    from public.weekly_schedule ws
    left join public.athlete_slot_assignments asa
      on asa.weekly_schedule_id = ws.id
      and asa.is_active = true
      and asa.starts_on <= p_effective_date
      and (asa.ends_on is null or asa.ends_on >= p_effective_date)
    left join public.athletes a on a.id = asa.athlete_id and a.status = 'active'
    where ws.id = v_slot
    group by ws.capacity;

    if coalesce(v_remaining, 0) <= 0 then
      return jsonb_build_object('success', false, 'error', 'Uno o más horarios seleccionados no tienen cupo disponible.');
    end if;
  end loop;

  update public.athlete_slot_assignments asa
  set is_active = false,
      ends_on = p_effective_date
  where asa.athlete_id = p_athlete_id
    and asa.is_active = true
    and asa.starts_on <= p_effective_date
    and (asa.ends_on is null or asa.ends_on >= p_effective_date)
    and not (asa.weekly_schedule_id = any(v_selected));

  insert into public.athlete_slot_assignments(athlete_id, weekly_schedule_id, starts_on, is_active)
  select p_athlete_id, s_id, p_effective_date, true
  from unnest(v_selected) s_id
  where not exists (
    select 1
    from public.athlete_slot_assignments asa
    where asa.athlete_id = p_athlete_id
      and asa.weekly_schedule_id = s_id
      and asa.is_active = true
      and asa.starts_on <= p_effective_date
      and (asa.ends_on is null or asa.ends_on >= p_effective_date)
  );

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;


--
-- Name: save_plan_configuration(uuid, text, text, numeric, integer, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_plan_configuration(p_plan_id uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT 0, p_capacity integer DEFAULT 0, p_status text DEFAULT 'active'::text, p_session_duration_min integer DEFAULT 60, p_features jsonb DEFAULT '[]'::jsonb, p_coach_ids jsonb DEFAULT '[]'::jsonb, p_legacy_schedule jsonb DEFAULT '[]'::jsonb, p_pricing_tiers jsonb DEFAULT '[]'::jsonb, p_availability_windows jsonb DEFAULT '[]'::jsonb, p_schedule_slots jsonb DEFAULT '[]'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_plan_id uuid;
  v_slot jsonb;
  v_slot_id uuid;
  v_desired_slot_ids uuid[] := '{}';
  v_blocked_count integer;
begin
  if not public.is_staff() then
    raise exception 'Solo staff puede guardar planes' using errcode = '42501';
  end if;

  if p_plan_id is null then
    insert into public.plans(name, description, price, capacity, status, session_duration_min)
    values (p_name, p_description, coalesce(p_price, 0), greatest(coalesce(p_capacity, 0), 0), coalesce(p_status, 'active'), greatest(coalesce(p_session_duration_min, 60), 15))
    returning id into v_plan_id;
  else
    update public.plans
      set name = p_name,
          description = p_description,
          price = coalesce(p_price, 0),
          capacity = greatest(coalesce(p_capacity, 0), 0),
          status = coalesce(p_status, 'active'),
          session_duration_min = greatest(coalesce(p_session_duration_min, 60), 15)
    where id = p_plan_id;

    if not found then
      raise exception 'Plan no encontrado: %', p_plan_id;
    end if;

    v_plan_id := p_plan_id;
  end if;

  delete from public.plan_features where plan_id = v_plan_id;
  insert into public.plan_features(plan_id, feature)
  select v_plan_id, trim(value)
  from jsonb_array_elements_text(coalesce(p_features, '[]'::jsonb)) v(value)
  where trim(value) <> '';

  delete from public.plan_coaches where plan_id = v_plan_id;
  insert into public.plan_coaches(plan_id, coach_id)
  select v_plan_id, (value)::uuid
  from jsonb_array_elements_text(coalesce(p_coach_ids, '[]'::jsonb)) v(value)
  where value ~* '^[0-9a-f-]{36}$';

  delete from public.plan_schedule where plan_id = v_plan_id;
  insert into public.plan_schedule(plan_id, day, time)
  select
    v_plan_id,
    coalesce(slot->>'day', 'Día'),
    coalesce(slot->>'time', '')
  from jsonb_array_elements(coalesce(p_legacy_schedule, '[]'::jsonb)) slot;

  delete from public.plan_pricing_tiers where plan_id = v_plan_id;
  insert into public.plan_pricing_tiers(plan_id, visits_per_week, price)
  select distinct
    v_plan_id,
    (tier->>'visits_per_week')::int,
    (tier->>'price')::numeric
  from jsonb_array_elements(coalesce(p_pricing_tiers, '[]'::jsonb)) tier
  where (tier->>'visits_per_week') ~ '^[0-9]+$'
    and (tier->>'price') ~ '^-?[0-9]+(\.[0-9]+)?$'
    and (tier->>'visits_per_week')::int > 0
    and (tier->>'price')::numeric >= 0;

  delete from public.plan_availability_windows where plan_id = v_plan_id;
  insert into public.plan_availability_windows(plan_id, day_of_week, start_time, end_time, capacity)
  select
    v_plan_id,
    (w->>'day_of_week')::int,
    (w->>'start_time')::time,
    (w->>'end_time')::time,
    greatest(coalesce((w->>'capacity')::int, 0), 0)
  from jsonb_array_elements(coalesce(p_availability_windows, '[]'::jsonb)) w
  where (w->>'day_of_week') ~ '^[0-6]$'
    and coalesce(w->>'start_time', '') <> ''
    and coalesce(w->>'end_time', '') <> ''
    and (w->>'end_time')::time > (w->>'start_time')::time;

  for v_slot in
    select value from jsonb_array_elements(coalesce(p_schedule_slots, '[]'::jsonb))
  loop
    if not ((v_slot->>'day_of_week') ~ '^[0-6]$') then
      continue;
    end if;

    select ws.id into v_slot_id
    from public.weekly_schedule ws
    where ws.day_of_week = (v_slot->>'day_of_week')::int
      and ws.start_time = (v_slot->>'start_time')::time
      and ws.end_time = (v_slot->>'end_time')::time
      and ws.capacity = greatest(coalesce((v_slot->>'capacity')::int, 0), 0)
    limit 1;

    if v_slot_id is null then
      insert into public.weekly_schedule(day_of_week, start_time, end_time, capacity)
      values (
        (v_slot->>'day_of_week')::int,
        (v_slot->>'start_time')::time,
        (v_slot->>'end_time')::time,
        greatest(coalesce((v_slot->>'capacity')::int, 0), 0)
      )
      returning id into v_slot_id;
    end if;

    v_desired_slot_ids := array_append(v_desired_slot_ids, v_slot_id);
    v_slot_id := null;
  end loop;

  select count(*) into v_blocked_count
  from public.plan_schedule_slots pss
  where pss.plan_id = v_plan_id
    and not (pss.weekly_schedule_id = any(v_desired_slot_ids))
    and exists (
      select 1
      from public.athlete_slot_assignments asa
      join public.athletes a on a.id = asa.athlete_id and a.status = 'active'
      where asa.weekly_schedule_id = pss.weekly_schedule_id
        and asa.is_active = true
        and asa.starts_on <= current_date
        and (asa.ends_on is null or asa.ends_on >= current_date)
    );

  if v_blocked_count > 0 then
    raise exception 'No se puede quitar un slot con atletas activos asignados (% slots bloqueados).', v_blocked_count;
  end if;

  delete from public.plan_schedule_slots
  where plan_id = v_plan_id
    and not (weekly_schedule_id = any(v_desired_slot_ids));

  insert into public.plan_schedule_slots(plan_id, weekly_schedule_id)
  select distinct v_plan_id, s_id
  from unnest(v_desired_slot_ids) s_id
  on conflict (plan_id, weekly_schedule_id) do nothing;

  return v_plan_id;
end;
$_$;


--
-- Name: set_profiles_identity_normalized(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_profiles_identity_normalized() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.dni_normalized := public.only_digits(new.dni);
  new.phone_normalized := public.only_digits(new.phone);
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


--
-- Name: unassign_coach_from_plan_slot(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_coach_from_plan_slot(p_plan_id uuid, p_weekly_schedule_id uuid, p_coach_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_plan_slot_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Not allowed: staff only';
  end if;

  if p_plan_id is null or p_weekly_schedule_id is null or p_coach_id is null then
    raise exception 'p_plan_id, p_weekly_schedule_id and p_coach_id are required';
  end if;

  select pss.id
    into v_plan_slot_id
  from public.plan_schedule_slots pss
  where pss.plan_id = p_plan_id
    and pss.weekly_schedule_id = p_weekly_schedule_id
  limit 1;

  if v_plan_slot_id is null then
    return false;
  end if;

  delete from public.plan_schedule_slot_coaches pssc
  where pssc.plan_schedule_slot_id = v_plan_slot_id
    and pssc.coach_id = p_coach_id;

  return true;
end $$;


--
-- Name: access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    check_in_time timestamp with time zone DEFAULT now(),
    access_granted boolean DEFAULT true,
    rejection_reason text,
    weekly_schedule_id uuid,
    reason_code text,
    remaining_sessions integer,
    idempotency_key text,
    local_checkin_date date,
    coach_id uuid
);


--
-- Name: athlete_monthly_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.athlete_monthly_counters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    allowed_sessions integer NOT NULL,
    consumed_sessions integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT athlete_monthly_counters_consumed_chk CHECK ((consumed_sessions <= allowed_sessions)),
    CONSTRAINT athlete_monthly_counters_period_chk CHECK ((period_end >= period_start))
);


--
-- Name: athlete_routines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.athlete_routines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    routine_id uuid,
    start_date date NOT NULL,
    status text DEFAULT 'active'::text
);


--
-- Name: athlete_slot_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.athlete_slot_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid NOT NULL,
    weekly_schedule_id uuid NOT NULL,
    starts_on date NOT NULL,
    ends_on date,
    is_active boolean DEFAULT true NOT NULL,
    assigned_reason_code text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT athlete_slot_assignments_dates_chk CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)))
);


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    session_id uuid,
    attendance_date date NOT NULL,
    status text NOT NULL,
    date date GENERATED ALWAYS AS (attendance_date) STORED
);


--
-- Name: class_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#3b82f6'::text
);


--
-- Name: coaches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    specialization text,
    created_at timestamp with time zone DEFAULT now(),
    bio text DEFAULT 'Entrenador del Staff'::text,
    phone text
);


--
-- Name: daily_wods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_wods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    class_type_id uuid,
    title text,
    description text,
    coach_notes text
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    plan_id uuid,
    enrollment_date date NOT NULL,
    status text DEFAULT 'active'::text
);


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    muscle_group text,
    unit text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: kiosk_reason_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kiosk_reason_codes (
    code text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    name text NOT NULL,
    value numeric NOT NULL,
    unit text,
    metric_date date NOT NULL,
    trend text
);


--
-- Name: metrics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics AS
 SELECT id,
    athlete_id,
    name,
    value,
    unit,
    metric_date AS date,
    trend
   FROM public.performance_metrics;


--
-- Name: metrics_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    category text DEFAULT 'General'::text,
    is_global boolean DEFAULT false,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    coach_id uuid,
    content text NOT NULL,
    date date DEFAULT CURRENT_DATE,
    type text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    payment_date date NOT NULL,
    amount numeric NOT NULL,
    status text NOT NULL,
    method text,
    concept text,
    date date GENERATED ALWAYS AS (payment_date) STORED,
    base_amount numeric,
    discount_value numeric DEFAULT 0,
    discount_type text
);


--
-- Name: COLUMN payments.date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payments.date IS 'Deprecado: usar siempre payment_date';


--
-- Name: plan_availability_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_availability_windows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    day_of_week integer,
    start_time time without time zone,
    end_time time without time zone,
    capacity integer DEFAULT 0
);


--
-- Name: plan_coaches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    coach_id uuid
);


--
-- Name: plan_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    feature text NOT NULL
);


--
-- Name: plan_pricing_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_pricing_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    visits_per_week integer NOT NULL,
    price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT plan_pricing_tiers_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT plan_pricing_tiers_visits_per_week_check CHECK ((visits_per_week > 0))
);


--
-- Name: plan_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    day text NOT NULL,
    "time" text NOT NULL
);


--
-- Name: plan_schedule_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_schedule_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    weekly_schedule_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    class_type_id uuid,
    activity_detail text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric,
    capacity integer,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    access_limit integer,
    session_duration_min integer DEFAULT 60 NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    role public.user_role DEFAULT 'atleta'::public.user_role NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    dni text,
    dni_normalized text,
    phone text,
    phone_normalized text
);


--
-- Name: profiles_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_public AS
 SELECT id,
    full_name,
    avatar_url,
    role
   FROM public.profiles_public_list() profiles_public_list(id, full_name, avatar_url, role);


--
-- Name: VIEW profiles_public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.profiles_public IS 'Safe people listing view without PII. Uses profiles_public_list() scoping by caller role.';


--
-- Name: routine_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routine_exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    routine_id uuid,
    exercise_id uuid,
    order_index integer,
    prescribed_sets integer,
    prescribed_reps integer,
    prescribed_load numeric,
    prescribed_time_sec integer,
    notes text
);


--
-- Name: routines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sport text NOT NULL,
    target_level text,
    goal text,
    coach_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: schedule_coaches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_id uuid,
    coach_id uuid
);


--
-- Name: session_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    athlete_id uuid
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    session_date date NOT NULL,
    "time" text,
    coach_id uuid,
    type text,
    location text,
    status text DEFAULT 'scheduled'::text,
    capacity integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: weekly_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_type_id uuid,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    capacity integer DEFAULT 20
);


--
-- Name: workout_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    exercise_id uuid,
    sets_done integer,
    reps_done integer,
    load_done numeric,
    time_sec integer,
    rpe numeric,
    notes text,
    athlete_id uuid
);


--
-- Name: workout_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid,
    routine_id uuid,
    session_date date NOT NULL,
    coach_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: access_logs access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_pkey PRIMARY KEY (id);


--
-- Name: athlete_monthly_counters athlete_monthly_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_monthly_counters
    ADD CONSTRAINT athlete_monthly_counters_pkey PRIMARY KEY (id);


--
-- Name: athlete_monthly_counters athlete_monthly_counters_unique_period; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_monthly_counters
    ADD CONSTRAINT athlete_monthly_counters_unique_period UNIQUE (athlete_id, period_start, period_end);


--
-- Name: athlete_routines athlete_routines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_routines
    ADD CONSTRAINT athlete_routines_pkey PRIMARY KEY (id);


--
-- Name: athlete_slot_assignments athlete_slot_assignments_no_overlap_per_slot_excl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_slot_assignments
    ADD CONSTRAINT athlete_slot_assignments_no_overlap_per_slot_excl EXCLUDE USING gist (athlete_id WITH =, weekly_schedule_id WITH =, daterange(starts_on, COALESCE(ends_on, 'infinity'::date), '[]'::text) WITH &&) WHERE (is_active);


--
-- Name: athlete_slot_assignments athlete_slot_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_slot_assignments
    ADD CONSTRAINT athlete_slot_assignments_pkey PRIMARY KEY (id);


--
-- Name: athletes athletes_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT athletes_dni_key UNIQUE (dni);


--
-- Name: athletes athletes_dni_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT athletes_dni_unique UNIQUE (dni);


--
-- Name: athletes athletes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT athletes_pkey PRIMARY KEY (id);


--
-- Name: athletes athletes_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT athletes_profile_id_key UNIQUE (profile_id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: class_types class_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_types
    ADD CONSTRAINT class_types_pkey PRIMARY KEY (id);


--
-- Name: coaches coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_pkey PRIMARY KEY (id);


--
-- Name: coaches coaches_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_profile_id_key UNIQUE (profile_id);


--
-- Name: daily_wods daily_wods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_wods
    ADD CONSTRAINT daily_wods_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: kiosk_reason_codes kiosk_reason_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kiosk_reason_codes
    ADD CONSTRAINT kiosk_reason_codes_pkey PRIMARY KEY (code);


--
-- Name: metrics_catalog metrics_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_catalog
    ADD CONSTRAINT metrics_catalog_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: performance_metrics performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics
    ADD CONSTRAINT performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: plan_availability_windows plan_availability_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_availability_windows
    ADD CONSTRAINT plan_availability_windows_pkey PRIMARY KEY (id);


--
-- Name: plan_coaches plan_coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_coaches
    ADD CONSTRAINT plan_coaches_pkey PRIMARY KEY (id);


--
-- Name: plan_features plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_pkey PRIMARY KEY (id);


--
-- Name: plan_pricing_tiers plan_pricing_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_pricing_tiers
    ADD CONSTRAINT plan_pricing_tiers_pkey PRIMARY KEY (id);


--
-- Name: plan_pricing_tiers plan_pricing_tiers_plan_id_visits_per_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_pricing_tiers
    ADD CONSTRAINT plan_pricing_tiers_plan_id_visits_per_week_key UNIQUE (plan_id, visits_per_week);


--
-- Name: plan_schedule plan_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule
    ADD CONSTRAINT plan_schedule_pkey PRIMARY KEY (id);


--
-- Name: plan_schedule_slot_coaches plan_schedule_slot_coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slot_coaches
    ADD CONSTRAINT plan_schedule_slot_coaches_pkey PRIMARY KEY (id);


--
-- Name: plan_schedule_slots plan_schedule_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slots
    ADD CONSTRAINT plan_schedule_slots_pkey PRIMARY KEY (id);


--
-- Name: plan_schedule_slots plan_schedule_slots_plan_id_weekly_schedule_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slots
    ADD CONSTRAINT plan_schedule_slots_plan_id_weekly_schedule_id_key UNIQUE (plan_id, weekly_schedule_id);


--
-- Name: plan_schedule_slots plan_schedule_slots_plan_weekly_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slots
    ADD CONSTRAINT plan_schedule_slots_plan_weekly_unique UNIQUE (plan_id, weekly_schedule_id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: plan_schedule_slot_coaches pssc_unique_coach_same_timeslot; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slot_coaches
    ADD CONSTRAINT pssc_unique_coach_same_timeslot UNIQUE (coach_id, day_of_week, start_time, end_time);


--
-- Name: plan_schedule_slot_coaches pssc_unique_plan_slot_coach; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slot_coaches
    ADD CONSTRAINT pssc_unique_plan_slot_coach UNIQUE (plan_schedule_slot_id, coach_id);


--
-- Name: routine_exercises routine_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_exercises
    ADD CONSTRAINT routine_exercises_pkey PRIMARY KEY (id);


--
-- Name: routines routines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_pkey PRIMARY KEY (id);


--
-- Name: schedule_coaches schedule_coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_coaches
    ADD CONSTRAINT schedule_coaches_pkey PRIMARY KEY (id);


--
-- Name: session_attendees session_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attendees
    ADD CONSTRAINT session_attendees_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: weekly_schedule weekly_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_schedule
    ADD CONSTRAINT weekly_schedule_pkey PRIMARY KEY (id);


--
-- Name: workout_results workout_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_results
    ADD CONSTRAINT workout_results_pkey PRIMARY KEY (id);


--
-- Name: workout_sessions workout_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_pkey PRIMARY KEY (id);


--
-- Name: idx_access_logs_athlete_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_logs_athlete_time ON public.access_logs USING btree (athlete_id, check_in_time);


--
-- Name: idx_access_logs_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_logs_coach_id ON public.access_logs USING btree (coach_id);


--
-- Name: idx_access_logs_local_checkin_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_logs_local_checkin_date ON public.access_logs USING btree (local_checkin_date);


--
-- Name: idx_access_logs_reason_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_logs_reason_code ON public.access_logs USING btree (reason_code);


--
-- Name: idx_access_logs_weekly_schedule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_logs_weekly_schedule_id ON public.access_logs USING btree (weekly_schedule_id);


--
-- Name: idx_athlete_monthly_counters_athlete_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athlete_monthly_counters_athlete_id ON public.athlete_monthly_counters USING btree (athlete_id);


--
-- Name: idx_athlete_monthly_counters_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athlete_monthly_counters_period ON public.athlete_monthly_counters USING btree (period_start, period_end);


--
-- Name: idx_athlete_slot_assignments_athlete_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athlete_slot_assignments_athlete_id ON public.athlete_slot_assignments USING btree (athlete_id);


--
-- Name: idx_athlete_slot_assignments_schedule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athlete_slot_assignments_schedule_id ON public.athlete_slot_assignments USING btree (weekly_schedule_id);


--
-- Name: idx_athletes_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athletes_coach ON public.athletes USING btree (coach_id);


--
-- Name: idx_athletes_dni; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athletes_dni ON public.athletes USING btree (dni);


--
-- Name: idx_attendance_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_athlete ON public.attendance USING btree (athlete_id);


--
-- Name: idx_enrollments_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_athlete ON public.enrollments USING btree (athlete_id);


--
-- Name: idx_kiosk_reason_codes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kiosk_reason_codes_active ON public.kiosk_reason_codes USING btree (is_active);


--
-- Name: idx_metrics_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_athlete ON public.performance_metrics USING btree (athlete_id);


--
-- Name: idx_payments_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_athlete ON public.payments USING btree (athlete_id);


--
-- Name: idx_plan_availability_windows_day_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_availability_windows_day_time ON public.plan_availability_windows USING btree (day_of_week, start_time, end_time);


--
-- Name: idx_plan_availability_windows_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_availability_windows_plan_id ON public.plan_availability_windows USING btree (plan_id);


--
-- Name: idx_plan_pricing_tiers_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_pricing_tiers_plan_id ON public.plan_pricing_tiers USING btree (plan_id);


--
-- Name: idx_plan_pricing_tiers_visits; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_pricing_tiers_visits ON public.plan_pricing_tiers USING btree (visits_per_week);


--
-- Name: idx_plan_schedule_slots_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_schedule_slots_plan_id ON public.plan_schedule_slots USING btree (plan_id);


--
-- Name: idx_plan_schedule_slots_schedule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_schedule_slots_schedule_id ON public.plan_schedule_slots USING btree (weekly_schedule_id);


--
-- Name: idx_pssc_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pssc_coach_id ON public.plan_schedule_slot_coaches USING btree (coach_id);


--
-- Name: idx_pssc_plan_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pssc_plan_slot ON public.plan_schedule_slot_coaches USING btree (plan_schedule_slot_id);


--
-- Name: idx_pssc_weekly_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pssc_weekly_schedule ON public.plan_schedule_slot_coaches USING btree (weekly_schedule_id);


--
-- Name: idx_routines_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routines_coach ON public.routines USING btree (coach_id);


--
-- Name: idx_sessions_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_coach ON public.sessions USING btree (coach_id);


--
-- Name: idx_weekly_schedule_day_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_schedule_day_time ON public.weekly_schedule USING btree (day_of_week, start_time, end_time);


--
-- Name: idx_workout_sessions_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workout_sessions_athlete ON public.workout_sessions USING btree (athlete_id);


--
-- Name: uq_access_logs_granted_athlete_slot_local_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_access_logs_granted_athlete_slot_local_date ON public.access_logs USING btree (athlete_id, weekly_schedule_id, local_checkin_date) WHERE ((access_granted IS TRUE) AND (athlete_id IS NOT NULL) AND (weekly_schedule_id IS NOT NULL) AND (local_checkin_date IS NOT NULL));


--
-- Name: uq_access_logs_idempotency_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_access_logs_idempotency_coach ON public.access_logs USING btree (idempotency_key) WHERE (coach_id IS NOT NULL);


--
-- Name: uq_athlete_monthly_counters_period; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_athlete_monthly_counters_period ON public.athlete_monthly_counters USING btree (athlete_id, period_start, period_end);


--
-- Name: uq_profiles_dni_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_profiles_dni_normalized ON public.profiles USING btree (dni_normalized) WHERE (dni_normalized IS NOT NULL);


--
-- Name: uq_profiles_phone_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_profiles_phone_normalized ON public.profiles USING btree (phone_normalized) WHERE (phone_normalized IS NOT NULL);


--
-- Name: uq_schedule_coaches_schedule_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_schedule_coaches_schedule_coach ON public.schedule_coaches USING btree (schedule_id, coach_id);


--
-- Name: uq_weekly_schedule_natural_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_weekly_schedule_natural_slot ON public.weekly_schedule USING btree (day_of_week, start_time, end_time, capacity) WHERE ((day_of_week IS NOT NULL) AND (start_time IS NOT NULL) AND (end_time IS NOT NULL));


--
-- Name: workout_results set_workout_result_athlete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_workout_result_athlete BEFORE INSERT ON public.workout_results FOR EACH ROW EXECUTE FUNCTION public.populate_workout_result_athlete();


--
-- Name: athlete_monthly_counters trg_athlete_monthly_counters_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_athlete_monthly_counters_set_updated_at BEFORE UPDATE ON public.athlete_monthly_counters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: athlete_slot_assignments trg_athlete_slot_assignments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_athlete_slot_assignments_set_updated_at BEFORE UPDATE ON public.athlete_slot_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: kiosk_reason_codes trg_kiosk_reason_codes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kiosk_reason_codes_set_updated_at BEFORE UPDATE ON public.kiosk_reason_codes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: plan_pricing_tiers trg_plan_pricing_tiers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_pricing_tiers_set_updated_at BEFORE UPDATE ON public.plan_pricing_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: plan_schedule_slots trg_plan_schedule_slots_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_schedule_slots_touch_updated_at BEFORE UPDATE ON public.plan_schedule_slots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: profiles trg_profiles_identity_normalized; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_identity_normalized BEFORE INSERT OR UPDATE OF dni, phone ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_profiles_identity_normalized();


--
-- Name: plan_schedule_slot_coaches trg_pssc_resolve_timeslot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pssc_resolve_timeslot BEFORE INSERT OR UPDATE OF plan_schedule_slot_id, coach_id ON public.plan_schedule_slot_coaches FOR EACH ROW EXECUTE FUNCTION public.pssc_resolve_timeslot();


--
-- Name: access_logs access_logs_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: access_logs access_logs_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: access_logs access_logs_reason_code_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_reason_code_fk FOREIGN KEY (reason_code) REFERENCES public.kiosk_reason_codes(code);


--
-- Name: access_logs access_logs_weekly_schedule_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_weekly_schedule_id_fk FOREIGN KEY (weekly_schedule_id) REFERENCES public.weekly_schedule(id);


--
-- Name: athlete_monthly_counters athlete_monthly_counters_athlete_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_monthly_counters
    ADD CONSTRAINT athlete_monthly_counters_athlete_fk FOREIGN KEY (athlete_id) REFERENCES public.athletes(id);


--
-- Name: athlete_routines athlete_routines_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_routines
    ADD CONSTRAINT athlete_routines_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: athlete_routines athlete_routines_routine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_routines
    ADD CONSTRAINT athlete_routines_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE CASCADE;


--
-- Name: athlete_slot_assignments athlete_slot_assignments_assigned_reason_code_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_slot_assignments
    ADD CONSTRAINT athlete_slot_assignments_assigned_reason_code_fk FOREIGN KEY (assigned_reason_code) REFERENCES public.kiosk_reason_codes(code);


--
-- Name: athlete_slot_assignments athlete_slot_assignments_athlete_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_slot_assignments
    ADD CONSTRAINT athlete_slot_assignments_athlete_fk FOREIGN KEY (athlete_id) REFERENCES public.athletes(id);


--
-- Name: athlete_slot_assignments athlete_slot_assignments_weekly_schedule_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_slot_assignments
    ADD CONSTRAINT athlete_slot_assignments_weekly_schedule_fk FOREIGN KEY (weekly_schedule_id) REFERENCES public.weekly_schedule(id);


--
-- Name: athletes athletes_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT athletes_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: athletes athletes_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT athletes_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: attendance attendance_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: daily_wods daily_wods_class_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_wods
    ADD CONSTRAINT daily_wods_class_type_id_fkey FOREIGN KEY (class_type_id) REFERENCES public.class_types(id);


--
-- Name: enrollments enrollments_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: athletes fk_athletes_profile; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT fk_athletes_profile FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coaches fk_coaches_profile; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT fk_coaches_profile FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: metrics_catalog metrics_catalog_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_catalog
    ADD CONSTRAINT metrics_catalog_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: notes notes_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id);


--
-- Name: notes notes_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: payments payments_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: performance_metrics performance_metrics_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics
    ADD CONSTRAINT performance_metrics_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: plan_coaches plan_coaches_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_coaches
    ADD CONSTRAINT plan_coaches_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;


--
-- Name: plan_coaches plan_coaches_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_coaches
    ADD CONSTRAINT plan_coaches_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_features plan_features_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_pricing_tiers plan_pricing_tiers_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_pricing_tiers
    ADD CONSTRAINT plan_pricing_tiers_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_schedule plan_schedule_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule
    ADD CONSTRAINT plan_schedule_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_schedule_slot_coaches plan_schedule_slot_coaches_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slot_coaches
    ADD CONSTRAINT plan_schedule_slot_coaches_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;


--
-- Name: plan_schedule_slot_coaches plan_schedule_slot_coaches_plan_schedule_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slot_coaches
    ADD CONSTRAINT plan_schedule_slot_coaches_plan_schedule_slot_id_fkey FOREIGN KEY (plan_schedule_slot_id) REFERENCES public.plan_schedule_slots(id) ON DELETE CASCADE;


--
-- Name: plan_schedule_slot_coaches plan_schedule_slot_coaches_weekly_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slot_coaches
    ADD CONSTRAINT plan_schedule_slot_coaches_weekly_schedule_id_fkey FOREIGN KEY (weekly_schedule_id) REFERENCES public.weekly_schedule(id) ON DELETE CASCADE;


--
-- Name: plan_schedule_slots plan_schedule_slots_class_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slots
    ADD CONSTRAINT plan_schedule_slots_class_type_id_fkey FOREIGN KEY (class_type_id) REFERENCES public.class_types(id);


--
-- Name: plan_schedule_slots plan_schedule_slots_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slots
    ADD CONSTRAINT plan_schedule_slots_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_schedule_slots plan_schedule_slots_weekly_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_slots
    ADD CONSTRAINT plan_schedule_slots_weekly_schedule_id_fkey FOREIGN KEY (weekly_schedule_id) REFERENCES public.weekly_schedule(id) ON DELETE CASCADE;


--
-- Name: routine_exercises routine_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_exercises
    ADD CONSTRAINT routine_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: routine_exercises routine_exercises_routine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_exercises
    ADD CONSTRAINT routine_exercises_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE CASCADE;


--
-- Name: routines routines_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: schedule_coaches schedule_coaches_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_coaches
    ADD CONSTRAINT schedule_coaches_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;


--
-- Name: schedule_coaches schedule_coaches_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_coaches
    ADD CONSTRAINT schedule_coaches_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.weekly_schedule(id) ON DELETE CASCADE;


--
-- Name: session_attendees session_attendees_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attendees
    ADD CONSTRAINT session_attendees_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: session_attendees session_attendees_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attendees
    ADD CONSTRAINT session_attendees_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: sessions sessions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE SET NULL;


--
-- Name: weekly_schedule weekly_schedule_class_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_schedule
    ADD CONSTRAINT weekly_schedule_class_type_id_fkey FOREIGN KEY (class_type_id) REFERENCES public.class_types(id);


--
-- Name: workout_results workout_results_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_results
    ADD CONSTRAINT workout_results_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id);


--
-- Name: workout_results workout_results_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_results
    ADD CONSTRAINT workout_results_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: workout_results workout_results_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_results
    ADD CONSTRAINT workout_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE;


--
-- Name: workout_sessions workout_sessions_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;


--
-- Name: workout_sessions workout_sessions_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: workout_sessions workout_sessions_routine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE SET NULL;


--
-- Name: performance_metrics Atletas cargan sus propias metricas reales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Atletas cargan sus propias metricas reales" ON public.performance_metrics FOR INSERT WITH CHECK ((auth.uid() IN ( SELECT athletes.profile_id
   FROM public.athletes
  WHERE (athletes.id = performance_metrics.athlete_id))));


--
-- Name: performance_metrics Atletas ven sus propias metricas reales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Atletas ven sus propias metricas reales" ON public.performance_metrics FOR SELECT USING ((auth.uid() IN ( SELECT athletes.profile_id
   FROM public.athletes
  WHERE (athletes.id = performance_metrics.athlete_id))));


--
-- Name: metrics_catalog Crear métricas propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Crear métricas propias" ON public.metrics_catalog FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: metrics_catalog Ver catálogo híbrido; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ver catálogo híbrido" ON public.metrics_catalog FOR SELECT USING (((is_global = true) OR (owner_id = auth.uid())));


--
-- Name: access_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: access_logs access_logs_delete_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_logs_delete_staff ON public.access_logs FOR DELETE TO authenticated USING (public.is_staff());


--
-- Name: access_logs access_logs_insert_authenticated_controlled; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_logs_insert_authenticated_controlled ON public.access_logs FOR INSERT TO authenticated WITH CHECK (((COALESCE(access_granted, false) = false) OR public.is_staff()));


--
-- Name: access_logs access_logs_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_logs_select_staff ON public.access_logs FOR SELECT TO authenticated USING (public.is_staff());


--
-- Name: access_logs access_logs_update_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_logs_update_staff ON public.access_logs FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: athlete_routines admin full access athlete_routines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access athlete_routines" ON public.athlete_routines USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: athletes admin full access athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access athletes" ON public.athletes USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: attendance admin full access attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access attendance" ON public.attendance USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: coaches admin full access coaches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access coaches" ON public.coaches USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: enrollments admin full access enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access enrollments" ON public.enrollments TO authenticated USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::public.user_role));


--
-- Name: exercises admin full access exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access exercises" ON public.exercises USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: notes admin full access notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access notes" ON public.notes USING (public.is_admin(auth.uid()));


--
-- Name: payments admin full access payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access payments" ON public.payments USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: performance_metrics admin full access performance_metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access performance_metrics" ON public.performance_metrics USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: plan_coaches admin full access plan_coaches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access plan_coaches" ON public.plan_coaches USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: plan_features admin full access plan_features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access plan_features" ON public.plan_features USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: plan_schedule admin full access plan_schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access plan_schedule" ON public.plan_schedule USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: plans admin full access plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access plans" ON public.plans USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: profiles admin full access profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access profiles" ON public.profiles USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: routine_exercises admin full access routine_exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access routine_exercises" ON public.routine_exercises USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: routines admin full access routines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access routines" ON public.routines USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: session_attendees admin full access session_attendees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access session_attendees" ON public.session_attendees USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: sessions admin full access sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access sessions" ON public.sessions USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: workout_results admin full access workout_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access workout_results" ON public.workout_results USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: workout_sessions admin full access workout_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin full access workout_sessions" ON public.workout_sessions USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: exercises athlete read exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read exercises" ON public.exercises FOR SELECT USING (true);


--
-- Name: attendance athlete read own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own attendance" ON public.attendance FOR SELECT USING ((athlete_id = public.athlete_id_for_user(auth.uid())));


--
-- Name: session_attendees athlete read own attendance list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own attendance list" ON public.session_attendees FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: enrollments athlete read own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own enrollments" ON public.enrollments FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: performance_metrics athlete read own metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own metrics" ON public.performance_metrics FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: notes athlete read own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own notes" ON public.notes FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: payments athlete read own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own payments" ON public.payments FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: workout_results athlete read own results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own results" ON public.workout_results FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: athlete_routines athlete read own routines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own routines" ON public.athlete_routines FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: athletes athlete read own row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own row" ON public.athletes FOR SELECT USING ((profile_id = auth.uid()));


--
-- Name: workout_sessions athlete read own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read own sessions" ON public.workout_sessions FOR SELECT USING ((athlete_id IN ( SELECT athletes.id
   FROM public.athletes
  WHERE (athletes.profile_id = auth.uid()))));


--
-- Name: plans athlete read plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "athlete read plans" ON public.plans FOR SELECT USING (public.is_athlete(auth.uid()));


--
-- Name: athlete_monthly_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.athlete_monthly_counters ENABLE ROW LEVEL SECURITY;

--
-- Name: athlete_monthly_counters athlete_monthly_counters_all_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY athlete_monthly_counters_all_staff ON public.athlete_monthly_counters TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: athlete_monthly_counters athlete_monthly_counters_read_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY athlete_monthly_counters_read_staff ON public.athlete_monthly_counters FOR SELECT TO authenticated USING (public.is_staff());


--
-- Name: athlete_routines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.athlete_routines ENABLE ROW LEVEL SECURITY;

--
-- Name: athlete_slot_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.athlete_slot_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: athlete_slot_assignments athlete_slot_assignments_all_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY athlete_slot_assignments_all_staff ON public.athlete_slot_assignments TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: athlete_slot_assignments athlete_slot_assignments_read_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY athlete_slot_assignments_read_staff ON public.athlete_slot_assignments FOR SELECT TO authenticated USING (public.is_staff());


--
-- Name: athletes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: athlete_routines coach manage athlete_routines for assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach manage athlete_routines for assigned athletes" ON public.athlete_routines USING ((public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_admin(auth.uid())));


--
-- Name: notes coach manage notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach manage notes" ON public.notes USING ((coach_id IN ( SELECT coaches.id
   FROM public.coaches
  WHERE (coaches.profile_id = auth.uid()))));


--
-- Name: routines coach manage own routines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach manage own routines" ON public.routines USING (((coach_id = public.coach_id_for_user(auth.uid())) OR public.is_admin(auth.uid()))) WITH CHECK (((coach_id = public.coach_id_for_user(auth.uid())) OR public.is_admin(auth.uid())));


--
-- Name: workout_results coach manage results for assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach manage results for assigned athletes" ON public.workout_results USING ((public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_admin(auth.uid())));


--
-- Name: routine_exercises coach manage routine_exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach manage routine_exercises" ON public.routine_exercises USING (((routine_id IN ( SELECT routines.id
   FROM public.routines
  WHERE (routines.coach_id = public.coach_id_for_user(auth.uid())))) OR public.is_admin(auth.uid()))) WITH CHECK (((routine_id IN ( SELECT routines.id
   FROM public.routines
  WHERE (routines.coach_id = public.coach_id_for_user(auth.uid())))) OR public.is_admin(auth.uid())));


--
-- Name: workout_sessions coach manage sessions for assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach manage sessions for assigned athletes" ON public.workout_sessions USING ((public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_admin(auth.uid())));


--
-- Name: athletes coach read assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read assigned athletes" ON public.athletes FOR SELECT USING ((coach_id IN ( SELECT coaches.id
   FROM public.coaches
  WHERE (coaches.profile_id = auth.uid()))));


--
-- Name: attendance coach read attendance of assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read attendance of assigned athletes" ON public.attendance FOR SELECT USING (public.is_coach_of_athlete(auth.uid(), athlete_id));


--
-- Name: session_attendees coach read attendees for own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read attendees for own sessions" ON public.session_attendees FOR SELECT USING ((session_id IN ( SELECT sessions.id
   FROM public.sessions
  WHERE (sessions.coach_id = public.coach_id_for_user(auth.uid())))));


--
-- Name: enrollments coach read enrollments of assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read enrollments of assigned athletes" ON public.enrollments FOR SELECT USING (public.is_coach_of_athlete(auth.uid(), athlete_id));


--
-- Name: exercises coach read exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read exercises" ON public.exercises FOR SELECT USING (public.is_coach(auth.uid()));


--
-- Name: performance_metrics coach read metrics of assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read metrics of assigned athletes" ON public.performance_metrics FOR SELECT USING (public.is_coach_of_athlete(auth.uid(), athlete_id));


--
-- Name: coaches coach read own row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read own row" ON public.coaches FOR SELECT USING ((profile_id = auth.uid()));


--
-- Name: sessions coach read own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read own sessions" ON public.sessions FOR SELECT USING ((coach_id = public.coach_id_for_user(auth.uid())));


--
-- Name: payments coach read payments of assigned athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read payments of assigned athletes" ON public.payments FOR SELECT USING (public.is_coach_of_athlete(auth.uid(), athlete_id));


--
-- Name: plans coach read plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coach read plans" ON public.plans FOR SELECT USING (public.is_coach(auth.uid()));


--
-- Name: coaches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: performance_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_coaches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_coaches ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_features; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_pricing_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_pricing_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_pricing_tiers plan_pricing_tiers_all_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_pricing_tiers_all_staff ON public.plan_pricing_tiers TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: plan_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_schedule_slot_coaches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_schedule_slot_coaches ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_schedule_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_schedule_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_schedule_slots plan_schedule_slots_all_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_schedule_slots_all_staff ON public.plan_schedule_slots TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_staff_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_staff_only ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_staff());


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles profiles_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_staff ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: plan_schedule_slot_coaches pssc_mutate_staff_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pssc_mutate_staff_only ON public.plan_schedule_slot_coaches USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: plan_schedule_slot_coaches pssc_select_staff_or_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pssc_select_staff_or_self ON public.plan_schedule_slot_coaches FOR SELECT USING ((public.is_staff() OR (coach_id = public.current_coach_id())));


--
-- Name: routine_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: routines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_coaches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_coaches ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_coaches schedule_coaches_mutate_staff_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_coaches_mutate_staff_only ON public.schedule_coaches TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: schedule_coaches schedule_coaches_select_staff_or_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_coaches_select_staff_or_self ON public.schedule_coaches FOR SELECT TO authenticated USING ((public.is_staff() OR (coach_id IN ( SELECT c.id
   FROM public.coaches c
  WHERE (c.profile_id = auth.uid())))));


--
-- Name: session_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles user update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: weekly_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_schedule weekly_schedule_mutate_staff_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_schedule_mutate_staff_only ON public.weekly_schedule TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: weekly_schedule weekly_schedule_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_schedule_select_authenticated ON public.weekly_schedule FOR SELECT TO authenticated USING ((public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.coaches c
  WHERE (c.profile_id = auth.uid())))));


--
-- Name: workout_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_results ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict eXtEDLGdIWJEfSAj9F7qXB76Qr5LpF7IwMtIen5mBGzBtM3wFcxg8sBiEFcxytF


-- Trigger en auth.users (fuera del schema public, se versiona aquí):
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
