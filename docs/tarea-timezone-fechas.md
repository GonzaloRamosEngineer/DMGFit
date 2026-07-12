# Tarea dedicada — Bug de timezone / fechas (gimnasio en UTC-3, Salta)

> Estado: **RESUELTO 2026-07-12** (documentado 2026-07-11). Build verde. Falta probar de noche en real (ver "Verificación").

## Resolución (2026-07-12)
Se agregaron `hoyLocal()` y `formatearFecha()` en [src/utils/formatters.js](../src/utils/formatters.js) y se reemplazaron:
- **Patrón 1 ("hoy" en UTC):** professor-dashboard, individual-athlete-profile/index.jsx, AddAthleteModal, AddPaymentModal, MetricEntryForm, `services/athletes.js`, `services/payments.js`.
- **Patrón 2 (display corrido):** AthleteHeader (join_date), CoachNotes×2 (note.date), UpcomingSessions (session_date), PaymentHistory (payment_date), HealthMetrics (metric.date), AddPaymentModal (debt.payment_date).

**Falsos positivos descartados** (no tenían el bug, no se tocaron): class-schedule (wStart/wEnd son medianoche local, `.toISOString()` no corre el día), coach-attendance y access-history y payment-management/index.jsx (ya parseaban con constructor local `new Date(y, m-1, d)` o `+'T00:00:00'`), y varios usos de `check_in_time` (es `timestamptz`, no `date`, no tiene el bug).

## Síntoma
Las fechas aparecen **un día corridas** y/o se guardan mal según la hora. Caso confirmado: un pago con `payment_date = 2026-07-11` en la base se **mostraba como "10/7/2026"** en la UI. De noche (después de las 21:00 en Salta) el "hoy" por defecto puede guardar el día siguiente.

## Causa raíz — es el FRONTEND, NO la base
La base guarda las fechas como tipo `date` (ej. `2026-07-11`), correctamente. El bug está 100% en el JavaScript, en dos patrones:

1. **Calcular "hoy" en UTC:** `new Date().toISOString().split('T')[0]` devuelve la fecha **UTC**. En Salta (UTC-3), a partir de las 21:00 UTC ya es el día siguiente → guarda mañana.
2. **Mostrar una fecha guardada:** `new Date("2026-07-11")` la interpreta como **UTC medianoche**; al renderizar en hora local (UTC-3) retrocede a las 21:00 del día anterior → muestra "10/7".

El gimnasio está en **Salta, Argentina (UTC-3)**. No se arregla en la base (rompería más); se resuelve manejando las fechas en **hora local**. `date-fns` YA está instalado.

## Alcance (medido)
**Patrón 1 — "hoy" en UTC (17 usos):**
- [professor-dashboard/index.jsx:25](../src/pages/professor-dashboard/index.jsx#L25), [:137](../src/pages/professor-dashboard/index.jsx#L137)
- [class-schedule/index.jsx:494-495](../src/pages/class-schedule/index.jsx#L494), [:501-502](../src/pages/class-schedule/index.jsx#L501) (`toISOString().slice(0,10)`)
- [coach-attendance/index.jsx:14](../src/pages/coach-attendance/index.jsx#L14)
- [athlete-portal/components/MetricEntryForm.jsx:176](../src/pages/athlete-portal/components/MetricEntryForm.jsx#L176)
- [individual-athlete-profile/index.jsx:606](../src/pages/individual-athlete-profile/index.jsx#L606), [:992](../src/pages/individual-athlete-profile/index.jsx#L992)
- [athletes-management/components/AddAthleteModal.jsx:75](../src/pages/athletes-management/components/AddAthleteModal.jsx#L75)
- [payment-management/components/AddPaymentModal.jsx:125](../src/pages/payment-management/components/AddPaymentModal.jsx#L125), [:370](../src/pages/payment-management/components/AddPaymentModal.jsx#L370)
- [services/athletes.js:102](../src/services/athletes.js#L102), [:122](../src/services/athletes.js#L122), [:154](../src/services/athletes.js#L154)
- [services/payments.js:31](../src/services/payments.js#L31)

**Patrón 2 — display (~28 usos):** `grep -rn "toLocaleDateString\|new Date(.*_date" src --include="*.jsx"`. Revisar cada uno: si recibe un string `YYYY-MM-DD` de la base, tiene el corrimiento.

## Fix propuesto (1 sola pasada)
1. Agregar 2 helpers en [src/utils/formatters.js](../src/utils/formatters.js):
   - `hoyLocal()` → fecha de hoy en local como `YYYY-MM-DD`. Ej: `format(new Date(), 'yyyy-MM-dd')` (date-fns usa hora local) o `new Date().toLocaleDateString('en-CA')`.
   - `formatearFecha(str, fmt='dd/MM/yyyy')` → mostrar un `YYYY-MM-DD` sin corrimiento. Ej: `format(parseISO(str), fmt)` (parseISO de date-only devuelve medianoche **local**) o `new Date(str + 'T00:00:00')`.
2. Reemplazar los 17 usos del patrón 1 por `hoyLocal()`.
3. Reemplazar los usos de display (patrón 2) por `formatearFecha(...)`.
4. **Ojo servicios** (`athletes.js`, `payments.js`): ahí el "hoy" se manda a RPCs — asegurarse de que la RPC espera fecha local (el kiosco usa `p_timezone='America/Argentina/Buenos_Aires'`, coherente con UTC-3).

## Verificación
`npm run build` verde. Probar de noche (o simular): crear atleta/pago y confirmar que la fecha guardada y mostrada coinciden con el día real de Salta. Revisar Pagos, alta, asistencia, class-schedule.

## Riesgos
Bajo. Es reemplazo mecánico. El único cuidado: distinguir "generar hoy" (patrón 1) de "mostrar fecha guardada" (patrón 2) — usan helpers distintos.
