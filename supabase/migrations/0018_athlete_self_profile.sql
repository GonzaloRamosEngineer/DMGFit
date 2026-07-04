-- 0018_athlete_self_profile.sql
-- Autoservicio: el atleta ve y edita SUS datos personales desde el portal.
-- SECURITY DEFINER acotado a auth.uid() → solo puede tocar lo suyo.
-- Editable: nombre + datos personales (NO dni, NO plan, NO tier, NO email/login).

-- ── Lectura de mis datos ────────────────────────────────────────────────────
create or replace function public.get_my_profile()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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

-- ── Actualización de mis datos (whitelist) ──────────────────────────────────
create or replace function public.update_my_profile(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_profile(jsonb) to authenticated;
