-- 0003_access_logs_attempted_identifier.sql
-- Permite ver EN EL HISTORIAL el DNI/teléfono que se intentó ingresar, incluso
-- cuando no existe en el sistema (hoy esas filas quedan como "Sin nombre").
--
-- El identificador tipeado ya viaja embebido como primer segmento del
-- idempotency_key (ej. "24138572:none:2026-07-23"). En vez de re-tocar la RPC
-- kiosk_check_in, lo exponemos como columna propia poblada por un trigger, y
-- hacemos backfill de lo histórico. Para filas de atletas/coaches conocidos el
-- primer segmento es un UUID → no se completa (ya se ve el nombre).

-- 1) Columna
alter table public.access_logs add column if not exists attempted_identifier text;

-- 2) Trigger de autopoblado (solo si el primer segmento del key es numérico = DNI/teléfono)
create or replace function public.access_logs_set_attempted_identifier()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.attempted_identifier is null and new.idempotency_key is not null then
    if split_part(new.idempotency_key, ':', 1) ~ '^[0-9]+$' then
      new.attempted_identifier := split_part(new.idempotency_key, ':', 1);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_access_logs_attempted on public.access_logs;
create trigger trg_access_logs_attempted
  before insert on public.access_logs
  for each row execute function public.access_logs_set_attempted_identifier();

-- 3) Backfill histórico (intentos ya registrados)
update public.access_logs
   set attempted_identifier = split_part(idempotency_key, ':', 1)
 where attempted_identifier is null
   and idempotency_key is not null
   and split_part(idempotency_key, ':', 1) ~ '^[0-9]+$';
