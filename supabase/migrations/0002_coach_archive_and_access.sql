-- 0002_coach_archive_and_access.sql
-- Alinea la gestión de profesores al esquema login-por-DNI (sin email) y agrega
-- el concepto de ARCHIVAR (deshabilitar) en vez de borrar, para no perder historial.
--
-- 1) coaches.archived_at: un profe archivado sale de la lista activa, se le bloquea
--    el login y se lo excluye de asignaciones nuevas, PERO su fila se conserva (sus
--    notas / asistencia / sesiones siguen resolviendo su nombre con normalidad).
-- 2) list_coaches_admin(): estado REAL de acceso (has_login = existe usuario de auth),
--    en vez de inferirlo del dominio del email (que ya no significa nada).
-- 3) set_coach_archived(): archiva/restaura + banea/desbanea el login (auth.users).
-- 4) delete_coach_hard(): borrado total para casos demo/error (irreversible).

-- ── 1) Columna de archivado ──────────────────────────────────────────────────
alter table public.coaches add column if not exists archived_at timestamptz;

-- ── 2) Listado admin con estado de acceso real ───────────────────────────────
create or replace function public.list_coaches_admin()
returns table(
  id uuid,
  profile_id uuid,
  full_name text,
  email text,
  avatar_url text,
  dni text,
  phone text,
  specialization text,
  bio text,
  total_athletes bigint,
  has_login boolean,
  archived_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select
    c.id,
    c.profile_id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.dni,
    coalesce(p.phone, c.phone) as phone,
    c.specialization,
    c.bio,
    (select count(*) from public.athletes a where a.coach_id = c.id) as total_athletes,
    exists(select 1 from auth.users u where u.id = c.profile_id) as has_login,
    c.archived_at
  from public.coaches c
  left join public.profiles p on p.id = c.profile_id
  where public.is_admin(auth.uid())
  order by (c.archived_at is not null), p.full_name;
$$;

alter function public.list_coaches_admin() owner to postgres;
grant execute on function public.list_coaches_admin() to authenticated;

-- ── 3) Archivar / restaurar (+ bloquear/restaurar login) ─────────────────────
create or replace function public.set_coach_archived(p_coach_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Solo el administrador puede archivar profesores' using errcode = '42501';
  end if;

  update public.coaches
     set archived_at = case when p_archived then now() else null end
   where id = p_coach_id
   returning profile_id into v_profile;

  if v_profile is null then
    raise exception 'Profesor no encontrado' using errcode = 'P0002';
  end if;

  -- Bloquea (o restaura) el acceso a la app sin borrar el usuario.
  update auth.users
     set banned_until = case when p_archived then now() + interval '100 years' else null end
   where id = v_profile;
end;
$$;

alter function public.set_coach_archived(uuid, boolean) owner to postgres;
grant execute on function public.set_coach_archived(uuid, boolean) to authenticated;

-- ── 4) Borrado total (solo demos/errores; irreversible) ──────────────────────
-- Limpia dependientes operativos, desvincula el historial de accesos (conserva la
-- fila del log poniendo coach_id = null), borra la ficha, el perfil y el usuario de
-- auth. Libera el DNI/email interno.
create or replace function public.delete_coach_hard(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Solo el administrador puede eliminar profesores' using errcode = '42501';
  end if;

  select profile_id into v_profile from public.coaches where id = p_coach_id;
  if v_profile is null then
    raise exception 'Profesor no encontrado' using errcode = 'P0002';
  end if;

  -- Conservar historial de accesos, pero desvincular al profe borrado.
  update public.access_logs set coach_id = null where coach_id = p_coach_id;

  -- Datos operativos sin ON DELETE CASCADE: se limpian explícitamente.
  delete from public.notes            where coach_id = p_coach_id;
  delete from public.routines         where coach_id = p_coach_id;
  delete from public.sessions         where coach_id = p_coach_id;
  delete from public.workout_sessions where coach_id = p_coach_id;
  update public.athletes set coach_id = null where coach_id = p_coach_id;

  -- (coach_athlete_follows, plan_coaches, plan_schedule_slot_coaches,
  --  schedule_coaches tienen ON DELETE CASCADE → se van solos al borrar el coach.)
  delete from public.coaches where id = p_coach_id;

  -- Perfil + usuario de auth (libera el DNI/email interno).
  delete from public.profiles where id = v_profile;
  delete from auth.users where id = v_profile;
end;
$$;

alter function public.delete_coach_hard(uuid) owner to postgres;
grant execute on function public.delete_coach_hard(uuid) to authenticated;
