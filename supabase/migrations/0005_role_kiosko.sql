-- 0005_role_kiosko.sql
-- Rol dedicado "kiosko": una cuenta que SOLO ve la pantalla del kiosco de accesos
-- (/access-control) y no puede navegar al resto del panel. Pensado para el equipo
-- que deja el molinete abierto en un dispositivo fijo.
--
-- No tiene acceso a datos (RLS exige admin/coach/athlete, así que ve 0 filas); solo
-- necesita invocar las RPC del kiosco (kiosk_check_in / kiosk_remaining), que son
-- SECURITY DEFINER y ya están otorgadas a authenticated.

alter type "public"."user_role" add value if not exists 'kiosko';
