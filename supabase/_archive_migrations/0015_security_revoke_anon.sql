-- 0015_security_revoke_anon.sql
-- Cierra el acceso anónimo (publishable key) a las tablas de catálogo que hoy
-- quedaron sin RLS y con grants abiertos (lectura/escritura por anon).
-- No rompe la app: las pantallas las leen como usuario 'authenticated'.
-- Ver docs/db-map.md (sección Seguridad).

revoke all on public.plan_availability_windows from anon;
revoke all on public.kiosk_reason_codes        from anon;
revoke all on public.class_types               from anon;
revoke all on public.daily_wods                from anon;
