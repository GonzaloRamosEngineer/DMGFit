-- ============================================================
-- 0000_baseline.sql
-- Baseline consolidado del esquema public de PRODUCCIÓN (Fitness DMG).
-- Generado con 'supabase db dump' el 2026-07-19. Reconstruye la base desde cero.
-- Reemplaza a schema_snapshot.sql y consolida las migraciones 0001-0026
-- (archivadas en supabase/_archive_migrations/).
-- ============================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'profesor',
    'atleta'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_billing_status"("p_now" timestamp with time zone DEFAULT "now"(), "p_timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text", "p_grace_days" integer DEFAULT 3) RETURNS TABLE("athlete_id" "uuid", "state" "text", "last_paid_at" timestamp with time zone, "expires_at" timestamp with time zone, "days_late" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."admin_billing_status"("p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."plan_schedule_slot_coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_schedule_slot_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "weekly_schedule_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pssc_time_order" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."plan_schedule_slot_coaches" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_coach_to_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") RETURNS "public"."plan_schedule_slot_coaches"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."assign_coach_to_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."athlete_debt_state"("p_athlete_id" "uuid", "p_now" timestamp with time zone DEFAULT "now"(), "p_timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text", "p_grace_days" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."athlete_debt_state"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."athlete_id_for_user"("uid" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select a.id from athletes a
  join profiles p on p.id = a.profile_id
  where p.id = uid;
$$;


ALTER FUNCTION "public"."athlete_id_for_user"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."coach_id_for_user"("uid" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select c.id from coaches c
  join profiles p on p.id = c.profile_id
  where p.id = uid;
$$;


ALTER FUNCTION "public"."coach_id_for_user"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."coach_planned_hours"("p_start" "date", "p_end" "date", "p_grain" "text" DEFAULT 'week'::"text", "p_coach_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("coach_id" "uuid", "period_start" "date", "total_minutes" integer, "total_hours" numeric, "slot_occurrences" integer, "distinct_slots" integer)
    LANGUAGE "plpgsql" STABLE
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


ALTER FUNCTION "public"."coach_planned_hours"("p_start" "date", "p_end" "date", "p_grain" "text", "p_coach_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athletes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "phone" "text",
    "join_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "membership_type" "text",
    "coach_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dni" "text",
    "birth_date" "date",
    "gender" "text",
    "address" "text",
    "city" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "medical_conditions" "text",
    "plan_id" "uuid" NOT NULL,
    "visits_per_week" integer,
    "plan_tier_price" numeric,
    "plan_option" "text"
);


ALTER TABLE "public"."athletes" OWNER TO "postgres";


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

  -- Saldo mensual de accesos
  insert into public.athlete_monthly_counters(athlete_id, period_start, period_end, allowed_sessions, consumed_sessions)
  values (v_athlete.id, v_join_date, v_join_date + 29, v_monthly_accesses, 0)
  on conflict (athlete_id, period_start, period_end) do nothing;

  -- Primer pago (arranca el ciclo de 30 días). Monto = explícito o tier o precio del plan.
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


CREATE OR REPLACE FUNCTION "public"."current_coach_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select c.id
  from public.coaches c
  where c.profile_id = public.current_profile_id()
  limit 1
$$;


ALTER FUNCTION "public"."current_coach_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_profile_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select p.id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."current_profile_id"() OWNER TO "postgres";


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
$$;


ALTER FUNCTION "public"."generate_monthly_invoices"("p_now" timestamp with time zone, "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_profile"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'athlete_id', a.id,
    'full_name', p.full_name,
    'email', p.email,                 -- read-only (identidad/login)
    'dni', a.dni,                      -- read-only
    'phone', a.phone,
    'birth_date', a.birth_date,
    'gender', a.gender,
    'address', a.address,
    'city', a.city,
    'emergency_contact_name', a.emergency_contact_name,
    'emergency_contact_phone', a.emergency_contact_phone,
    'medical_conditions', a.medical_conditions,
    'plan_name', pl.name,             -- read-only
    'visits_per_week', a.visits_per_week
  )
  into v
  from public.athletes a
  join public.profiles p on p.id = a.profile_id
  left join public.plans pl on pl.id = a.plan_id
  where a.profile_id = auth.uid()
  limit 1;

  return coalesce(v, jsonb_build_object('athlete_id', null));
end;
$$;


ALTER FUNCTION "public"."get_my_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_slot_options"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_athlete_id uuid;
  v_plan_id uuid;
  v_visits int;
  v_result jsonb;
begin
  select a.id, a.plan_id, a.visits_per_week
    into v_athlete_id, v_plan_id, v_visits
  from public.athletes a
  where a.profile_id = auth.uid()
  limit 1;

  if v_athlete_id is null then
    return jsonb_build_object('athlete_id', null);
  end if;

  select jsonb_build_object(
    'athlete_id', v_athlete_id,
    'plan_id', v_plan_id,
    'visits_per_week', v_visits,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekly_schedule_id', ws.id,
        'day_of_week', ws.day_of_week,
        'start_time', ws.start_time,
        'end_time', ws.end_time,
        'selected', exists(
          select 1 from public.athlete_slot_assignments asa
          where asa.athlete_id = v_athlete_id
            and asa.weekly_schedule_id = ws.id
            and asa.is_active = true
        )
      ) order by ws.day_of_week, ws.start_time)
      from public.plan_schedule_slots pss
      join public.weekly_schedule ws on ws.id = pss.weekly_schedule_id
      where pss.plan_id = v_plan_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_my_slot_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_athlete"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from profiles
    where id = uid and role = 'atleta'
  );
$$;


ALTER FUNCTION "public"."is_athlete"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from profiles
    where id = uid and role = 'profesor'
  );
$$;


ALTER FUNCTION "public"."is_coach"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach_of_athlete"("_user_uid" "uuid", "_athlete_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM athletes a
    JOIN coaches c ON a.coach_id = c.id
    WHERE a.id = _athlete_uuid
    AND c.profile_id = _user_uid
  );
$$;


ALTER FUNCTION "public"."is_coach_of_athlete"("_user_uid" "uuid", "_athlete_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'profesor')
  );
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


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
        'remaining', null, 'period_start', null, 'period_end', null, 'expires_at', null,
        'days_late', null, 'grace_days', p_grace_days, 'plan_name', null,
        'actor_type', v_actor_type, 'weekly_schedule_id', null, 'local_date', v_local_date
      );

      return jsonb_build_object(
        'allowed', false, 'reason_code', v_reason_code, 'message', v_message,
        'weekly_schedule_id', null, 'remaining', null, 'actor_type', v_actor_type,
        'athlete_id', null, 'coach_id', null, 'full_name', v_full_name, 'athlete_name', null,
        'plan_name', null, 'avatar_url', null, 'ui_status', 'DENIED', 'ui_color', 'red', 'details', v_details
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

  v_reason_code := case when v_is_grace then 'OK_GRACE' when v_last_paid_at is null then 'OK_PENDING' else 'OK' end;
  v_ui_status := case when (v_is_grace or v_last_paid_at is null) then 'WARNING' else 'SUCCESS' end;
  v_ui_color := case when (v_is_grace or v_last_paid_at is null) then 'amber' else 'green' end;
  v_message := '¡Bienvenido, ' || coalesce(v_athlete_name, v_full_name, 'Atleta') || '! Te quedan ' || v_remaining || ' accesos.';
  if v_local_time > v_slot_start then
    v_message := v_message || ' (La clase comenzó a las ' || to_char(v_slot_start, 'HH24:MI') || '.)';
  end if;
  if v_is_grace then
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
    'details', jsonb_build_object('local_date', v_local_date, 'grace_days', p_grace_days, 'actor_type', v_actor_type, 'plan_name', v_plan_name, 'remaining', v_remaining, 'period_start', v_period_start, 'period_end', v_period_end, 'expires_at', v_expiration, 'days_late', v_days_late, 'weekly_schedule_id', v_weekly_schedule_id, 'capacity', v_capacity, 'occupied', v_occupied + 1));
end;

$$;


ALTER FUNCTION "public"."kiosk_check_in"("p_dni" "text", "p_phone" "text", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer, "p_autocreate_counter" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."kiosk_check_in"("p_dni" "text", "p_phone" "text", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer, "p_autocreate_counter" boolean) IS 'Atomic kiosk check-in RPC with profiles-based identity; coach validation uses plan_schedule_slot_coaches via plan_schedule_slots.';



CREATE OR REPLACE FUNCTION "public"."kiosk_remaining"("p_athlete_id" "uuid", "p_now" timestamp with time zone DEFAULT "now"(), "p_timezone" "text" DEFAULT 'America/Argentina/Buenos_Aires'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_date date := (p_now at time zone p_timezone)::date;
  v_allowed int;
  v_consumed int;
  v_period_start date;
  v_period_end date;
begin
  -- Autorización: staff (admin/profesor) o el propio atleta
  if not (
    public.is_staff()
    or exists (select 1 from public.athletes a where a.id = p_athlete_id and a.profile_id = auth.uid())
  ) then
    raise exception 'No autorizado para consultar el saldo de este atleta.' using errcode = '42501';
  end if;

  select amc.allowed_sessions, amc.consumed_sessions, amc.period_start, amc.period_end
  into v_allowed, v_consumed, v_period_start, v_period_end
  from public.athlete_monthly_counters amc
  where amc.athlete_id = p_athlete_id
    and amc.period_start <= v_local_date
    and amc.period_end >= v_local_date
  order by amc.period_start desc
  limit 1;

  if v_allowed is null then
    return jsonb_build_object(
      'remaining', null, 'allowed', null, 'consumed', null,
      'period_start', null, 'period_end', null
    );
  end if;

  return jsonb_build_object(
    'remaining', greatest(v_allowed - v_consumed, 0),
    'allowed', v_allowed,
    'consumed', v_consumed,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
end;
$$;


ALTER FUNCTION "public"."kiosk_remaining"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."only_digits"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT nullif(regexp_replace(coalesce(p_text,''), '\D', '', 'g'), '');
$$;


ALTER FUNCTION "public"."only_digits"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_grid_availability"("p_plan_id" "uuid") RETURNS TABLE("weekly_schedule_id" "uuid", "day_of_week" integer, "start_time" time without time zone, "end_time" time without time zone, "capacity" integer, "plan_assignments_count" integer, "total_active_assignments_count" integer, "remaining_total" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."plan_grid_availability"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_slot_availability"("p_plan_id" "uuid") RETURNS TABLE("weekly_schedule_id" "uuid", "day_of_week" integer, "start_time" time without time zone, "end_time" time without time zone, "capacity" integer, "active_assignments_count" integer, "remaining" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."plan_slot_availability"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_workout_result_athlete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."populate_workout_result_athlete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_public_list"() RETURNS TABLE("id" "uuid", "full_name" "text", "avatar_url" "text", "role" "public"."user_role")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."profiles_public_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pssc_resolve_timeslot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."pssc_resolve_timeslot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_athlete_slots_atomic"("p_athlete_id" "uuid", "p_plan_id" "uuid", "p_visits_per_week" integer, "p_selected_weekly_schedule_ids" "uuid"[], "p_effective_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_selected uuid[] := array(select distinct unnest(coalesce(p_selected_weekly_schedule_ids, '{}')));
  v_count int := coalesce(array_length(v_selected, 1), 0);
  v_current uuid[];
  v_slot uuid;
  v_remaining int;
begin
  if not public.is_admin(auth.uid()) then
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


ALTER FUNCTION "public"."reassign_athlete_slots_atomic"("p_athlete_id" "uuid", "p_plan_id" "uuid", "p_visits_per_week" integer, "p_selected_weekly_schedule_ids" "uuid"[], "p_effective_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_plan_configuration"("p_plan_id" "uuid" DEFAULT NULL::"uuid", "p_name" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_price" numeric DEFAULT 0, "p_capacity" integer DEFAULT 0, "p_status" "text" DEFAULT 'active'::"text", "p_session_duration_min" integer DEFAULT 60, "p_features" "jsonb" DEFAULT '[]'::"jsonb", "p_coach_ids" "jsonb" DEFAULT '[]'::"jsonb", "p_legacy_schedule" "jsonb" DEFAULT '[]'::"jsonb", "p_pricing_tiers" "jsonb" DEFAULT '[]'::"jsonb", "p_availability_windows" "jsonb" DEFAULT '[]'::"jsonb", "p_schedule_slots" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_plan_id uuid;
  v_slot jsonb;
  v_slot_id uuid;
  v_desired_slot_ids uuid[] := '{}';
  v_blocked_count integer;
begin
  if not public.is_admin(auth.uid()) then
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


ALTER FUNCTION "public"."save_plan_configuration"("p_plan_id" "uuid", "p_name" "text", "p_description" "text", "p_price" numeric, "p_capacity" integer, "p_status" "text", "p_session_duration_min" integer, "p_features" "jsonb", "p_coach_ids" "jsonb", "p_legacy_schedule" "jsonb", "p_pricing_tiers" "jsonb", "p_availability_windows" "jsonb", "p_schedule_slots" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_my_slot_preferences"("p_weekly_schedule_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_athlete_id uuid;
  v_plan_id uuid;
  v_visits int;
  v_today date := current_date;
  v_count int := coalesce(array_length(p_weekly_schedule_ids, 1), 0);
  v_valid int;
begin
  select a.id, a.plan_id, a.visits_per_week
    into v_athlete_id, v_plan_id, v_visits
  from public.athletes a
  where a.profile_id = auth.uid()
  limit 1;

  if v_athlete_id is null then
    raise exception 'No se encontró un atleta para el usuario actual' using errcode = '42501';
  end if;

  -- Tope: no más turnos que sus visitas/semana
  if v_visits is not null and v_count > v_visits then
    raise exception 'No podés elegir más de % turnos según tu plan.', v_visits;
  end if;

  -- Los turnos deben pertenecer al plan del atleta
  if v_count > 0 then
    select count(*) into v_valid
    from public.plan_schedule_slots pss
    where pss.plan_id = v_plan_id
      and pss.weekly_schedule_id = any(p_weekly_schedule_ids);
    if v_valid <> v_count then
      raise exception 'Alguno de los turnos elegidos no pertenece a tu plan.';
    end if;
  end if;

  -- Desactivar preferencia actual
  update public.athlete_slot_assignments
     set is_active = false, ends_on = v_today, updated_at = now()
   where athlete_id = v_athlete_id and is_active = true;

  -- Insertar la nueva preferencia
  if v_count > 0 then
    insert into public.athlete_slot_assignments(athlete_id, weekly_schedule_id, starts_on, is_active)
    select v_athlete_id, wsid, v_today, true
    from unnest(p_weekly_schedule_ids) as wsid;
  end if;
end;
$$;


ALTER FUNCTION "public"."set_my_slot_preferences"("p_weekly_schedule_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profiles_identity_normalized"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.dni_normalized := public.only_digits(new.dni);
  new.phone_normalized := public.only_digits(new.phone);
  return new;
end;
$$;


ALTER FUNCTION "public"."set_profiles_identity_normalized"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unassign_coach_from_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."unassign_coach_from_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_profile"("p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_athlete_id uuid;
  v_full_name text := nullif(trim(p_payload->>'full_name'), '');
begin
  select a.id into v_athlete_id
  from public.athletes a
  where a.profile_id = auth.uid()
  limit 1;

  if v_athlete_id is null then
    raise exception 'No se encontró un atleta para el usuario actual' using errcode = '42501';
  end if;

  -- Nombre en el profile (si vino)
  if v_full_name is not null then
    update public.profiles set full_name = v_full_name where id = auth.uid();
  end if;

  -- Datos personales en el athlete (solo campos permitidos)
  update public.athletes set
    phone                   = nullif(p_payload->>'phone', ''),
    birth_date              = nullif(p_payload->>'birth_date', '')::date,
    gender                  = nullif(p_payload->>'gender', ''),
    address                 = nullif(p_payload->>'address', ''),
    city                    = nullif(p_payload->>'city', ''),
    emergency_contact_name  = nullif(p_payload->>'emergency_contact_name', ''),
    emergency_contact_phone = nullif(p_payload->>'emergency_contact_phone', ''),
    medical_conditions      = nullif(p_payload->>'medical_conditions', '')
  where id = v_athlete_id;
end;
$$;


ALTER FUNCTION "public"."update_my_profile"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment"("p_id" "uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_base_amount" numeric DEFAULT NULL::numeric, "p_method" "text" DEFAULT NULL::"text", "p_concept" "text" DEFAULT NULL::"text", "p_payment_date" "date" DEFAULT NULL::"date", "p_discount_value" numeric DEFAULT NULL::numeric, "p_discount_type" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."update_payment"("p_id" "uuid", "p_amount" numeric, "p_base_amount" numeric, "p_method" "text", "p_concept" "text", "p_payment_date" "date", "p_discount_value" numeric, "p_discount_type" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_payment"("p_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."void_payment"("p_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "check_in_time" timestamp with time zone DEFAULT "now"(),
    "access_granted" boolean DEFAULT true,
    "rejection_reason" "text",
    "weekly_schedule_id" "uuid",
    "reason_code" "text",
    "remaining_sessions" integer,
    "idempotency_key" "text",
    "local_checkin_date" "date",
    "coach_id" "uuid"
);


ALTER TABLE "public"."access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_monthly_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "allowed_sessions" integer NOT NULL,
    "consumed_sessions" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "athlete_monthly_counters_consumed_chk" CHECK (("consumed_sessions" <= "allowed_sessions")),
    CONSTRAINT "athlete_monthly_counters_period_chk" CHECK (("period_end" >= "period_start"))
);


ALTER TABLE "public"."athlete_monthly_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_routines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "routine_id" "uuid",
    "start_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text"
);


ALTER TABLE "public"."athlete_routines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_slot_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "weekly_schedule_id" "uuid" NOT NULL,
    "starts_on" "date" NOT NULL,
    "ends_on" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "assigned_reason_code" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "athlete_slot_assignments_dates_chk" CHECK ((("ends_on" IS NULL) OR ("ends_on" >= "starts_on")))
);


ALTER TABLE "public"."athlete_slot_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "session_id" "uuid",
    "attendance_date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "date" "date" GENERATED ALWAYS AS ("attendance_date") STORED
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3b82f6'::"text"
);


ALTER TABLE "public"."class_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_athlete_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."coach_athlete_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "specialization" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "bio" "text" DEFAULT 'Entrenador del Staff'::"text",
    "phone" "text"
);


ALTER TABLE "public"."coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_wods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "class_type_id" "uuid",
    "title" "text",
    "description" "text",
    "coach_notes" "text"
);


ALTER TABLE "public"."daily_wods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "plan_id" "uuid",
    "enrollment_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text"
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "muscle_group" "text",
    "unit" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "primary_muscle" "text",
    "secondary_muscles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "equipment" "text",
    "category" "text" DEFAULT 'strength'::"text" NOT NULL,
    "tracking_type" "text" DEFAULT 'reps_weight'::"text" NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "instructions" "text",
    "image_url" "text",
    "video_url" "text",
    "source" "text" DEFAULT 'catalog'::"text" NOT NULL,
    "is_custom" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kiosk_reason_codes" (
    "code" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."kiosk_reason_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text",
    "metric_date" "date" NOT NULL,
    "trend" "text"
);


ALTER TABLE "public"."performance_metrics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."metrics" AS
 SELECT "id",
    "athlete_id",
    "name",
    "value",
    "unit",
    "metric_date" AS "date",
    "trend"
   FROM "public"."performance_metrics";


ALTER VIEW "public"."metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metrics_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "category" "text" DEFAULT 'General'::"text",
    "is_global" boolean DEFAULT false,
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."metrics_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "coach_id" "uuid",
    "content" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE,
    "type" "text" DEFAULT 'general'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "reason" "text",
    "old_row" "jsonb",
    "new_row" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_audit_action_check" CHECK (("action" = ANY (ARRAY['update'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."payment_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "payment_date" "date" NOT NULL,
    "amount" numeric NOT NULL,
    "status" "text" NOT NULL,
    "method" "text",
    "concept" "text",
    "date" "date" GENERATED ALWAYS AS ("payment_date") STORED,
    "base_amount" numeric,
    "discount_value" numeric DEFAULT 0,
    "discount_type" "text",
    "period" "date",
    CONSTRAINT "payments_amount_nonneg" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_status_valid" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payments"."date" IS 'Deprecado: usar siempre payment_date';



COMMENT ON COLUMN "public"."payments"."period" IS 'Periodo de la cuota mensual generada (primer dia del mes). NULL para pagos manuales/inscripcion. Unicidad por (athlete_id, period).';



CREATE TABLE IF NOT EXISTS "public"."plan_availability_windows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "day_of_week" integer,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "capacity" integer DEFAULT 0
);


ALTER TABLE "public"."plan_availability_windows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "coach_id" "uuid"
);


ALTER TABLE "public"."plan_coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "feature" "text" NOT NULL
);


ALTER TABLE "public"."plan_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_pricing_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "visits_per_week" integer NOT NULL,
    "price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "plan_pricing_tiers_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "plan_pricing_tiers_visits_per_week_check" CHECK (("visits_per_week" > 0))
);


ALTER TABLE "public"."plan_pricing_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "day" "text" NOT NULL,
    "time" "text" NOT NULL
);


ALTER TABLE "public"."plan_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_schedule_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "weekly_schedule_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "class_type_id" "uuid",
    "activity_detail" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_schedule_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric,
    "capacity" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "access_limit" integer,
    "session_duration_min" integer DEFAULT 60 NOT NULL
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "role" "public"."user_role" DEFAULT 'atleta'::"public"."user_role" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dni" "text",
    "dni_normalized" "text",
    "phone" "text",
    "phone_normalized" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_public" AS
 SELECT "id",
    "full_name",
    "avatar_url",
    "role"
   FROM "public"."profiles_public_list"() "profiles_public_list"("id", "full_name", "avatar_url", "role");


ALTER VIEW "public"."profiles_public" OWNER TO "postgres";


COMMENT ON VIEW "public"."profiles_public" IS 'Safe people listing view without PII. Uses profiles_public_list() scoping by caller role.';



CREATE TABLE IF NOT EXISTS "public"."routine_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "routine_id" "uuid",
    "exercise_id" "uuid",
    "order_index" integer,
    "prescribed_sets" integer,
    "prescribed_reps" integer,
    "prescribed_load" numeric,
    "prescribed_time_sec" integer,
    "notes" "text"
);


ALTER TABLE "public"."routine_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sport" "text" NOT NULL,
    "target_level" "text",
    "goal" "text",
    "coach_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."routines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "coach_id" "uuid"
);


ALTER TABLE "public"."schedule_coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "athlete_id" "uuid"
);


ALTER TABLE "public"."session_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "session_date" "date" NOT NULL,
    "time" "text",
    "coach_id" "uuid",
    "type" "text",
    "location" "text",
    "status" "text" DEFAULT 'scheduled'::"text",
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_type_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "capacity" integer DEFAULT 20
);


ALTER TABLE "public"."weekly_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "exercise_id" "uuid",
    "sets_done" integer,
    "reps_done" integer,
    "load_done" numeric,
    "time_sec" integer,
    "rpe" numeric,
    "notes" "text",
    "athlete_id" "uuid",
    "set_index" integer DEFAULT 1 NOT NULL,
    "distance_m" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workout_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "routine_id" "uuid",
    "session_date" "date" NOT NULL,
    "coach_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL
);


ALTER TABLE "public"."workout_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_monthly_counters"
    ADD CONSTRAINT "athlete_monthly_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_monthly_counters"
    ADD CONSTRAINT "athlete_monthly_counters_unique_period" UNIQUE ("athlete_id", "period_start", "period_end");



ALTER TABLE ONLY "public"."athlete_routines"
    ADD CONSTRAINT "athlete_routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_slot_assignments"
    ADD CONSTRAINT "athlete_slot_assignments_no_overlap_per_slot_excl" EXCLUDE USING "gist" ("athlete_id" WITH =, "weekly_schedule_id" WITH =, "daterange"("starts_on", COALESCE("ends_on", 'infinity'::"date"), '[]'::"text") WITH &&) WHERE ("is_active");



ALTER TABLE ONLY "public"."athlete_slot_assignments"
    ADD CONSTRAINT "athlete_slot_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_dni_key" UNIQUE ("dni");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_dni_unique" UNIQUE ("dni");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_types"
    ADD CONSTRAINT "class_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_athlete_follows"
    ADD CONSTRAINT "coach_athlete_follows_coach_id_athlete_id_key" UNIQUE ("coach_id", "athlete_id");



ALTER TABLE ONLY "public"."coach_athlete_follows"
    ADD CONSTRAINT "coach_athlete_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."daily_wods"
    ADD CONSTRAINT "daily_wods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."exercises"
    ADD CONSTRAINT "exercises_category_check" CHECK (("category" = ANY (ARRAY['strength'::"text", 'cardio'::"text", 'mobility'::"text", 'stretching'::"text", 'skill'::"text", 'other'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."exercises"
    ADD CONSTRAINT "exercises_tracking_type_check" CHECK (("tracking_type" = ANY (ARRAY['reps_weight'::"text", 'reps'::"text", 'time'::"text", 'distance'::"text", 'time_distance'::"text", 'bodyweight'::"text", 'assisted_bodyweight'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."kiosk_reason_codes"
    ADD CONSTRAINT "kiosk_reason_codes_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."metrics_catalog"
    ADD CONSTRAINT "metrics_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_audit"
    ADD CONSTRAINT "payment_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_availability_windows"
    ADD CONSTRAINT "plan_availability_windows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_coaches"
    ADD CONSTRAINT "plan_coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_pricing_tiers"
    ADD CONSTRAINT "plan_pricing_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_pricing_tiers"
    ADD CONSTRAINT "plan_pricing_tiers_plan_id_visits_per_week_key" UNIQUE ("plan_id", "visits_per_week");



ALTER TABLE ONLY "public"."plan_schedule"
    ADD CONSTRAINT "plan_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_schedule_slot_coaches"
    ADD CONSTRAINT "plan_schedule_slot_coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_schedule_slots"
    ADD CONSTRAINT "plan_schedule_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_schedule_slots"
    ADD CONSTRAINT "plan_schedule_slots_plan_id_weekly_schedule_id_key" UNIQUE ("plan_id", "weekly_schedule_id");



ALTER TABLE ONLY "public"."plan_schedule_slots"
    ADD CONSTRAINT "plan_schedule_slots_plan_weekly_unique" UNIQUE ("plan_id", "weekly_schedule_id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_schedule_slot_coaches"
    ADD CONSTRAINT "pssc_unique_coach_same_timeslot" UNIQUE ("coach_id", "day_of_week", "start_time", "end_time");



ALTER TABLE ONLY "public"."plan_schedule_slot_coaches"
    ADD CONSTRAINT "pssc_unique_plan_slot_coach" UNIQUE ("plan_schedule_slot_id", "coach_id");



ALTER TABLE ONLY "public"."routine_exercises"
    ADD CONSTRAINT "routine_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_coaches"
    ADD CONSTRAINT "schedule_coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_attendees"
    ADD CONSTRAINT "session_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_results"
    ADD CONSTRAINT "workout_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_access_logs_athlete_time" ON "public"."access_logs" USING "btree" ("athlete_id", "check_in_time");



CREATE INDEX "idx_access_logs_coach_id" ON "public"."access_logs" USING "btree" ("coach_id");



CREATE INDEX "idx_access_logs_local_checkin_date" ON "public"."access_logs" USING "btree" ("local_checkin_date");



CREATE INDEX "idx_access_logs_reason_code" ON "public"."access_logs" USING "btree" ("reason_code");



CREATE INDEX "idx_access_logs_weekly_schedule_id" ON "public"."access_logs" USING "btree" ("weekly_schedule_id");



CREATE INDEX "idx_athlete_monthly_counters_athlete_id" ON "public"."athlete_monthly_counters" USING "btree" ("athlete_id");



CREATE INDEX "idx_athlete_monthly_counters_period" ON "public"."athlete_monthly_counters" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_athlete_slot_assignments_athlete_id" ON "public"."athlete_slot_assignments" USING "btree" ("athlete_id");



CREATE INDEX "idx_athlete_slot_assignments_schedule_id" ON "public"."athlete_slot_assignments" USING "btree" ("weekly_schedule_id");



CREATE INDEX "idx_athletes_coach" ON "public"."athletes" USING "btree" ("coach_id");



CREATE INDEX "idx_athletes_dni" ON "public"."athletes" USING "btree" ("dni");



CREATE INDEX "idx_attendance_athlete" ON "public"."attendance" USING "btree" ("athlete_id");



CREATE INDEX "idx_caf_athlete" ON "public"."coach_athlete_follows" USING "btree" ("athlete_id");



CREATE INDEX "idx_caf_coach" ON "public"."coach_athlete_follows" USING "btree" ("coach_id");



CREATE INDEX "idx_enrollments_athlete" ON "public"."enrollments" USING "btree" ("athlete_id");



CREATE INDEX "idx_exercises_category" ON "public"."exercises" USING "btree" ("category");



CREATE INDEX "idx_exercises_equipment" ON "public"."exercises" USING "btree" ("equipment");



CREATE INDEX "idx_exercises_primary_muscle" ON "public"."exercises" USING "btree" ("primary_muscle");



CREATE INDEX "idx_kiosk_reason_codes_active" ON "public"."kiosk_reason_codes" USING "btree" ("is_active");



CREATE INDEX "idx_metrics_athlete" ON "public"."performance_metrics" USING "btree" ("athlete_id");



CREATE INDEX "idx_payments_athlete" ON "public"."payments" USING "btree" ("athlete_id");



CREATE INDEX "idx_plan_availability_windows_day_time" ON "public"."plan_availability_windows" USING "btree" ("day_of_week", "start_time", "end_time");



CREATE INDEX "idx_plan_availability_windows_plan_id" ON "public"."plan_availability_windows" USING "btree" ("plan_id");



CREATE INDEX "idx_plan_pricing_tiers_plan_id" ON "public"."plan_pricing_tiers" USING "btree" ("plan_id");



CREATE INDEX "idx_plan_pricing_tiers_visits" ON "public"."plan_pricing_tiers" USING "btree" ("visits_per_week");



CREATE INDEX "idx_plan_schedule_slots_plan_id" ON "public"."plan_schedule_slots" USING "btree" ("plan_id");



CREATE INDEX "idx_plan_schedule_slots_schedule_id" ON "public"."plan_schedule_slots" USING "btree" ("weekly_schedule_id");



CREATE INDEX "idx_pssc_coach_id" ON "public"."plan_schedule_slot_coaches" USING "btree" ("coach_id");



CREATE INDEX "idx_pssc_plan_slot" ON "public"."plan_schedule_slot_coaches" USING "btree" ("plan_schedule_slot_id");



CREATE INDEX "idx_pssc_weekly_schedule" ON "public"."plan_schedule_slot_coaches" USING "btree" ("weekly_schedule_id");



CREATE INDEX "idx_routines_coach" ON "public"."routines" USING "btree" ("coach_id");



CREATE INDEX "idx_sessions_coach" ON "public"."sessions" USING "btree" ("coach_id");



CREATE INDEX "idx_weekly_schedule_day_time" ON "public"."weekly_schedule" USING "btree" ("day_of_week", "start_time", "end_time");



CREATE INDEX "idx_workout_results_athlete_exercise" ON "public"."workout_results" USING "btree" ("athlete_id", "exercise_id", "created_at" DESC);



CREATE INDEX "idx_workout_results_session" ON "public"."workout_results" USING "btree" ("session_id");



CREATE INDEX "idx_workout_sessions_athlete" ON "public"."workout_sessions" USING "btree" ("athlete_id");



CREATE INDEX "payment_audit_payment_idx" ON "public"."payment_audit" USING "btree" ("payment_id");



CREATE UNIQUE INDEX "payments_athlete_period_uidx" ON "public"."payments" USING "btree" ("athlete_id", "period") WHERE ("period" IS NOT NULL);



CREATE UNIQUE INDEX "uq_access_logs_granted_athlete_slot_local_date" ON "public"."access_logs" USING "btree" ("athlete_id", "weekly_schedule_id", "local_checkin_date") WHERE (("access_granted" IS TRUE) AND ("athlete_id" IS NOT NULL) AND ("weekly_schedule_id" IS NOT NULL) AND ("local_checkin_date" IS NOT NULL));



CREATE UNIQUE INDEX "uq_access_logs_idempotency_coach" ON "public"."access_logs" USING "btree" ("idempotency_key") WHERE ("coach_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_athlete_monthly_counters_period" ON "public"."athlete_monthly_counters" USING "btree" ("athlete_id", "period_start", "period_end");



CREATE UNIQUE INDEX "uq_exercises_name_ci" ON "public"."exercises" USING "btree" ("lower"(TRIM(BOTH FROM "name")));



CREATE UNIQUE INDEX "uq_exercises_slug" ON "public"."exercises" USING "btree" ("slug");



CREATE UNIQUE INDEX "uq_profiles_dni_normalized" ON "public"."profiles" USING "btree" ("dni_normalized") WHERE ("dni_normalized" IS NOT NULL);



CREATE UNIQUE INDEX "uq_profiles_phone_normalized" ON "public"."profiles" USING "btree" ("phone_normalized") WHERE ("phone_normalized" IS NOT NULL);



CREATE UNIQUE INDEX "uq_schedule_coaches_schedule_coach" ON "public"."schedule_coaches" USING "btree" ("schedule_id", "coach_id");



CREATE UNIQUE INDEX "uq_weekly_schedule_natural_slot" ON "public"."weekly_schedule" USING "btree" ("day_of_week", "start_time", "end_time", "capacity") WHERE (("day_of_week" IS NOT NULL) AND ("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL));



CREATE OR REPLACE TRIGGER "set_workout_result_athlete" BEFORE INSERT ON "public"."workout_results" FOR EACH ROW EXECUTE FUNCTION "public"."populate_workout_result_athlete"();



CREATE OR REPLACE TRIGGER "trg_athlete_monthly_counters_set_updated_at" BEFORE UPDATE ON "public"."athlete_monthly_counters" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_athlete_slot_assignments_set_updated_at" BEFORE UPDATE ON "public"."athlete_slot_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_kiosk_reason_codes_set_updated_at" BEFORE UPDATE ON "public"."kiosk_reason_codes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plan_pricing_tiers_set_updated_at" BEFORE UPDATE ON "public"."plan_pricing_tiers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plan_schedule_slots_touch_updated_at" BEFORE UPDATE ON "public"."plan_schedule_slots" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_identity_normalized" BEFORE INSERT OR UPDATE OF "dni", "phone" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_identity_normalized"();



CREATE OR REPLACE TRIGGER "trg_pssc_resolve_timeslot" BEFORE INSERT OR UPDATE OF "plan_schedule_slot_id", "coach_id" ON "public"."plan_schedule_slot_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."pssc_resolve_timeslot"();



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_reason_code_fk" FOREIGN KEY ("reason_code") REFERENCES "public"."kiosk_reason_codes"("code");



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_weekly_schedule_id_fk" FOREIGN KEY ("weekly_schedule_id") REFERENCES "public"."weekly_schedule"("id");



ALTER TABLE ONLY "public"."athlete_monthly_counters"
    ADD CONSTRAINT "athlete_monthly_counters_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."athlete_routines"
    ADD CONSTRAINT "athlete_routines_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_routines"
    ADD CONSTRAINT "athlete_routines_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_slot_assignments"
    ADD CONSTRAINT "athlete_slot_assignments_assigned_reason_code_fk" FOREIGN KEY ("assigned_reason_code") REFERENCES "public"."kiosk_reason_codes"("code");



ALTER TABLE ONLY "public"."athlete_slot_assignments"
    ADD CONSTRAINT "athlete_slot_assignments_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."athlete_slot_assignments"
    ADD CONSTRAINT "athlete_slot_assignments_weekly_schedule_fk" FOREIGN KEY ("weekly_schedule_id") REFERENCES "public"."weekly_schedule"("id");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_athlete_follows"
    ADD CONSTRAINT "coach_athlete_follows_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_athlete_follows"
    ADD CONSTRAINT "coach_athlete_follows_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_wods"
    ADD CONSTRAINT "daily_wods_class_type_id_fkey" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "fk_athletes_profile" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "fk_coaches_profile" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metrics_catalog"
    ADD CONSTRAINT "metrics_catalog_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."payment_audit"
    ADD CONSTRAINT "payment_audit_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_metrics"
    ADD CONSTRAINT "performance_metrics_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_coaches"
    ADD CONSTRAINT "plan_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_coaches"
    ADD CONSTRAINT "plan_coaches_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_pricing_tiers"
    ADD CONSTRAINT "plan_pricing_tiers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_schedule"
    ADD CONSTRAINT "plan_schedule_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_schedule_slot_coaches"
    ADD CONSTRAINT "plan_schedule_slot_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_schedule_slot_coaches"
    ADD CONSTRAINT "plan_schedule_slot_coaches_plan_schedule_slot_id_fkey" FOREIGN KEY ("plan_schedule_slot_id") REFERENCES "public"."plan_schedule_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_schedule_slot_coaches"
    ADD CONSTRAINT "plan_schedule_slot_coaches_weekly_schedule_id_fkey" FOREIGN KEY ("weekly_schedule_id") REFERENCES "public"."weekly_schedule"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_schedule_slots"
    ADD CONSTRAINT "plan_schedule_slots_class_type_id_fkey" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id");



ALTER TABLE ONLY "public"."plan_schedule_slots"
    ADD CONSTRAINT "plan_schedule_slots_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_schedule_slots"
    ADD CONSTRAINT "plan_schedule_slots_weekly_schedule_id_fkey" FOREIGN KEY ("weekly_schedule_id") REFERENCES "public"."weekly_schedule"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routine_exercises"
    ADD CONSTRAINT "routine_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."routine_exercises"
    ADD CONSTRAINT "routine_exercises_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."schedule_coaches"
    ADD CONSTRAINT "schedule_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_coaches"
    ADD CONSTRAINT "schedule_coaches_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."weekly_schedule"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_attendees"
    ADD CONSTRAINT "session_attendees_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_attendees"
    ADD CONSTRAINT "session_attendees_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_class_type_id_fkey" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id");



ALTER TABLE ONLY "public"."workout_results"
    ADD CONSTRAINT "workout_results_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."workout_results"
    ADD CONSTRAINT "workout_results_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."workout_results"
    ADD CONSTRAINT "workout_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE SET NULL;



CREATE POLICY "Atletas cargan sus propias metricas reales" ON "public"."performance_metrics" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "athletes"."profile_id"
   FROM "public"."athletes"
  WHERE ("athletes"."id" = "performance_metrics"."athlete_id"))));



CREATE POLICY "Atletas ven sus propias metricas reales" ON "public"."performance_metrics" FOR SELECT USING (("auth"."uid"() IN ( SELECT "athletes"."profile_id"
   FROM "public"."athletes"
  WHERE ("athletes"."id" = "performance_metrics"."athlete_id"))));



CREATE POLICY "Crear métricas propias" ON "public"."metrics_catalog" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Ver catálogo híbrido" ON "public"."metrics_catalog" FOR SELECT USING ((("is_global" = true) OR ("owner_id" = "auth"."uid"())));



ALTER TABLE "public"."access_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "access_logs_delete_staff" ON "public"."access_logs" FOR DELETE TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "access_logs_insert_authenticated_controlled" ON "public"."access_logs" FOR INSERT TO "authenticated" WITH CHECK (((COALESCE("access_granted", false) = false) OR "public"."is_staff"()));



CREATE POLICY "access_logs_select_staff" ON "public"."access_logs" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "access_logs_update_staff" ON "public"."access_logs" FOR UPDATE TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "admin full access athlete_routines" ON "public"."athlete_routines" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access athletes" ON "public"."athletes" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access attendance" ON "public"."attendance" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access coach_athlete_follows" ON "public"."coach_athlete_follows" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access coaches" ON "public"."coaches" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access enrollments" ON "public"."enrollments" TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role"));



CREATE POLICY "admin full access exercises" ON "public"."exercises" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access notes" ON "public"."notes" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access payments" ON "public"."payments" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access performance_metrics" ON "public"."performance_metrics" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access plan_coaches" ON "public"."plan_coaches" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access plan_features" ON "public"."plan_features" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access plan_schedule" ON "public"."plan_schedule" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access plans" ON "public"."plans" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access profiles" ON "public"."profiles" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access routine_exercises" ON "public"."routine_exercises" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access routines" ON "public"."routines" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access session_attendees" ON "public"."session_attendees" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access sessions" ON "public"."sessions" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access workout_results" ON "public"."workout_results" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin full access workout_sessions" ON "public"."workout_sessions" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin read payment_audit" ON "public"."payment_audit" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "athlete delete own results" ON "public"."workout_results" FOR DELETE TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete delete own sessions" ON "public"."workout_sessions" FOR DELETE TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete insert own results" ON "public"."workout_results" FOR INSERT TO "authenticated" WITH CHECK (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete insert own sessions" ON "public"."workout_sessions" FOR INSERT TO "authenticated" WITH CHECK (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read exercises" ON "public"."exercises" FOR SELECT USING (true);



CREATE POLICY "athlete read own attendance" ON "public"."attendance" FOR SELECT USING (("athlete_id" = "public"."athlete_id_for_user"("auth"."uid"())));



CREATE POLICY "athlete read own attendance list" ON "public"."session_attendees" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read own enrollments" ON "public"."enrollments" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read own metrics" ON "public"."performance_metrics" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read own notes" ON "public"."notes" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read own payments" ON "public"."payments" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read own results" ON "public"."workout_results" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read own routines" ON "public"."athlete_routines" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read own row" ON "public"."athletes" FOR SELECT USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "athlete read own sessions" ON "public"."workout_sessions" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete read plans" ON "public"."plans" FOR SELECT USING ("public"."is_athlete"("auth"."uid"()));



CREATE POLICY "athlete update own results" ON "public"."workout_results" FOR UPDATE TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"())))) WITH CHECK (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



CREATE POLICY "athlete update own sessions" ON "public"."workout_sessions" FOR UPDATE TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"())))) WITH CHECK (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."athlete_monthly_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "athlete_monthly_counters_all_staff" ON "public"."athlete_monthly_counters" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "athlete_monthly_counters_read_staff" ON "public"."athlete_monthly_counters" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."athlete_routines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athlete_slot_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "athlete_slot_assignments_all_staff" ON "public"."athlete_slot_assignments" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "athlete_slot_assignments_read_staff" ON "public"."athlete_slot_assignments" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



ALTER TABLE "public"."athletes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach manage athlete_routines for assigned athletes" ON "public"."athlete_routines" USING (("public"."is_coach_of_athlete"("auth"."uid"(), "athlete_id") OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "coach manage notes" ON "public"."notes" USING (("coach_id" IN ( SELECT "coaches"."id"
   FROM "public"."coaches"
  WHERE ("coaches"."profile_id" = "auth"."uid"()))));



CREATE POLICY "coach manage own follows" ON "public"."coach_athlete_follows" USING (("coach_id" = "public"."coach_id_for_user"("auth"."uid"()))) WITH CHECK (("coach_id" = "public"."coach_id_for_user"("auth"."uid"())));



CREATE POLICY "coach manage own routines" ON "public"."routines" USING ((("coach_id" = "public"."coach_id_for_user"("auth"."uid"())) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("coach_id" = "public"."coach_id_for_user"("auth"."uid"())) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "coach manage results for assigned athletes" ON "public"."workout_results" USING (("public"."is_coach_of_athlete"("auth"."uid"(), "athlete_id") OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "coach manage routine_exercises" ON "public"."routine_exercises" USING ((("routine_id" IN ( SELECT "routines"."id"
   FROM "public"."routines"
  WHERE ("routines"."coach_id" = "public"."coach_id_for_user"("auth"."uid"())))) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("routine_id" IN ( SELECT "routines"."id"
   FROM "public"."routines"
  WHERE ("routines"."coach_id" = "public"."coach_id_for_user"("auth"."uid"())))) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "coach manage sessions for assigned athletes" ON "public"."workout_sessions" USING (("public"."is_coach_of_athlete"("auth"."uid"(), "athlete_id") OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "coach read all athletes" ON "public"."athletes" FOR SELECT TO "authenticated" USING ("public"."is_coach"("auth"."uid"()));



CREATE POLICY "coach read all attendance" ON "public"."attendance" FOR SELECT TO "authenticated" USING ("public"."is_coach"("auth"."uid"()));



CREATE POLICY "coach read all notes" ON "public"."notes" FOR SELECT TO "authenticated" USING ("public"."is_coach"("auth"."uid"()));



CREATE POLICY "coach read all performance_metrics" ON "public"."performance_metrics" FOR SELECT TO "authenticated" USING ("public"."is_coach"("auth"."uid"()));



CREATE POLICY "coach read assigned athletes" ON "public"."athletes" FOR SELECT USING (("coach_id" IN ( SELECT "coaches"."id"
   FROM "public"."coaches"
  WHERE ("coaches"."profile_id" = "auth"."uid"()))));



CREATE POLICY "coach read attendance of assigned athletes" ON "public"."attendance" FOR SELECT USING ("public"."is_coach_of_athlete"("auth"."uid"(), "athlete_id"));



CREATE POLICY "coach read attendees for own sessions" ON "public"."session_attendees" FOR SELECT USING (("session_id" IN ( SELECT "sessions"."id"
   FROM "public"."sessions"
  WHERE ("sessions"."coach_id" = "public"."coach_id_for_user"("auth"."uid"())))));



CREATE POLICY "coach read enrollments of assigned athletes" ON "public"."enrollments" FOR SELECT USING ("public"."is_coach_of_athlete"("auth"."uid"(), "athlete_id"));



CREATE POLICY "coach read exercises" ON "public"."exercises" FOR SELECT USING ("public"."is_coach"("auth"."uid"()));



CREATE POLICY "coach read metrics of assigned athletes" ON "public"."performance_metrics" FOR SELECT USING ("public"."is_coach_of_athlete"("auth"."uid"(), "athlete_id"));



CREATE POLICY "coach read own row" ON "public"."coaches" FOR SELECT USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "coach read own sessions" ON "public"."sessions" FOR SELECT USING (("coach_id" = "public"."coach_id_for_user"("auth"."uid"())));



CREATE POLICY "coach read payments of assigned athletes" ON "public"."payments" FOR SELECT USING ("public"."is_coach_of_athlete"("auth"."uid"(), "athlete_id"));



CREATE POLICY "coach read plans" ON "public"."plans" FOR SELECT USING ("public"."is_coach"("auth"."uid"()));



ALTER TABLE "public"."coach_athlete_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metrics_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_pricing_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_pricing_tiers_all_staff" ON "public"."plan_pricing_tiers" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



ALTER TABLE "public"."plan_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_schedule_slot_coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_schedule_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_schedule_slots_all_staff" ON "public"."plan_schedule_slots" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_staff_only" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "profiles_select_coach" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_coach"("auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_staff" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "pssc_mutate_staff_only" ON "public"."plan_schedule_slot_coaches" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "pssc_select_staff_or_self" ON "public"."plan_schedule_slot_coaches" FOR SELECT USING (("public"."is_staff"() OR ("coach_id" = "public"."current_coach_id"())));



ALTER TABLE "public"."routine_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_coaches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_coaches_mutate_staff_only" ON "public"."schedule_coaches" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "schedule_coaches_select_staff_or_self" ON "public"."schedule_coaches" FOR SELECT TO "authenticated" USING (("public"."is_staff"() OR ("coach_id" IN ( SELECT "c"."id"
   FROM "public"."coaches" "c"
  WHERE ("c"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."session_attendees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."weekly_schedule" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_schedule_mutate_staff_only" ON "public"."weekly_schedule" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "weekly_schedule_select_authenticated" ON "public"."weekly_schedule" FOR SELECT TO "authenticated" USING (("public"."is_staff"() OR (EXISTS ( SELECT 1
   FROM "public"."coaches" "c"
  WHERE ("c"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."workout_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."access_logs";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."admin_billing_status"("p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_billing_status"("p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) TO "service_role";



GRANT ALL ON TABLE "public"."plan_schedule_slot_coaches" TO "anon";
GRANT ALL ON TABLE "public"."plan_schedule_slot_coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_schedule_slot_coaches" TO "service_role";



REVOKE ALL ON FUNCTION "public"."assign_coach_to_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_coach_to_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_coach_to_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_coach_to_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."athlete_debt_state"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."athlete_debt_state"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."athlete_debt_state"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."athlete_debt_state"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."athlete_id_for_user"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."athlete_id_for_user"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."athlete_id_for_user"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."coach_id_for_user"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."coach_id_for_user"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."coach_id_for_user"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."coach_planned_hours"("p_start" "date", "p_end" "date", "p_grain" "text", "p_coach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."coach_planned_hours"("p_start" "date", "p_end" "date", "p_grain" "text", "p_coach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."coach_planned_hours"("p_start" "date", "p_end" "date", "p_grain" "text", "p_coach_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."athletes" TO "anon";
GRANT ALL ON TABLE "public"."athletes" TO "authenticated";
GRANT ALL ON TABLE "public"."athletes" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_full_athlete_atomic"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_full_athlete_atomic"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_full_athlete_atomic"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_coach_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_coach_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_coach_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_monthly_invoices"("p_now" timestamp with time zone, "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_monthly_invoices"("p_now" timestamp with time zone, "p_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_slot_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_slot_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_slot_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_athlete"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_athlete"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_athlete"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_coach"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_coach"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_coach_of_athlete"("_user_uid" "uuid", "_athlete_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_coach_of_athlete"("_user_uid" "uuid", "_athlete_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach_of_athlete"("_user_uid" "uuid", "_athlete_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kiosk_check_in"("p_dni" "text", "p_phone" "text", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer, "p_autocreate_counter" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."kiosk_check_in"("p_dni" "text", "p_phone" "text", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer, "p_autocreate_counter" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."kiosk_check_in"("p_dni" "text", "p_phone" "text", "p_now" timestamp with time zone, "p_timezone" "text", "p_grace_days" integer, "p_autocreate_counter" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."kiosk_remaining"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."kiosk_remaining"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kiosk_remaining"("p_athlete_id" "uuid", "p_now" timestamp with time zone, "p_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."only_digits"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."only_digits"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."only_digits"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_grid_availability"("p_plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."plan_grid_availability"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_grid_availability"("p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_slot_availability"("p_plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."plan_slot_availability"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_slot_availability"("p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_workout_result_athlete"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_workout_result_athlete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_workout_result_athlete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."profiles_public_list"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profiles_public_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_public_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pssc_resolve_timeslot"() TO "anon";
GRANT ALL ON FUNCTION "public"."pssc_resolve_timeslot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pssc_resolve_timeslot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reassign_athlete_slots_atomic"("p_athlete_id" "uuid", "p_plan_id" "uuid", "p_visits_per_week" integer, "p_selected_weekly_schedule_ids" "uuid"[], "p_effective_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."reassign_athlete_slots_atomic"("p_athlete_id" "uuid", "p_plan_id" "uuid", "p_visits_per_week" integer, "p_selected_weekly_schedule_ids" "uuid"[], "p_effective_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_athlete_slots_atomic"("p_athlete_id" "uuid", "p_plan_id" "uuid", "p_visits_per_week" integer, "p_selected_weekly_schedule_ids" "uuid"[], "p_effective_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_plan_configuration"("p_plan_id" "uuid", "p_name" "text", "p_description" "text", "p_price" numeric, "p_capacity" integer, "p_status" "text", "p_session_duration_min" integer, "p_features" "jsonb", "p_coach_ids" "jsonb", "p_legacy_schedule" "jsonb", "p_pricing_tiers" "jsonb", "p_availability_windows" "jsonb", "p_schedule_slots" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_plan_configuration"("p_plan_id" "uuid", "p_name" "text", "p_description" "text", "p_price" numeric, "p_capacity" integer, "p_status" "text", "p_session_duration_min" integer, "p_features" "jsonb", "p_coach_ids" "jsonb", "p_legacy_schedule" "jsonb", "p_pricing_tiers" "jsonb", "p_availability_windows" "jsonb", "p_schedule_slots" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_plan_configuration"("p_plan_id" "uuid", "p_name" "text", "p_description" "text", "p_price" numeric, "p_capacity" integer, "p_status" "text", "p_session_duration_min" integer, "p_features" "jsonb", "p_coach_ids" "jsonb", "p_legacy_schedule" "jsonb", "p_pricing_tiers" "jsonb", "p_availability_windows" "jsonb", "p_schedule_slots" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_my_slot_preferences"("p_weekly_schedule_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_my_slot_preferences"("p_weekly_schedule_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_my_slot_preferences"("p_weekly_schedule_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_profiles_identity_normalized"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_profiles_identity_normalized"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profiles_identity_normalized"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."unassign_coach_from_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unassign_coach_from_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unassign_coach_from_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unassign_coach_from_plan_slot"("p_plan_id" "uuid", "p_weekly_schedule_id" "uuid", "p_coach_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_profile"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment"("p_id" "uuid", "p_amount" numeric, "p_base_amount" numeric, "p_method" "text", "p_concept" "text", "p_payment_date" "date", "p_discount_value" numeric, "p_discount_type" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment"("p_id" "uuid", "p_amount" numeric, "p_base_amount" numeric, "p_method" "text", "p_concept" "text", "p_payment_date" "date", "p_discount_value" numeric, "p_discount_type" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."void_payment"("p_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_payment"("p_id" "uuid", "p_reason" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."access_logs" TO "anon";
GRANT ALL ON TABLE "public"."access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_monthly_counters" TO "anon";
GRANT ALL ON TABLE "public"."athlete_monthly_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_monthly_counters" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_routines" TO "anon";
GRANT ALL ON TABLE "public"."athlete_routines" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_routines" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_slot_assignments" TO "anon";
GRANT ALL ON TABLE "public"."athlete_slot_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_slot_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."class_types" TO "authenticated";
GRANT ALL ON TABLE "public"."class_types" TO "service_role";



GRANT ALL ON TABLE "public"."coach_athlete_follows" TO "anon";
GRANT ALL ON TABLE "public"."coach_athlete_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_athlete_follows" TO "service_role";



GRANT ALL ON TABLE "public"."coaches" TO "anon";
GRANT ALL ON TABLE "public"."coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."coaches" TO "service_role";



GRANT ALL ON TABLE "public"."daily_wods" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_wods" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."kiosk_reason_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."kiosk_reason_codes" TO "service_role";



GRANT ALL ON TABLE "public"."performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."metrics" TO "anon";
GRANT ALL ON TABLE "public"."metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."metrics" TO "service_role";



GRANT ALL ON TABLE "public"."metrics_catalog" TO "anon";
GRANT ALL ON TABLE "public"."metrics_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."metrics_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."payment_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_audit" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."plan_availability_windows" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_availability_windows" TO "service_role";



GRANT ALL ON TABLE "public"."plan_coaches" TO "anon";
GRANT ALL ON TABLE "public"."plan_coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_coaches" TO "service_role";



GRANT ALL ON TABLE "public"."plan_features" TO "anon";
GRANT ALL ON TABLE "public"."plan_features" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_features" TO "service_role";



GRANT ALL ON TABLE "public"."plan_pricing_tiers" TO "anon";
GRANT ALL ON TABLE "public"."plan_pricing_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_pricing_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."plan_schedule" TO "anon";
GRANT ALL ON TABLE "public"."plan_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."plan_schedule_slots" TO "anon";
GRANT ALL ON TABLE "public"."plan_schedule_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_schedule_slots" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_public" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_public" TO "service_role";



GRANT ALL ON TABLE "public"."routine_exercises" TO "anon";
GRANT ALL ON TABLE "public"."routine_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."routine_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."routines" TO "anon";
GRANT ALL ON TABLE "public"."routines" TO "authenticated";
GRANT ALL ON TABLE "public"."routines" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_coaches" TO "service_role";



GRANT ALL ON TABLE "public"."session_attendees" TO "anon";
GRANT ALL ON TABLE "public"."session_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."session_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_schedule" TO "service_role";
GRANT SELECT ON TABLE "public"."weekly_schedule" TO "authenticated";



GRANT ALL ON TABLE "public"."workout_results" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_results" TO "service_role";



GRANT ALL ON TABLE "public"."workout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































-- ============================================================
-- Trigger cross-schema propio de la app (fuera de schema public):
-- crea el profile automáticamente al registrarse un usuario.
-- El dump de 'schema public' no lo incluye, se agrega explícitamente.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
