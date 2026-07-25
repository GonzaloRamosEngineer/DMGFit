# Tarea: los accesos del mes deben contarse desde la fecha de inscripción

> Arrancar con: "arreglemos que los accesos arranquen desde la inscripción del atleta".
> Handoff autocontenido (2026-07-24). Contexto y workflow al final.

## ✅ RESUELTO (2026-07-24) — migración `0006_accesos_desde_inscripcion.sql`
Implementado en la branch `feat/accesos-desde-inscripcion` (sin pushear, sin
aplicar a prod todavía — falta la password del pooler que provee el usuario).

**Decisiones tomadas con el usuario (superan al plan original del handoff):**
- **Cadencia: MES CALENDARIO** anclado a `join_date` (aniversario del día de
  inscripción), NO 30 días fijos. Inscripto el 15 → vence el 15 de cada mes;
  inscripto el 31 → último día del mes en meses cortos (Postgres clampea con
  `join_date + make_interval(months => k)`).
- **Alcance: la ventana ancla accesos Y vencimiento de cuota** (unificado, no
  separado como proponía el handoff). El caso disparador fue la duda de un socio:
  "¿pago julio y de nuevo agosto, o esto cubre hasta que se cumpla el mes?".
  Cris: "el mes corre desde que se inscribió".
- **Cuota del período vigente**: paga si hay un pago `paid` con fecha ≥ inicio del
  período actual; si no, desde el aniversario corren los días de gracia y luego
  queda vencida (se PERMITE con aviso; el único tope duro sigue siendo NO_BALANCE).

**Qué cambió la 0006:**
- `create_full_athlete_atomic`: primer contador cierra a fin de mes calendario
  (`join_date + 1 mes - 1 día`) en vez de `join_date + 29`.
- `kiosk_check_in`: calcula la ventana `[period_start, period_end]` desde
  `join_date` (mes calendario) y la usa para accesos y para cuota. Auto-sana:
  si el atleta trae un contador viejo (anclado a pago/hoy) que cubre hoy, lo
  realinea a la inscripción preservando `consumed_sessions`.
- `athlete_debt_state` (la usa la RPC `admin_billing_status` del panel de Pagos):
  mismo modelo aniversario y misma precedencia que el kiosco, para que el
  "vencido/gracia/pendiente" del panel quede alineado con lo que ve el socio en
  el kiosco. `expires_at` ahora es el próximo aniversario (no `último pago + 30`).
- Realineo inicial (una vez, al final de la migración) de los contadores vigentes
  de atletas activos.

### Generación de cuotas atada a la ASISTENCIA (2026-07-25)
Segunda parte del pedido: "cuándo se regenera la cuota" y el botón "Generar Período".

- Se descartó el cron ciego: generaría cuotas a los que dejaron de venir (deuda
  fantasma infinita, la preocupación del usuario).
- Modelo elegido: **la cuota ($, fila `payments` pending) se genera en el kiosco al
  fichar**, cuando el socio cruza a un período nuevo sin cuota. Atado a asistencia:
  - El que viene y no paga → se le acumula deuda **real** (1 cuota por período).
  - El que deja de venir → no ficha → **no se le genera nada** (no infla deuda).
  - **Sin back-fill**: solo se genera la del período que efectivamente asiste
    (si faltó agosto y vuelve en octubre, se genera octubre, no agosto).
  - Reconoce la cuota del alta (`period` NULL) y pagos dentro del período por su
    `payment_date`, así que no duplica. Idempotente (un fichaje/día).
- `kiosk_check_in` → bloque **(9b)**: `insert ... on conflict (athlete_id, period)`.
- `generate_monthly_invoices` (botón "Generar Período"): **alineado al aniversario**
  y **acotado a socios que asistieron** su período vigente. Queda como respaldo
  manual; con la generación al fichar, ya casi no hace falta. **No se agregó cron.**
- Helper nuevo `membership_period(join, ref)` (OUT period_start, period_end): fuente
  única de la ventana mes-calendario; lo usan kiosco, debt_state, generate y el realineo.
- **Frontend** (`payment-management`): en Deudores, un socio con **2+ cuotas impagas**
  muestra badge rojo **"Urgente · N vencidas"** (alerta para Cris). El resto igual.

Validación funcional (Postgres efímero): flujo de "Juan" completo — paga alta, ficha
y se genera la cuota del período, saltea un mes sin venir (no se genera ese mes),
vuelve y acumula 2 vencidas; fichar dos veces el mismo día no duplica. Build de
frontend OK.

**Validación (Postgres efímero, imagen supabase 17.6.1.134):** la cadena
`0000…0006` aplica limpia; cadencia correcta en todos los bordes (inscripto 31,
febrero, bisiesto, aniversario exacto); test funcional: realineo de contador
viejo preservando consumo, autocreación en ventana de inscripción, overdue
anclado al aniversario, y rollover en el aniversario. No introduce reason_codes
nuevos (no toca `kiosk_reason_codes`).

**Pendiente para aplicar a prod:** correr la 0006 por el pooler IPv4 y trackear
con `supabase migration repair --status applied 0006` (ver "Contexto/workflow"
al final). 100% backend, sin cambios de frontend.

---
### Notas históricas del análisis previo (pre-implementación)

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
