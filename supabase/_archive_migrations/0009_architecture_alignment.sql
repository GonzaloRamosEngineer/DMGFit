-- Architectural alignment: transactional plan save, athlete onboarding and slot reassignment.

create unique index if not exists uq_weekly_schedule_natural_slot
  on public.weekly_schedule(day_of_week, start_time, end_time, capacity)
  where day_of_week is not null
    and start_time is not null
    and end_time is not null;

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
$$;

grant execute on function public.save_plan_configuration(uuid, text, text, numeric, integer, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to authenticated;

create or replace function public.create_full_athlete_atomic(
  p_payload jsonb
)
returns public.athletes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_athlete public.athletes%rowtype;
  v_plan_id uuid := (p_payload->>'plan_id')::uuid;
  v_visits_per_week int := nullif(p_payload->>'visits_per_week', '')::int;
  v_tier_price numeric := nullif(p_payload->>'tier_price', '')::numeric;
  v_join_date date := coalesce(nullif(p_payload->>'join_date', '')::date, current_date);
  v_email text := coalesce(nullif(trim(p_payload->>'email'), ''), 'sin_email_' || regexp_replace(coalesce(p_payload->>'dni', ''), '\D', '', 'g') || '@dmg.internal');
  v_selected_slots uuid[] := array(
    select distinct value::uuid
    from jsonb_array_elements_text(coalesce(p_payload->'selected_weekly_schedule_ids', '[]'::jsonb))
    where value ~* '^[0-9a-f-]{36}$'
  );
  v_slot_id uuid;
  v_remaining int;
  v_plan_name text;
  v_plan_price numeric;
begin
  if not public.is_staff() then
    raise exception 'Solo staff puede crear atletas' using errcode = '42501';
  end if;

  if v_plan_id is null then
    raise exception 'Debes seleccionar un plan obligatorio.';
  end if;

  if exists(select 1 from public.athletes where dni = regexp_replace(coalesce(p_payload->>'dni', ''), '\D', '', 'g')) then
    raise exception 'El DNI ya existe en el sistema.';
  end if;

  if exists(select 1 from public.profiles where email = v_email) then
    raise exception 'Este correo ya está registrado en el sistema.';
  end if;

  if v_visits_per_week is null or v_visits_per_week <= 0 then
    raise exception 'Debes seleccionar visitas por semana válidas.';
  end if;

  if coalesce(array_length(v_selected_slots, 1), 0) <> v_visits_per_week then
    raise exception 'Debes seleccionar exactamente % horarios semanales.', v_visits_per_week;
  end if;

  if (
    select count(*)
    from public.plan_schedule_slots
    where plan_id = v_plan_id and weekly_schedule_id = any(v_selected_slots)
  ) <> coalesce(array_length(v_selected_slots, 1), 0) then
    raise exception 'Se detectaron horarios fuera del plan seleccionado.';
  end if;

  for v_slot_id in select unnest(v_selected_slots)
  loop
    select greatest(
  ws.capacity - count(distinct case when a.id is not null then asa.id end),
  0
)::int
    into v_remaining
    from public.weekly_schedule ws
    left join public.athlete_slot_assignments asa
      on asa.weekly_schedule_id = ws.id
      and asa.is_active = true
      and asa.starts_on <= v_join_date
      and (asa.ends_on is null or asa.ends_on >= v_join_date)
    left join public.athletes a on a.id = asa.athlete_id and a.status = 'active'
    where ws.id = v_slot_id
    group by ws.capacity;

    if coalesce(v_remaining, 0) <= 0 then
      raise exception 'Uno o más horarios seleccionados no tienen cupo disponible.';
    end if;
  end loop;

  if v_tier_price is null then
    select pt.price
    into v_tier_price
    from public.plan_pricing_tiers pt
    where pt.plan_id = v_plan_id and pt.visits_per_week = v_visits_per_week
    limit 1;
  end if;

  insert into public.profiles(id, full_name, email, role)
  values (
    v_profile_id,
    coalesce(p_payload->>'full_name', 'Atleta sin nombre'),
    v_email,
    'atleta'
  );

  insert into public.athletes(
    profile_id,
    dni,
    phone,
    plan_id,
    plan_option,
    coach_id,
    visits_per_week,
    plan_tier_price,
    status,
    gender,
    city,
    join_date
  )
  values (
    v_profile_id,
    regexp_replace(coalesce(p_payload->>'dni', ''), '\D', '', 'g'),
    nullif(p_payload->>'phone', ''),
    v_plan_id,
    nullif(trim(coalesce(p_payload->>'plan_option', '')), ''),
    nullif(p_payload->>'coach_id', '')::uuid,
    v_visits_per_week,
    v_tier_price,
    'active',
    nullif(p_payload->>'gender', ''),
    nullif(p_payload->>'city', ''),
    v_join_date
  )
  returning * into v_athlete;

  insert into public.athlete_slot_assignments(athlete_id, weekly_schedule_id, starts_on, is_active)
  select v_athlete.id, s_id, v_join_date, true
  from unnest(v_selected_slots) s_id;

  select p.name, p.price
  into v_plan_name, v_plan_price
  from public.plans p
  where p.id = v_plan_id;

  insert into public.payments(athlete_id, amount, status, concept, payment_date)
  values (
    v_athlete.id,
    coalesce(v_tier_price, v_plan_price, 0),
    'pending',
    'Inscripción inicial - ' || coalesce(v_plan_name, 'Plan'),
    current_date
  );

  return v_athlete;
end;
$$;

grant execute on function public.create_full_athlete_atomic(jsonb) to authenticated;

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

grant execute on function public.reassign_athlete_slots_atomic(uuid, uuid, integer, uuid[], date) to authenticated;
