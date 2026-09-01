-- 0015_athletes_login_status.sql
-- Estado REAL de acceso al portal de cada atleta, para que el panel deje de
-- deducirlo del dominio del email.
--
-- Contexto: desde el login por DNI, la identidad de auth de TODOS los atletas es
-- `{DNI}@vcfit.internal`. Ese dominio pasó a ser la marca de que el atleta SÍ tiene
-- login, pero el panel lo seguía leyendo como "todavía no tiene cuenta" (herencia del
-- modelo viejo por email). Resultado: 36 de 73 fichas mostraban "Sin acceso a App" y
-- el botón "Habilitar Acceso" sobre atletas que podían entrar desde el día del alta.
--
-- Este es el mismo criterio que ya usa `list_coaches_admin()` para profesores (0002):
-- preguntarle a `auth.users`, que es la única fuente de verdad del acceso.
--
-- Se resuelve con una función liviana (athlete_id → has_login) en vez de una RPC de
-- listado completo, para no reescribir los `select` con joins que ya alimentan
-- Gestión de Atletas y la ficha individual.

-- ── Estado de acceso de todos los atletas (una fila por atleta) ──────────────
create or replace function public.athletes_login_status()
returns table(athlete_id uuid, has_login boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    a.id as athlete_id,
    exists(select 1 from auth.users u where u.id = a.profile_id) as has_login
  from public.athletes a
  where public.is_staff();
$$;

alter function public.athletes_login_status() owner to postgres;
revoke all on function public.athletes_login_status() from anon;
grant execute on function public.athletes_login_status() to authenticated;

-- ── Estado de acceso de un atleta puntual (ficha individual) ─────────────────
create or replace function public.athlete_login_status(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists(
    select 1
    from public.athletes a
    join auth.users u on u.id = a.profile_id
    where a.id = p_athlete_id
      and public.is_staff()
  );
$$;

alter function public.athlete_login_status(uuid) owner to postgres;
revoke all on function public.athlete_login_status(uuid) from anon;
grant execute on function public.athlete_login_status(uuid) to authenticated;
