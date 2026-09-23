-- 0020_precios_alcance_acotado.sql
-- La actualización de precios deja de barrer a todo el plan.
--
-- PROBLEMA QUE RESUELVE
--   `admin_apply_plan_prices(plan_id)` de 0017 alcanzaba a TODOS los atletas activos del
--   plan cuya ficha no coincidiera con el tier de su frecuencia, sin importar qué tier se
--   hubiera tocado. Como en VC Fit todos los atletas están en PLAN BASE, cambiar el precio
--   de "1 vez por semana" ofrecía actualizar también a los de 2x, 3x y 5x.
--
--   Detectado por Gonzalo el 2026-09-23 probándolo en producción: subió el tier de 1x de
--   $15.000 a $20.000 y el diálogo le listó atletas de todas las frecuencias. NO confirmó.
--   Si confirmaba, se llevaba puestos a Melanina Laime ($25.000) y Susana Cuellar
--   ($35.000) —bonificaciones que todavía no están registradas como tales— y a Jagger
--   Ojeda ($10.000), que paga POR CLASE y no tiene cuota mensual.
--
--   O sea: la función podía destruir en un click exactamente lo que 0017 se cuidó de no
--   tocar en su backfill.
--
-- SOLUCIÓN: dos acotaciones, las dos opcionales para no romper llamadas viejas.
--   p_visits       -> sólo las frecuencias cuyo precio cambió realmente en ese guardado.
--   p_athlete_ids  -> sólo los atletas que el usuario dejó tildados en el diálogo.
--
--   La primera es la regla; la segunda es la red. Con las dos, ningún atleta se actualiza
--   sin que alguien lo haya mirado y dicho que sí.
--
-- Depende de 0017.

CREATE OR REPLACE FUNCTION "public"."admin_apply_plan_prices"(
  "p_plan_id" "uuid",
  "p_dry_run" boolean DEFAULT false,
  "p_visits" integer[] DEFAULT NULL,
  "p_athlete_ids" "uuid"[] DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rows jsonb;
  v_count int := 0;
  v_delta numeric := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN: solo admin puede actualizar precios';
  end if;

  if p_plan_id is null or not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'El plan seleccionado no existe.';
  end if;

  -- A quiénes alcanza. Los bonificados entran igual (regla 4 de Cris): se les pisa la
  -- ficha y su % sigue viviendo aparte, en discount_percent.
  with afectados as (
    select a.id,
           p.full_name           as nombre,
           a.visits_per_week     as frecuencia,
           a.plan_tier_price     as precio_anterior,
           pt.price              as precio_nuevo,
           a.discount_percent    as bonificacion
    from public.athletes a
    join public.profiles p on p.id = a.profile_id
    join public.plan_pricing_tiers pt
      on pt.plan_id = a.plan_id and pt.visits_per_week = a.visits_per_week
    where a.status = 'active'
      and a.plan_id = p_plan_id
      and a.plan_tier_price is distinct from pt.price
      -- Acotar a las frecuencias cuyo precio se tocó (null = todas, compatibilidad).
      and (p_visits is null or a.visits_per_week = any(p_visits))
      -- Acotar a los atletas elegidos en el diálogo (null = todos los de arriba).
      and (p_athlete_ids is null or a.id = any(p_athlete_ids))
  )
  select coalesce(jsonb_agg(to_jsonb(afectados) order by afectados.nombre), '[]'::jsonb),
         count(*),
         coalesce(sum(afectados.precio_nuevo - afectados.precio_anterior), 0)
    into v_rows, v_count, v_delta
  from afectados;

  if not p_dry_run and v_count > 0 then
    update public.athletes a
       set plan_tier_price = pt.price
      from public.plan_pricing_tiers pt
     where pt.plan_id = a.plan_id
       and pt.visits_per_week = a.visits_per_week
       and a.status = 'active'
       and a.plan_id = p_plan_id
       and a.plan_tier_price is distinct from pt.price
       and (p_visits is null or a.visits_per_week = any(p_visits))
       and (p_athlete_ids is null or a.id = any(p_athlete_ids));
  end if;

  return jsonb_build_object(
    'dry_run',            p_dry_run,
    'plan_id',            p_plan_id,
    'actualizados',       v_count,
    'diferencia_mensual', v_delta,
    'detalle',            v_rows
  );
end;
$$;

ALTER FUNCTION "public"."admin_apply_plan_prices"("uuid", boolean, integer[], "uuid"[]) OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."admin_apply_plan_prices"("uuid", boolean, integer[], "uuid"[])
  TO "authenticated", "service_role";

-- La firma de 2 argumentos de 0017 queda huérfana: si no se elimina, PostgREST ve dos
-- sobrecargas y no resuelve la llamada (PGRST203). Mismo motivo que en 0012 y 0017.
DROP FUNCTION IF EXISTS "public"."admin_apply_plan_prices"("uuid", boolean);
