# Tarea: Pagos confiables

_Doc autocontenido. Arrancar con: "Retomemos DMGFit, vamos con pagos — leé `docs/tarea-pagos.md`"._
_Escrito 2026-07-18, con estado del código verificado a esa fecha._

## Objetivo

Que **Pagos** deje de ser sólo un registro y pase a ser **fuente de verdad**:
cuotas que se generan de forma confiable, "vencido" con un criterio único y
consistente con el kiosco, y pagos editables/corregibles con traza. Es el frente
de mayor peso para el cliente (ver [`ESTADO-Y-ROADMAP.md`](./ESTADO-Y-ROADMAP.md)).

## Cómo funciona HOY (estado real, con anclas)

**Página** `src/pages/payment-management/index.jsx` (define su tabla, KPIs y
`PaymentDetailModal` inline; sólo reusa `AddPaymentModal`):
- **Generar cuotas**: botón "Generar Periodo" (`index.jsx:437-450`) → `handleGenerateInvoices`
  (`index.jsx:366`) → `generateMonthlyInvoices()` del servicio. Anti-doble-click sólo por
  flag React (`isGenerating`).
- **"Vencido"**: se deriva **sólo en el front al leer** (`index.jsx:298`:
  `isPastDue = status==='overdue' || (status==='pending' && payment_date < today)`).
  En DB nadie escribe `status='overdue'`.
- **Editar/borrar pago**: **no existe**. `PaymentDetailModal` (`index.jsx:101-223`) es
  sólo lectura. La única mutación de un pago existente es **saldar deuda** (pending→paid)
  en `AddPaymentModal`.
- **KPIs** (`index.jsx:461-489`): Ingresos del mes (suma `amount` de `status='paid'` del
  mes), Total vencido (suma de `isPastDue`), Atletas con deuda (`Set` de pending+overdue).

**Servicio** `src/services/payments.js` — sólo 2 funciones, todo en JS (sin RPC):
- `fetchPaymentsByAthlete(athleteId)` (`:7`).
- `generateMonthlyInvoices()` (`:21-135`): trae atletas activos, mira quién ya tiene pago
  este mes, inserta cuotas faltantes con **`status:'pending'`** (`:100`), `method:'efectivo'`,
  `payment_date: hoyLocal()`. **Bug de idempotencia**: el rango del mes usa
  `new Date(...).toISOString()` **en UTC** (`:27`, `:29`) → cerca de fin de mes puede
  desalinear "ya pagó este mes"; y no hay unicidad en DB (doble click concurrente puede duplicar).

**AddPaymentModal** (`src/pages/payment-management/components/AddPaymentModal.jsx`):
- Registrar pago: `handleSubmit` (`:399`) inserta con `status:'paid'`, aplica descuento
  (`getFinalTotal()` con `Math.max(0, ...)`).
- Saldar deuda: si hay deudas seleccionadas → `UPDATE ... WHERE id IN (selectedDebtIds)`
  (`:415-421`). Anti-doble-submit por flag `loading`; valida `amount > 0` en el botón.

**Esquema `payments`** (`supabase/schema_snapshot.sql:1919-1931`):
- Columnas: `id`, `athlete_id` (FK→athletes ON DELETE CASCADE), `payment_date date NOT NULL`,
  `amount numeric NOT NULL`, `status text NOT NULL` (**sin default, sin enum, sin CHECK**),
  `method text`, `concept text`, `date` (generada, deprecada), `base_amount`,
  `discount_value default 0`, `discount_type`.
- **NO hay** `CHECK (amount >= 0)`. `status` es texto libre; valores usados: `'pending'`,
  `'paid'`, y `'overdue'` (sólo leído en el front, nunca escrito).
- **NO hay** cron/pg_cron, ni función que marque vencidos, ni RPC de generación de cuotas.
- RLS OK: admin full; atleta lee lo suyo; coach lee los de sus atletas.

**Kiosco (fuente de verdad del acceso)** `kiosk_check_in` (vigente = migración `0024`):
lee el **último pago `paid`** del atleta, arma ciclo de **30 días + gracia (default 3)**.
Vencido dentro de gracia o atleta sin ningún `paid` → entra en **ámbar** (`OK_GRACE`/
`OK_PENDING`) avisando regularizar; vencido pasada la gracia → `PAYMENT_BLOCKED`.
⚠️ **Este criterio (último paid + 30d + gracia) NO coincide con el "vencido" del front**
(que mira `payment_date` de la cuota pending). Unificarlo es parte del objetivo.

## Alcance propuesto para ESTA tanda

**DENTRO:**
1. **Definición única de deuda/vencido**, consistente entre Pagos y kiosco.
2. **Generación de cuotas idempotente** vía **RPC server-side** (admin-only), con fecha
   local y unicidad por atleta+período (evita duplicados y arregla el bug UTC).
3. **Editar y anular/borrar un pago** (admin) con **traza de auditoría**.
4. **Validación server-side**: `CHECK (amount >= 0)` y acotar `status`.
5. **Limpiar los 8 componentes muertos** de `payment-management/components/`.

**FUERA (fase 2, no en esta tanda):**
- Recordatorios automáticos (email/WhatsApp) a deudores — `AutomatedReminderControl`
  está muerto; es un feature aparte.
- Gráficos de ingresos (`RevenueChart`/`PaymentMethodChart`) — si se quieren, se
  reconstruyen con datos reales; por ahora se borran.
- `pg_cron` nocturno (opcional; ver decisión A).

## Plan por piezas

1. **Migración `0026_payments_integrity.sql`**
   - `CHECK (amount >= 0)` en `payments` (validar antes que no haya filas negativas).
   - Acotar `status` (CHECK IN `('pending','paid','overdue','void')` o enum) — decidir
     si se incluye `'void'` para anulaciones (ver decisión C).
   - Columna(s) de auditoría: `updated_at`, `updated_by uuid`, y para anulación
     `voided_at`/`voided_by`/`void_reason` (o una tabla `payment_audit`, decisión C).
   - Índice/único para idempotencia de cuotas (decisión B): p.ej. columna `period`
     (`date` primer día del mes) + `unique(athlete_id, period)` parcial para status de cuota.

2. **RPC `generate_monthly_invoices()` (SECURITY DEFINER, `is_admin`)**
   - Reemplaza la lógica JS de `generateMonthlyInvoices()`. Fechas locales, `ON CONFLICT
     DO NOTHING` por atleta+período → idempotente y sin doble-inserción concurrente.
   - Frontend: `services/payments.js` pasa a llamar la RPC.

3. **RPC/servicio de edición y anulación de pago (admin)**
   - `update_payment(id, ...)` y `void_payment(id, reason)` (soft-delete recomendado sobre
     borrado físico, para conservar historia). Registrar auditoría.
   - Frontend: acciones en `PaymentDetailModal` (`index.jsx:101-223`) — hoy sólo lectura.

4. **Unificar "vencido"**
   - Fuente única (decisión A): una vista/RPC que calcule el estado real de deuda por
     atleta alineado al ciclo del kiosco, y que Pagos consuma eso (en vez del
     `payment_date < today` del front). Opcional: `pg_cron` nocturno que materialice
     `status='overdue'` para reporting.

5. **Limpieza**
   - Borrar los 8 componentes muertos: `DateRangeSelector`, `PaymentStatusFilter`,
     `FinancialMetricCard`, `RevenueChart`, `RecentTransactionsFeed`,
     `AutomatedReminderControl`, `PaymentMethodChart`, `OverduePaymentsTable`.
   - Arreglar residuo UTC en `services/payments.js:27,29` (si no queda cubierto por la RPC).

## Decisiones a confirmar ANTES de codear

- **A) "Vencido": ¿criterio único alineado al kiosco** (último pago `paid` + 30d + gracia)
  **o mantener por fecha de la cuota** (`payment_date` de la pending)? → Recomiendo alinear
  al kiosco (una sola verdad). ¿Y materializar con `pg_cron` nocturno o dejar derivado en lectura?
- **B) Idempotencia de cuotas: ¿columna `period` + `unique(athlete_id, period)`** o dedupe
  por `concept`/rango? → Recomiendo columna `period` + único.
- **C) Corrección de pagos: ¿soft-delete (`status='void'`)** vs borrado físico; y auditoría
  ¿campos `updated_by/voided_by` en la fila o **tabla `payment_audit`** dedicada? → Recomiendo
  soft-delete + tabla de auditoría liviana.
- **D) Componentes muertos: ¿los borro los 8**, o querés que reconstruya los gráficos de
  ingresos (RevenueChart/PaymentMethodChart) con datos reales en esta tanda? → Recomiendo borrar
  ahora; charts reales en fase 2.

## Riesgos / cuidados

- **`payments` está en el camino crítico del kiosco.** Cualquier cambio de `status`/valores
  debe mantener la lógica de `kiosk_check_in` (0024) funcionando. Al tocar el enum/CHECK,
  validar que los valores existentes (`pending`/`paid`) pasen.
- **Migraciones aplicadas a mano** (no hay tracking). Al reemplazar funciones vía
  `CREATE OR REPLACE`, comparar contra la definición VIVA en prod (patrón usado en 0023/0024:
  dumpear `prosrc`, cambiar sólo lo necesario). Pedir password de DB al usuario para aplicar,
  y que la RESETEE al terminar.
- **Datos reales en prod**: 15 atletas, 14 pagos, los 15 precargados con cuota pendiente.
  Correr generación/edición con cuidado; probar en transacción con ROLLBACK primero.

## Verificación (definición de "hecho")

- `npm run build` verde.
- Migración aplicada en prod y probada en tx con ROLLBACK (integridad + idempotencia:
  correr "generar cuotas" dos veces → no duplica).
- Editar y anular un pago desde la UI, con auditoría registrada.
- "Vencido" en Pagos coincide con lo que decide el kiosco para el mismo atleta.
- Los 8 componentes muertos borrados; `npm run build` sigue verde.
- Revisión visual del usuario en el dev server (`npm run start`, puerto 4028).
