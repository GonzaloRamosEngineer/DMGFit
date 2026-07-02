-- 0017_athlete_self_slot_preferences.sql
-- Auto-gestión de "preferencia de turnos" por el propio atleta (modelo flexible).
-- El turno es SOLO preferencia/agenda habitual: NO controla el acceso (eso lo hace
-- el kiosco por saldo mensual + cupo en vivo). Por eso no hay control de cupo acá.
-- Ambas RPC son SECURITY DEFINER y se acotan al atleta del auth.uid() → el cliente
-- solo puede ver/cambiar LO SUYO.

-- ── Lectura: opciones de turno del atleta logueado ──────────────────────────
create or replace function public.get_my_slot_options()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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

-- ── Escritura: reemplaza la preferencia de turnos del atleta logueado ───────
create or replace function public.set_my_slot_preferences(p_weekly_schedule_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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

grant execute on function public.get_my_slot_options() to authenticated;
grant execute on function public.set_my_slot_preferences(uuid[]) to authenticated;
