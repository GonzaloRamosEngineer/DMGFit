# Tarea: los accesos del mes deben contarse desde la fecha de inscripción

> Arrancar con: "arreglemos que los accesos arranquen desde la inscripción del atleta".
> Handoff autocontenido (2026-07-24). Contexto y workflow al final.

## Objetivo (pedido del cliente)
La **cantidad de accesos definidos** para el atleta debe **arrancar/renovarse desde el día de su inscripción** (`athletes.join_date`), no desde la fecha del último pago ni desde el día del primer ingreso.

## Estado actual (verificado en código)
El "saldo de accesos del mes" vive en `public.athlete_monthly_counters`
(`athlete_id, period_start, period_end, allowed_sessions, consumed_sessions`).
Se crea/renueva en **dos** lugares:

1. **Alta del atleta** — `create_full_athlete_atomic` (baseline `0000`, ~línea 427):
   crea el **primer** contador **correctamente anclado a la inscripción**:
   `period_start = join_date`, `period_end = join_date + 29`. ✅

2. **Kiosco (renovación real)** — `kiosk_check_in` (versión viva = migración
   `0001_kiosk_flexible_access.sql`, sección "(5) Pago" y "(7) Saldo"):
   cuando no hay contador vigente para la fecha, lo **autocrea** usando
   `v_period_start`/`v_period_end`, que se calculan a partir del **último pago**
   (`last_paid_at`) o de **hoy** si no hay pago:
   ```
   if v_last_paid_at is null then
     v_period_start := v_local_date;      v_period_end := v_local_date + 29;
   else
     v_period_start := (v_last_paid_at ...)::date;  v_period_end := v_period_start + 29;
   end if;
   ```
   → **Acá está el problema:** al vencer el primer período, el ciclo siguiente
   se ancla al pago/hoy y **se despega de la cadencia de la inscripción**.
   (Además, los ~15 atletas precargados por script no pasaron por
   `create_full_athlete_atomic`, así que su primer contador también lo autocreó
   el kiosco anclado a pago/hoy.)

> Ojo: en `kiosk_check_in`, `v_period_start/v_period_end` se calculan en la
> sección de **pago** y se **reutilizan** para el contador. Están entrelazados
> el "ciclo de pago" y la "ventana de accesos". El core de la tarea es
> **separarlos**: la ventana de accesos se ancla a `join_date`; el ciclo de
> pago/gracia puede seguir con su lógica actual (último pago).

`generate_monthly_invoices` (baseline) **no** crea contadores (solo facturas),
así que la renovación de accesos pasa hoy exclusivamente por el kiosco.

## Decisiones a confirmar con el usuario antes de codear
1. **Cadencia:** ¿ciclo de **30 días** desde `join_date` (como hoy) o **mes
   calendario** (mismo día de cada mes)? Sugerido: 30 días fijos por continuidad.
2. **Pago vs. accesos:** confirmar que el **bloqueo por cuota vencida** sigue
   atado al **último pago** (sin cambios), y que SOLO la **ventana de conteo de
   accesos** pasa a anclarse a `join_date`.
3. **Atletas existentes:** ¿recalcular/migrar los contadores actuales para
   realinearlos a `join_date`, o aplicar solo de acá en adelante? (Hay contadores
   ya creados con período anclado a pago/hoy.)
4. **allowed_sessions:** se mantiene `visits_per_week*4` (o 12 por defecto), ¿sí?

## Plan de cambio propuesto
- **Migración `0006`** con `CREATE OR REPLACE FUNCTION kiosk_check_in(...)`
  (reproducir la 0001 completa y cambiar SOLO el cálculo de la ventana de
  accesos). Calcular el período vigente por cadencia desde `join_date`:
  ```
  -- k = cuántos ciclos de 30 días pasaron desde la inscripción
  v_join := (select join_date from athletes where id = v_athlete_id);
  v_k := floor((v_local_date - v_join) / 30);
  v_period_start := v_join + (v_k * 30);
  v_period_end   := v_period_start + 29;
  ```
  Usar ese `v_period_start/v_period_end` tanto para **buscar** el contador
  vigente como para **autocrearlo**. Dejar el cálculo de pago/gracia/expiración
  como está (a partir de `last_paid_at`), solo desacoplado de la ventana de accesos.
- Revisar que el `on conflict (athlete_id, period_start, period_end)` siga siendo
  coherente con la nueva cadencia.
- (Opcional, según decisión 3) migración de datos para realinear contadores
  vigentes de atletas activos a la ventana basada en `join_date`, preservando
  `consumed_sessions`.

## Verificación sugerida
- Atleta con `join_date` viejo (ej. hace 65 días): el kiosco debe ubicarlo en el
  **3er ciclo** (días 60–89 desde inscripción), no en uno anclado al pago.
- Simular `kiosk_check_in(p_dni => ...)` por psql y revisar `details.period_start`
  / `period_end` == cadencia de `join_date`.
- Que un atleta al día siga entrando en verde y que el saldo se renueve al cruzar
  el múltiplo de 30 desde la inscripción.

## Contexto/workflow de esta sesión (para aplicar)
- **Migraciones activas:** `supabase/migrations/0000_baseline.sql` … `0005`.
  La **próxima es `0006`**. `kiosk_check_in` vive en `0001` (esa es la versión a
  tomar como base para el `CREATE OR REPLACE`).
- **Aplicar a prod (pooler IPv4):**
  `PGPASSWORD='<pass>' psql -h aws-0-us-west-2.pooler.supabase.com -p 5432 -U postgres.plbycllbuwfrkknlbhno -d postgres -v ON_ERROR_STOP=1 -f supabase/migrations/0006_....sql`
  Luego tracking: `supabase migration repair --status applied 0006 --db-url '<url con %21 por el !>'`.
  El usuario pasa la password y **la resetea al terminar**.
- **GOTCHA reason_code:** si se agregan códigos nuevos, cargarlos en
  `kiosk_reason_codes` (FK `access_logs_reason_code_fk`) o el check-in rompe.
- **TZ:** todo en `America/Argentina/Buenos_Aires` (UTC-3).
- **Deploy frontend (si toca):** build (`npm run build`), commit, `git push origin main`
  (Vercel deploya solo). Este cambio es 100% backend, probablemente sin frontend.
- Fuente de verdad viva del kiosco: `docs/kiosco-casos-y-mensajes.md`.
