# Cuotas, accesos y facturación — cómo funciona

> Fuente de verdad viva del modelo (desde 2026-07-25, migraciones `0006`–`0008`).
> Reemplaza el modelo anterior "vencido = último pago + 30 días". Para el historial
> de decisiones ver `tarea-accesos-desde-inscripcion.md`.

## Idea central: el "mes" corre desde la inscripción

Cada atleta tiene una **fecha de inscripción** (`athletes.join_date`). Todo su ciclo
—renovación de accesos **y** vencimiento de cuota— corre desde esa fecha, con cadencia
de **mes calendario** (aniversario del día de inscripción).

- Inscripto el **15** → su mes se cumple el **15** de cada mes. Período: 15 → 14 del
  mes siguiente. Al día 15 se renueva.
- Inscripto el **31** → en meses sin 31 se cumple el **último día** del mes (Postgres
  clampea; ej. 31-ene → 28-feb).
- La ventana del período la calcula el helper `membership_period(join_date, hoy)` →
  `(period_start, period_end)`. Lo usan el kiosco, el estado de cuota, la generación
  y el realineo: **una sola fórmula, en un solo lugar**.

El **día del pago no cambia el ancla**: si te inscribís el 15 y pagás el 20, tu ciclo
sigue corriendo desde el 15. El ancla es siempre `join_date`.

## 1) Accesos (los "12 del mes")

Viven en `athlete_monthly_counters` (`allowed_sessions`, `consumed_sessions`, ventana).

- Se renuevan **automáticamente en cada aniversario**, en el kiosco: al primer fichaje
  del período nuevo, `kiosk_check_in` autocrea el contador con su cupo
  (`visits_per_week * 4`, o 12 por defecto).
- **Se renuevan pague o no pague.** La deuda se maneja aparte (ver abajo).
- El **único freno duro** de la puerta es quedarse sin accesos (`NO_BALANCE`, rojo) o
  tener la cuenta inactiva. Todo lo demás (cuota vencida, fuera de horario, turno
  lleno) **deja entrar** con aviso ámbar.

## 2) Estado de cuota (¿al día / gracia / vencido?)

Se calcula **en vivo**, sin depender de que exista una factura. `athlete_debt_state`
(lo usa el kiosco y el panel de Pagos vía `admin_billing_status`):

- **Al día (`ok`)**: hay un pago `paid` con fecha dentro del período vigente
  (>= `period_start`).
- Si no pagó el período vigente, se cuentan los días desde el aniversario:
  - dentro de la gracia (def. 3 días) y **ya había pagado antes** → `grace`
  - dentro de la gracia y **nunca pagó** → `pending`
  - pasada la gracia → `overdue` (**vencido**)

En la puerta, el vencido **no bloquea**: entra en ámbar con el aviso. Es decisión de
producto (no pelear la cobranza en la puerta).

## 3) Cuota como deuda ($) — cuándo se genera

La cuota es una fila en `payments` (`status='pending'`). Se genera de **dos formas
complementarias**, ambas ancladas al período de inscripción y **atadas a que el socio
exista/asista** (nunca se le apila deuda infinita a alguien que se fue):

**a) Automática, socio AL DÍA — cron diario.**
`generate_due_invoices_auto` (pg_cron `generate-due-invoices-daily`, 09:00 UTC = 06:00
AR) genera la cuota del período vigente el **día del aniversario** para atletas activos
que **no tienen ninguna cuota pendiente** (están al día). Los días de gracia hacen de
aviso (pendiente, todavía no vencida).

**b) Al fichar, socio ATRASADO — en el kiosco.**
Si el socio **ya debe** (tiene una pendiente), el cron **no le apila** más. La siguiente
cuota se genera **solo si registra un ingreso** por el kiosco y cruzó a un período nuevo
sin cuota (bloque 9b de `kiosk_check_in`). **Sin back-fill**: solo la del período que
efectivamente asiste (si faltó un mes, ese mes no se cobra).

**Consecuencia (el diseño clave):**
- El que **viene y no paga** → acumula deuda real (1 cuota por período) + alerta.
- El que **deja de venir** → no ficha → no se le genera nada → queda con **1 sola**
  cuota y ahí se frena. **No hay deuda fantasma.**

No se duplica: la generación reconoce la cuota del alta (`period` NULL) y los pagos
hechos dentro del período por su `payment_date`; es idempotente (`on conflict
(athlete_id, period)`).

> El botón **"Generar Período"** (`generate_monthly_invoices`) quedó como respaldo
> manual: genera por el ciclo de cada socio y solo para los que asistieron su período.
> Con la generación automática, casi no hace falta.

## 4) Alerta de morosos (panel de Pagos → Deudores)

Cada socio con **2 o más** cuotas impagas muestra el badge rojo **"Urgente · N
vencidas"**. Es la señal para priorizar la cobranza (el caso "vino de nuevo y ya debía").

## 5) Editar la fecha de inscripción

Como el ancla es `join_date`, esa fecha tiene que ser correcta. En altas nuevas se setea
al dar de alta. Para corregir cargas viejas, el perfil del atleta tiene el campo
**"Fecha de Inscripción"** (editable). Al cambiarla:
- El **estado de cuota** se recalcula solo (es en vivo).
- El **contador de accesos** vigente se **re-ancla** a la nueva ventana preservando lo
  consumido (`admin_realign_athlete_counter`).

> Contexto: los ~17 atletas de la carga inicial entraron con `join_date` = fecha de
> carga (no la real), por eso al principio figuran muchos "vencidos". Se corrigen
> editando la fecha real de cada uno.

## Piezas técnicas (referencia rápida)

| Función | Rol |
|---|---|
| `membership_period(join, ref)` | ventana `(period_start, period_end)` del mes-calendario. Fórmula única. |
| `kiosk_check_in(...)` | acceso + renovación de contador + genera cuota al fichar (9b). |
| `athlete_debt_state(...)` / `admin_billing_status()` | estado de cuota en vivo (panel de Pagos). |
| `generate_due_invoices_auto(...)` | cron: genera cuota del socio al día (día del aniversario). |
| `generate_monthly_invoices(...)` | botón manual "Generar Período" (respaldo). |
| `create_full_athlete_atomic(...)` | alta: primer contador + cuota de inscripción. |
| `admin_realign_athlete_counter(id)` | re-ancla el contador tras editar `join_date`. |
| `admin_update_athlete_membership(...)` | cambia plan/frecuencia/cuota y acompaña el contador vigente. |

Migraciones: `0006_accesos_desde_inscripcion`, `0007_generar_cuotas_automatico`,
`0008_editar_fecha_inscripcion`. Todas aplicadas a prod (2026-07-25) y trackeadas.
TZ: `America/Argentina/Buenos_Aires`.

## 6) Ajustar el saldo de accesos (arranque del sistema)

Al iniciar, `consumed_sessions` está en ~0 porque los ingresos previos no se
registraron por el kiosco → el saldo mostrado puede estar de más. Es un desfasaje de
**un solo período**: en el próximo aniversario el contador se resetea y queda exacto.

Para los casos puntuales donde el saldo real importa, el perfil del atleta (pestaña
**Accesos**) tiene **"Saldo de accesos del período" → Ajustar**: se setea la cantidad
de **accesos restantes** y el backend calcula `consumed = allowed - restantes`
(`admin_set_access_balance`, migración `0009`). No hace falta tocar a todos: solo los
pocos que valga la pena; el resto se acomoda solo el próximo aniversario.

## 7) Cambiar la frecuencia (y la cuota) de un atleta

La frecuencia (`athletes.visits_per_week`) es el dato que manda: define el saldo de
accesos (**frecuencia × 4**) y el tier de precio. Antes sólo se podía fijar en el alta,
así que un atleta cargado como 2x quedaba encerrado en 2x (el perfil sólo guardaba
`plan_id`/`plan_option`, nunca la frecuencia).

Ahora el perfil del atleta tiene **Membresía y horarios → Gestionar → "Editar plan,
frecuencia y cuota"**: plan, **frecuencia** (las opciones salen de los
`plan_pricing_tiers` del plan) y **cuota** (se propone la del tier, editable para
cliente especial). Al guardar, `admin_update_athlete_membership` (migración `0011`)
hace todo en una transacción:

- Actualiza `plan_id`, `visits_per_week` y `plan_tier_price`.
- **Acompaña el contador vigente**: `allowed_sessions = frecuencia × 4`, preservando
  `consumed_sessions`. Si bajan la frecuencia por debajo de lo ya consumido, `allowed`
  se queda en lo consumido (lo exige el CHECK y sería quitarle accesos ya usados); la
  UI lo avisa. El próximo aniversario ya arranca con el valor nuevo.
- **No toca pagos**: las cuotas ya emitidas conservan su monto. El precio nuevo aplica
  desde la próxima cuota. Si hay que cobrar la diferencia del período en curso, se hace
  desde Pagos.

Si la frecuencia cambia, la UI pide confirmación mostrando el impacto (frecuencia,
accesos y cuota antes → después).
