-- PR3 cleanup follow-up: enrich kiosk_check_in JSON response with athlete/profile context.

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
  v_athlete_id uuid;
  v_athlete_status text;
  v_athlete_name text;
  v_plan_name text;
  v_avatar_url text;
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
begin
  v_local_now := p_now at time zone p_timezone;
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  v_local_dow := extract(dow from v_local_now)::integer;

  if p_dni is not null then
    select a.id, a.status
    into v_athlete_id, v_athlete_status
    from public.athletes a
    where a.dni = p_dni
    limit 1;
  elsif p_phone is not null then
    select a.id, a.status
    into v_athlete_id, v_athlete_status
    from public.athletes a
    where a.phone = p_phone
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
    v_idempotency_key := coalesce(p_dni, p_phone, 'unknown') || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (null, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', null,
      'weekly_schedule_id', null,
      'athlete_name', null,
      'plan_name', null,
      'avatar_url', null,
      'message', v_message
    );
  end if;

  if v_athlete_status <> 'active' then
    v_reason_code := 'NOT_ACTIVE';
    v_message := 'Atleta INACTIVO. Consulte en administración.';
    v_idempotency_key := v_athlete_id::text || ':none:' || v_local_date::text;

    insert into public.access_logs (athlete_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'weekly_schedule_id', null,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
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

    insert into public.access_logs (athlete_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'weekly_schedule_id', null,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
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

    insert into public.access_logs (athlete_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key)
    values (v_athlete_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key);

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'weekly_schedule_id', null,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
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
      athlete_id, weekly_schedule_id, access_granted, rejection_reason, reason_code, local_checkin_date, idempotency_key
    ) values (
      v_athlete_id, v_weekly_schedule_id, false, v_message, v_reason_code, v_local_date, v_idempotency_key
    );

    return jsonb_build_object(
      'allowed', false,
      'reason_code', v_reason_code,
      'remaining', null,
      'athlete_id', v_athlete_id,
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
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
      weekly_schedule_id,
      access_granted,
      rejection_reason,
      reason_code,
      remaining_sessions,
      local_checkin_date,
      idempotency_key
    ) values (
      v_athlete_id,
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
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
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
      weekly_schedule_id,
      access_granted,
      rejection_reason,
      reason_code,
      local_checkin_date,
      idempotency_key
    ) values (
      v_athlete_id,
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
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'message', v_message
    );
  end if;

  update public.athlete_monthly_counters amc
  set consumed_sessions = amc.consumed_sessions + 1
  where amc.id = v_counter_id
    and amc.consumed_sessions < amc.allowed_sessions
  returning (amc.allowed_sessions - amc.consumed_sessions - 1)
  into v_remaining;

  if not found then
    v_reason_code := 'NO_BALANCE';
    v_message := 'Sin saldo de sesiones disponible.';

    insert into public.access_logs (
      athlete_id,
      weekly_schedule_id,
      access_granted,
      rejection_reason,
      reason_code,
      local_checkin_date,
      idempotency_key
    ) values (
      v_athlete_id,
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
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'message', v_message
    );
  end if;

  v_allowed := true;
  v_reason_code := 'OK';
  v_message := 'Acceso permitido.';

  insert into public.access_logs (
    athlete_id,
    weekly_schedule_id,
    access_granted,
    reason_code,
    rejection_reason,
    remaining_sessions,
    local_checkin_date,
    idempotency_key
  ) values (
    v_athlete_id,
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
    'weekly_schedule_id', v_weekly_schedule_id,
    'athlete_name', v_athlete_name,
    'plan_name', v_plan_name,
    'avatar_url', v_avatar_url,
    'message', v_message
  );

exception
  when others then
    begin
      insert into public.access_logs (
        athlete_id,
        weekly_schedule_id,
        access_granted,
        reason_code,
        rejection_reason,
        local_checkin_date,
        idempotency_key
      ) values (
        v_athlete_id,
        v_weekly_schedule_id,
        false,
        'ERROR',
        coalesce(sqlerrm, 'Error inesperado.'),
        coalesce(v_local_date, (p_now at time zone p_timezone)::date),
        coalesce(v_idempotency_key, coalesce(v_athlete_id::text, coalesce(p_dni, p_phone, 'unknown')) || ':' || coalesce(v_weekly_schedule_id::text, 'none') || ':' || coalesce(v_local_date, (p_now at time zone p_timezone)::date)::text)
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
      'weekly_schedule_id', v_weekly_schedule_id,
      'athlete_name', v_athlete_name,
      'plan_name', v_plan_name,
      'avatar_url', v_avatar_url,
      'message', coalesce(sqlerrm, 'Error inesperado.')
    );
end;
$$;

comment on function public.kiosk_check_in(text, text, timestamptz, text) is
'Atomic kiosk check-in RPC. Uses gym local timezone date (p_timezone) for duplicate guard/local_checkin_date, not UTC.';
