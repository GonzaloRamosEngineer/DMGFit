-- 0025_coach_athlete_follows.sql
-- "Seguimiento" de atletas por profesor (many-to-many, elegido por cada profe).
-- Tabla NUEVA, no modifica nada existente. Cada profe gestiona SOLO sus follows;
-- admin full. No hay grants para anon.

begin;

create table if not exists public.coach_athlete_follows (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (coach_id, athlete_id)
);

create index if not exists idx_caf_coach on public.coach_athlete_follows(coach_id);
create index if not exists idx_caf_athlete on public.coach_athlete_follows(athlete_id);

alter table public.coach_athlete_follows enable row level security;

-- Admin: acceso total.
drop policy if exists "admin full access coach_athlete_follows" on public.coach_athlete_follows;
create policy "admin full access coach_athlete_follows" on public.coach_athlete_follows
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Coach: gestiona SOLO sus propios seguimientos (coach_id = su coach).
drop policy if exists "coach manage own follows" on public.coach_athlete_follows;
create policy "coach manage own follows" on public.coach_athlete_follows
  using (coach_id = public.coach_id_for_user(auth.uid()))
  with check (coach_id = public.coach_id_for_user(auth.uid()));

grant select, insert, delete on public.coach_athlete_follows to authenticated;

commit;
