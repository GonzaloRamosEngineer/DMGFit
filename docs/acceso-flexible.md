# Especificación — Acceso flexible (Fase 2.1)

> Reemplaza el modelo de **horarios fijos** por un modelo de **saldo mensual de accesos + cupo en vivo**.
> Decisión de producto validada con el cliente (2026-06).

## 1. Conceptos base

- **Saldo mensual de accesos**: cada cliente compra N accesos/mes = **frecuencia × 4** (ej. 2 días/semana → 8 accesos).
- **Ciclo**: 30 días corridos **desde el pago**. Los accesos no usados **se pierden** al renovar.
- **Un acceso = un día**: si entra dos veces el mismo día, gasta **1 solo**.
- **Turno**: una franja horaria de un plan (ej. Base 18:00–19:00). Cada turno tiene su propio **cupo, definido y editable por el admin (Cris) en cualquier momento** (uno puede ser 5, otro 20).
- **Sin reservas**: el cliente entra cuando quiere/puede, sin avisar. El control es al pasar el DNI; el cupo se resuelve por **orden de llegada**.

## 2. Matcheo de turno

El check-in se atribuye al **turno en curso**: aquel cuyo `start_time <= hora_actual < end_time`, entre los turnos **del plan del cliente**.
- Llegada tarde dentro del turno → **permitida**, con aviso informativo "La clase comenzó a las HH:MM".
- Si **ningún turno está en curso** (hueco entre clases o fuera de horario) → "No hay clase en este horario".

## 3. Reglas del kiosco — ATLETA

Se evalúa en orden y se detiene en el primer NO:

| # | Chequeo | Si falla |
|---|---------|----------|
| 1 | ¿Existe el cliente? (DNI o teléfono) | 🔴 "No te encontramos. Consultá en administración." |
| 2 | ¿Está activo? | 🔴 "Cuenta inactiva. Consultá en administración." |
| 3 | ¿Hay un turno de su plan en curso? | 🔴 "No hay clase en este horario." |
| 4 | ¿Está al día con el pago? (ciclo 30 días + **3 días de gracia**) | 🔴 vencido sin gracia → "Cuota vencida. Regularizá tu pago." · 🟡 vencido en gracia → permite + aviso "Cuota vencida, regularizá (quedan X días)." |
| 5 | ¿El turno tiene lugar? (alumnos que entraron hoy a ese turno vs. cupo; el profe no ocupa lugar) | 🔴 lleno → "Turno completo. Consultar en administración." |
| 6 | ¿Le quedan accesos? (saldo del ciclo) | 🔴 saldo 0 → "Sin accesos disponibles este mes. Consultá en administración." |
| 7 | ✅ Todo OK | 🟢 "¡Bienvenido, [Nombre]! Te quedan N accesos." → **descuenta 1 acceso** |

**Casos especiales:**
- **Llegada tarde** dentro del turno → permitida + aviso de inicio de clase (no bloquea).
- **Segunda entrada el mismo día** → 🟢 "Ya registraste tu acceso de hoy" → entra, **no descuenta** otro acceso.
- **Cliente especial** (amigos/familia) → mismas reglas, solo cambia el precio cobrado.

## 4. Reglas del kiosco — PROFESOR

El profe pasa su DNI para **registrar asistencia** (saber qué días y horarios estuvo presente).
- No consume accesos, no chequea pago, no ocupa cupo.
- Registra presencia con día + hora; si coincide con una clase asignada, la vincula.
- Alimenta un **reporte de asistencia de profesores** para el admin.

## 5. Alta del cliente (cambios)

- **Se elimina** la selección de horarios fijos.
- Se carga: nombre, **DNI (obligatorio)**, **teléfono (obligatorio)**, **email (opcional)**, plan, frecuencia (→ define el saldo), precio (tier o especial) y **primer pago** (arranca el ciclo).
- Queda habilitado para **cualquier turno de su plan** que tenga lugar.

## 6. Cambios técnicos (resumen)

- Reescribir la rama de atleta en `kiosk_check_in`: quitar el candado de "slot fijo asignado"; agregar lookup de **turno en curso por plan** + **cupo en vivo** + consumo del contador (1/día).
- `athlete_monthly_counters` pasa a ser el límite real (se setea en el alta = frecuencia × 4; se renueva cada ciclo).
- `profiles.email` deja de ser `NOT NULL`.
- Cupo editable por turno (admin) en el editor de horarios.
- Relajar el check-in del profesor para registrar presencia aunque no haya turno asignado exacto.

## 7. Pendiente de dato (no de definición)

- **Cupo por turno**: lo carga Cris por cada franja (valor provisorio 10 para pruebas).
