-- 0023_professor_role_hardening.sql
-- Rol profesor: (A) habilitar LECTURA para el rol profesor (ve a todos los atletas,
-- "vista entrenador") y (B) endurecer los RPCs de administración para que un profesor
-- NO pueda ejecutarlos por API (privilegio de admin real).
--
-- NOTA sobre B: los cuerpos de las 3 funciones se copian VERBATIM de su definición
-- vigente (create_full_athlete_atomic <- 0021; save_plan_configuration y
-- reassign_athlete_slots_atomic <- 0009) cambiando ÚNICAMENTE el guard
-- is_staff() -> is_admin(auth.uid()). Generado por scratchpad_gen_0023.mjs.
--
-- Se DEJAN como is_staff() (staff compartido admin+profesor) a propósito:
-- assign/unassign_coach_from_plan_slot y las policies de planificación
-- (pssc/weekly_schedule) porque Planificación es una pantalla compartida.

begin;

-- =====================================================================
-- PARTE A — LECTURA del rol profesor (coach). "Ve a todos" + vista entrenador.
-- Aditivo: se suman políticas permisivas de SELECT para is_coach(); las
-- políticas existentes (admin full / coach assigned / athlete own) se conservan.
-- NO se toca payments: el profesor NO ve finanzas (ni en frontend ni en DB).
-- =====================================================================

-- Nombres de atletas/avatares: el profesor necesita leer profiles de todos.
drop policy if exists profiles_select_coach on public.profiles;
create policy profiles_select_coach on public.profiles
  for select to authenticated
  using (public.is_coach(auth.uid()));

-- Atletas: el profesor ve a todos (no solo asignados).
drop policy if exists "coach read all athletes" on public.athletes;
create policy "coach read all athletes" on public.athletes
  for select to authenticated
  using (public.is_coach(auth.uid()));

-- Asistencia de cualquier atleta.
drop policy if exists "coach read all attendance" on public.attendance;
create policy "coach read all attendance" on public.attendance
  for select to authenticated
  using (public.is_coach(auth.uid()));

-- Métricas de rendimiento / salud de cualquier atleta.
drop policy if exists "coach read all performance_metrics" on public.performance_metrics;
create policy "coach read all performance_metrics" on public.performance_metrics
  for select to authenticated
  using (public.is_coach(auth.uid()));

-- Notas: leer las de cualquier atleta (escribir sigue restringido a coach_id propio
-- por la policy existente "coach manage notes").
drop policy if exists "coach read all notes" on public.notes;
create policy "coach read all notes" on public.notes
  for select to authenticated
  using (public.is_coach(auth.uid()));

-- =====================================================================
-- PARTE B — Endurecer RPCs de administración: is_staff() -> is_admin(auth.uid()).
-- Un profesor deja de poder crear atletas/pagos, configurar planes o reasignar
-- horarios vía API. El admin sigue igual.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_full_athlete_atomic(p_payload jsonb)
 RETURNS athletes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

create or replace function public.save_plan_configuration(
  p_plan_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_price numeric default 0,
  p_capacity integer default 0,
  p_status text default 'active',
  p_session_duration_min integer default 60,
  p_features jsonb default '[]'::jsonb,
  p_coach_ids jsonb default '[]'::jsonb,
  p_legacy_schedule jsonb default '[]'::jsonb,
  p_pricing_tiers jsonb default '[]'::jsonb,
  p_availability_windows jsonb default '[]'::jsonb,
  p_schedule_slots jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.reassign_athlete_slots_atomic(
  p_athlete_id uuid,
  p_plan_id uuid,
  p_visits_per_week integer,
  p_selected_weekly_schedule_ids uuid[],
  p_effective_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- Insert directo de profiles: solo admin (create_full_athlete_atomic es SECURITY
-- DEFINER y no depende de esta policy).
drop policy if exists profiles_insert_staff_only on public.profiles;
create policy profiles_insert_staff_only on public.profiles
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

commit;
