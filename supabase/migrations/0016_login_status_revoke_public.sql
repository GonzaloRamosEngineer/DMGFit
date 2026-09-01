-- 0016_login_status_revoke_public.sql
-- Cierra el EXECUTE heredado de PUBLIC en las funciones de 0015.
--
-- Postgres otorga EXECUTE a PUBLIC por defecto al crear una función, y `anon` lo
-- hereda de ahí: el `revoke ... from anon` de 0015 no alcanzaba (revocar de un rol
-- no quita el grant que ese rol recibe vía PUBLIC). Verificado contra prod: con la
-- publishable key, `athletes_login_status()` respondía 200.
--
-- No había filtración —el guard `is_staff()` devolvía lista vacía para anon—, pero
-- el criterio del proyecto es que estas funciones no estén ni al alcance de anon.
--
-- Nota de deuda: `list_coaches_admin()` (0002) tiene exactamente el mismo grant
-- heredado, con el mismo guard protegiéndola. Se deja registrado, no se toca acá
-- para no mezclar frentes.

revoke all on function public.athletes_login_status() from public;
revoke all on function public.athlete_login_status(uuid) from public;

-- Se re-otorga explícitamente a quienes sí deben poder ejecutarlas.
grant execute on function public.athletes_login_status() to authenticated, service_role;
grant execute on function public.athlete_login_status(uuid) to authenticated, service_role;
