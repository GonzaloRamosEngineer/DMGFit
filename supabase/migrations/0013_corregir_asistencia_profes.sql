-- 0013_corregir_asistencia_profes.sql
-- Corrección manual de entrada/salida de un profesor en "Asistencia de Profesores".
-- Pedido de Cris (2026-08-05): "el profe no registró la salida, se fue a las 8. Si yo
-- lo registro ahora, ¿puedo poner la hora en la que se fue?". Hasta ahora la pantalla
-- era de sólo lectura: si el profe se olvidaba de fichar la salida, el día quedaba
-- "En curso" para siempre y sus horas trabajadas no se computaban nunca.
--
-- Por qué un RPC y no un update desde el cliente: `access_logs` tiene policies de
-- SELECT/INSERT/DELETE para staff pero **ninguna de UPDATE**, así que el update
-- directo queda denegado por RLS. Con SECURITY DEFINER además se validan las horas
-- en un solo lugar.
--
-- Alcance deliberado: sólo se CORRIGEN registros que ya existen. No se pueden crear
-- presencias desde cero (si el profe no fichó nada, no hay fila) — eso es otra cosa
-- (fabricar una presencia) y se decidirá aparte si hace falta.
--
-- Trazabilidad: toda corrección deja quién y cuándo, y la UI marca esos registros
-- como "corregido a mano" para poder distinguirlos de lo fichado en el kiosco.

-- (1) Procedencia de la corrección (idempotente)
ALTER TABLE "public"."access_logs"
  ADD COLUMN IF NOT EXISTS "attendance_edited_by" "uuid",
  ADD COLUMN IF NOT EXISTS "attendance_edited_at" timestamp with time zone;

COMMENT ON COLUMN "public"."access_logs"."attendance_edited_by" IS
  'Admin que corrigió a mano la entrada/salida del profesor (NULL = tal cual lo fichó el kiosco).';

-- (2) Corrección de entrada/salida
--     p_check_in / p_check_out son horas locales 'HH:MM' del día del registro.
--
--     NULL significa "no tocar", NO "borrar". Es a propósito: el caso normal es
--     cargar sólo la salida que faltó, y entonces la entrada real (la que fichó el
--     profe en el kiosco) no tiene por qué reescribirse con lo que haya quedado
--     precargado en un formulario. Un campo que no se toca no se escribe.
--     Para vaciar la salida (deshacer una mal cargada) está p_clear_check_out.
CREATE OR REPLACE FUNCTION "public"."admin_set_coach_attendance"(
  "p_log_id" "uuid",
  "p_check_in" "text" DEFAULT NULL,
  "p_check_out" "text" DEFAULT NULL,
  "p_clear_check_out" boolean DEFAULT false
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tz          text := 'America/Argentina/Buenos_Aires';
  v_log         public.access_logs;
  v_day         date;
  v_in          timestamptz;
  v_out         timestamptz;
  v_in_t        time;
  v_out_t       time;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede corregir la asistencia';
  end if;

  select * into v_log from public.access_logs where id = p_log_id for update;
  if not found then
    raise exception 'No se encontró el registro de asistencia.';
  end if;

  if v_log.coach_id is null then
    raise exception 'Este registro no es de un profesor.';
  end if;

  if p_check_in is null and p_check_out is null and not p_clear_check_out then
    raise exception 'No hay nada para corregir.';
  end if;

  -- El día del registro es el ancla: local_checkin_date, o la fecha local del fichaje.
  v_day := coalesce(v_log.local_checkin_date, (v_log.check_in_time at time zone v_tz)::date);
  if v_day is null then
    raise exception 'El registro no tiene fecha; no se puede corregir.';
  end if;

  -- Entrada: la nueva si vino, si no la que ya tenía (nunca queda sin entrada).
  if p_check_in is not null and trim(p_check_in) <> '' then
    begin
      v_in_t := trim(p_check_in)::time;
    exception when others then
      raise exception 'La hora de entrada no es válida (usá HH:MM).';
    end;
    v_in := (v_day + v_in_t) at time zone v_tz;
  else
    v_in := v_log.check_in_time;
    v_in_t := (v_in at time zone v_tz)::time;
  end if;

  if v_in is null then
    raise exception 'La hora de entrada es obligatoria.';
  end if;

  -- Salida: explícita, borrada a pedido, o la que ya tenía.
  if p_clear_check_out then
    v_out := null;
  elsif p_check_out is not null and trim(p_check_out) <> '' then
    begin
      v_out_t := trim(p_check_out)::time;
    exception when others then
      raise exception 'La hora de salida no es válida (usá HH:MM).';
    end;
    v_out := (v_day + v_out_t) at time zone v_tz;
  else
    v_out := v_log.check_out_time;
  end if;

  -- Mismo día: el gimnasio no cruza la medianoche. Si algún día hace falta un turno
  -- nocturno, esto es lo único que hay que relajar.
  if v_out is not null and v_out <= v_in then
    raise exception 'La salida (%) tiene que ser posterior a la entrada (%).',
      to_char((v_out at time zone v_tz)::time, 'HH24:MI'), to_char(v_in_t, 'HH24:MI');
  end if;

  update public.access_logs
     set check_in_time        = v_in,
         check_out_time       = v_out,
         attendance_edited_by = auth.uid(),
         attendance_edited_at = timezone('utc', now())
   where id = p_log_id;

  return jsonb_build_object(
    'id',             p_log_id,
    'fecha',          v_day,
    'check_in_time',  v_in,
    'check_out_time', v_out,
    'minutos',        case when v_out is null then null
                           else (extract(epoch from (v_out - v_in)) / 60)::int end
  );
end;
$$;

ALTER FUNCTION "public"."admin_set_coach_attendance"("uuid", "text", "text", boolean) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_set_coach_attendance"("uuid", "text", "text", boolean) TO "authenticated", "service_role";
