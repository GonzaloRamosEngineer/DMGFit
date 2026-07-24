-- 0004_kiosk_reason_codes_flexible.sql
-- Registra en el catálogo kiosk_reason_codes los códigos nuevos que introdujo el
-- kiosco flexible (0001). access_logs.reason_code tiene FK a kiosk_reason_codes(code),
-- así que sin estas filas el INSERT de un acceso "con aviso" fallaba y rompía el
-- check-in (se veía como "ACCESO DENEGADO" con el error de la constraint).

insert into public.kiosk_reason_codes (code, category, description, is_active) values
  ('OK_OFF_SCHEDULE', 'warning', 'Acceso permitido fuera de sus días/horarios asignados.', true),
  ('OK_TURNO_FULL',   'warning', 'Acceso permitido con el turno completo.',                true),
  ('OK_OVERDUE',      'warning', 'Acceso permitido con la cuota vencida.',                 true)
on conflict (code) do nothing;
