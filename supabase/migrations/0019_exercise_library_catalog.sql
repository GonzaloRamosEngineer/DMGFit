-- Exercise library foundation: richer catalog metadata and search indexes.

alter table public.exercises
  add column if not exists slug text,
  add column if not exists primary_muscle text,
  add column if not exists secondary_muscles text[] default '{}'::text[] not null,
  add column if not exists equipment text,
  add column if not exists category text default 'strength' not null,
  add column if not exists tracking_type text default 'reps_weight' not null,
  add column if not exists aliases text[] default '{}'::text[] not null,
  add column if not exists instructions text,
  add column if not exists image_url text,
  add column if not exists video_url text,
  add column if not exists source text default 'catalog' not null,
  add column if not exists is_custom boolean default false not null,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamp with time zone default now() not null;

update public.exercises
set
  primary_muscle = coalesce(primary_muscle, muscle_group),
  slug = coalesce(
    slug,
    trim(both '-' from lower(regexp_replace(name, '[^[:alnum:]]+', '-', 'g')))
  ),
  updated_at = coalesce(updated_at, now())
where primary_muscle is null
   or slug is null
   or updated_at is null;

alter table public.exercises
  add constraint exercises_category_check
  check (category in ('strength', 'cardio', 'mobility', 'stretching', 'skill', 'other')) not valid;

alter table public.exercises
  add constraint exercises_tracking_type_check
  check (tracking_type in ('reps_weight', 'reps', 'time', 'distance', 'time_distance', 'bodyweight', 'assisted_bodyweight')) not valid;

create unique index if not exists uq_exercises_name_ci
  on public.exercises (lower(trim(name)));

create unique index if not exists uq_exercises_slug
  on public.exercises (slug);

create index if not exists idx_exercises_primary_muscle
  on public.exercises (primary_muscle);

create index if not exists idx_exercises_equipment
  on public.exercises (equipment);

create index if not exists idx_exercises_category
  on public.exercises (category);

grant select on public.exercises to authenticated;
