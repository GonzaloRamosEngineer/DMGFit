-- 0014_athlete_onboarding_flexible.sql
-- Alta de atleta para el modelo de ACCESO FLEXIBLE:
--   * email OPCIONAL (nullable)
--   * sin selección de horarios fijos (no crea athlete_slot_assignments)
--   * crea el SALDO mensual (athlete_monthly_counters = visitas*4 o explícito)
--   * registra el PRIMER PAGO como 'paid' (arranca el ciclo de 30 días)
--   * persiste campos personales que antes se perdían (nacimiento, dirección, emergencia, médico)
-- Ver docs/acceso-flexible.md

alter table public.profiles alter column email drop not null;

create or replace function public.create_full_athlete_atomic(p_payload jsonb)
returns public.athletes
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;
