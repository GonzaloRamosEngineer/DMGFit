-- Registrador de entrenamiento del atleta (estilo Hevy) sobre las tablas
-- existentes workout_sessions / workout_results (hasta ahora solo admin/coach
-- podían escribirlas; el atleta solo leía las propias).
--
-- 1) Metadatos de sesión: título, inicio/fin (duración) y estado.
-- 2) Resultados por SERIE (una fila por serie, set_index) + distancia para cardio.
-- 3) Policies para que el atleta gestione SUS propias sesiones/resultados.

alter table public.workout_sessions
  add column if not exists title text,
  add column if not exists started_at timestamp with time zone,
  add column if not exists ended_at timestamp with time zone,
  add column if not exists status text not null default 'completed';

alter table public.workout_results
  add column if not exists set_index integer not null default 1,
  add column if not exists distance_m numeric,
  add column if not exists created_at timestamp with time zone not null default now();

create index if not exists idx_workout_results_athlete_exercise
  on public.workout_results (athlete_id, exercise_id, created_at desc);

create index if not exists idx_workout_results_session
  on public.workout_results (session_id);

-- ── Policies: el atleta gestiona lo suyo ──────────────────────────────────
-- (las policies existentes "athlete read own ..." cubren SELECT; estas agregan
--  INSERT/UPDATE/DELETE con el mismo criterio athlete_id -> profile_id = auth.uid())

drop policy if exists "athlete insert own sessions" on public.workout_sessions;
create policy "athlete insert own sessions" on public.workout_sessions
  for insert to authenticated
  with check (athlete_id in (select id from public.athletes where profile_id = auth.uid()));

drop policy if exists "athlete update own sessions" on public.workout_sessions;
create policy "athlete update own sessions" on public.workout_sessions
  for update to authenticated
  using (athlete_id in (select id from public.athletes where profile_id = auth.uid()))
  with check (athlete_id in (select id from public.athletes where profile_id = auth.uid()));

drop policy if exists "athlete delete own sessions" on public.workout_sessions;
create policy "athlete delete own sessions" on public.workout_sessions
  for delete to authenticated
  using (athlete_id in (select id from public.athletes where profile_id = auth.uid()));

drop policy if exists "athlete insert own results" on public.workout_results;
create policy "athlete insert own results" on public.workout_results
  for insert to authenticated
  with check (athlete_id in (select id from public.athletes where profile_id = auth.uid()));

drop policy if exists "athlete update own results" on public.workout_results;
create policy "athlete update own results" on public.workout_results
  for update to authenticated
  using (athlete_id in (select id from public.athletes where profile_id = auth.uid()))
  with check (athlete_id in (select id from public.athletes where profile_id = auth.uid()));

drop policy if exists "athlete delete own results" on public.workout_results;
create policy "athlete delete own results" on public.workout_results
  for delete to authenticated
  using (athlete_id in (select id from public.athletes where profile_id = auth.uid()));

-- ── Grants (RLS es quien restringe; anon queda fuera como en 0015) ────────
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.workout_results to authenticated;
revoke all on public.workout_sessions from anon;
revoke all on public.workout_results from anon;
