-- Additive support for athlete-level plan option/variant selection.
alter table public.athletes
  add column if not exists plan_option text;

create index if not exists athletes_plan_id_plan_option_idx
  on public.athletes(plan_id, plan_option);
