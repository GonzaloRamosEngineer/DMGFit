-- Demo progress data for the athlete portal test account.
-- Safe to rerun: it only replaces rows tagged with trend = 'demo_seed'
-- for prueba.portal@vcfit.app.

with target_athlete as (
  select a.id
  from public.athletes a
  join public.profiles p on p.id = a.profile_id
  where lower(p.email) = lower('prueba.portal@vcfit.app')
  limit 1
),
deleted_demo_rows as (
  delete from public.performance_metrics pm
  using target_athlete ta
  where pm.athlete_id = ta.id
    and pm.trend = 'demo_seed'
  returning pm.id
),
inserted_demo_rows as (
  insert into public.performance_metrics (
    athlete_id,
    name,
    value,
    unit,
    metric_date,
    trend
  )
  select
    ta.id,
    values_to_insert.name,
    values_to_insert.value,
    values_to_insert.unit,
    values_to_insert.metric_date,
    'demo_seed'
  from target_athlete ta
  cross join (
    values
      ('Peso Corporal', 82.4, 'kg', date '2026-05-06'),
      ('Peso Corporal', 81.9, 'kg', date '2026-05-13'),
      ('Peso Corporal', 81.2, 'kg', date '2026-05-20'),
      ('Peso Corporal', 80.8, 'kg', date '2026-05-27'),
      ('Peso Corporal', 80.1, 'kg', date '2026-06-03'),
      ('Peso Corporal', 79.6, 'kg', date '2026-06-10'),
      ('Peso Corporal', 79.2, 'kg', date '2026-06-17'),
      ('Peso Corporal', 78.8, 'kg', date '2026-06-24'),
      ('Peso Corporal', 78.4, 'kg', date '2026-07-01'),

      ('Grasa Corporal', 21.4, '%', date '2026-05-06'),
      ('Grasa Corporal', 20.9, '%', date '2026-05-13'),
      ('Grasa Corporal', 20.3, '%', date '2026-05-20'),
      ('Grasa Corporal', 19.8, '%', date '2026-05-27'),
      ('Grasa Corporal', 19.2, '%', date '2026-06-03'),
      ('Grasa Corporal', 18.7, '%', date '2026-06-10'),
      ('Grasa Corporal', 18.4, '%', date '2026-06-17'),
      ('Grasa Corporal', 18.0, '%', date '2026-06-24'),
      ('Grasa Corporal', 17.7, '%', date '2026-07-01'),

      ('Sentadilla', 95.0, 'kg', date '2026-05-08'),
      ('Sentadilla', 100.0, 'kg', date '2026-05-18'),
      ('Sentadilla', 105.0, 'kg', date '2026-05-29'),
      ('Sentadilla', 110.0, 'kg', date '2026-06-09'),
      ('Sentadilla', 115.0, 'kg', date '2026-06-20'),
      ('Sentadilla', 120.0, 'kg', date '2026-07-01'),

      ('Press Banca', 70.0, 'kg', date '2026-05-09'),
      ('Press Banca', 72.5, 'kg', date '2026-05-19'),
      ('Press Banca', 75.0, 'kg', date '2026-05-30'),
      ('Press Banca', 77.5, 'kg', date '2026-06-10'),
      ('Press Banca', 80.0, 'kg', date '2026-06-21'),
      ('Press Banca', 82.5, 'kg', date '2026-07-02'),

      ('Peso Muerto', 120.0, 'kg', date '2026-05-10'),
      ('Peso Muerto', 125.0, 'kg', date '2026-05-20'),
      ('Peso Muerto', 130.0, 'kg', date '2026-05-31'),
      ('Peso Muerto', 135.0, 'kg', date '2026-06-11'),
      ('Peso Muerto', 140.0, 'kg', date '2026-06-22'),
      ('Peso Muerto', 145.0, 'kg', date '2026-07-03'),

      ('Remo con Barra', 60.0, 'kg', date '2026-05-11'),
      ('Remo con Barra', 62.5, 'kg', date '2026-05-21'),
      ('Remo con Barra', 65.0, 'kg', date '2026-06-01'),
      ('Remo con Barra', 67.5, 'kg', date '2026-06-12'),
      ('Remo con Barra', 70.0, 'kg', date '2026-06-23'),

      ('Salto Vertical', 40.0, 'cm', date '2026-05-12'),
      ('Salto Vertical', 43.0, 'cm', date '2026-06-02'),
      ('Salto Vertical', 46.0, 'cm', date '2026-06-18'),
      ('Salto Vertical', 49.0, 'cm', date '2026-07-01')
  ) as values_to_insert(name, value, unit, metric_date)
  returning id
)
select
  (select id from target_athlete) as athlete_id,
  (select count(*) from deleted_demo_rows) as deleted_demo_rows,
  (select count(*) from inserted_demo_rows) as inserted_demo_rows;
