# Tarea dedicada — Simplificar el perfil del atleta (menos ruido para Cris)

> Estado: **LIMPIEZA SEGURA HECHA** (2026-07-12, branch `feat/simplify-athlete-profile`, build verde). Alcance elegido: limpieza reversible, sin borrar features.
> Lo aplicado en `individual-athlete-profile/index.jsx`:
> - De-jerga: "Membresía Estructural"→"Membresía"; "Visitas Totales (Molinete)"→"Ingresos por kiosco"; "Tasa de Asistencia (Clases)"→"Asistencia a clases"; "Slots activos/Slots"→"Turnos activos/Turnos"; "Tier real del atleta"→"Acordado con el atleta"; aviso naranja: "slots/pricing/kiosk"→"turnos/precios/kiosco".
> - Redundancia: eliminado el KPI duplicado "Slots Activos" (queda solo en la tarjeta Membresía). KPI strip pasó a 3 columnas.
> - Resumen: tarjetas Salud y Notas se muestran solo si hay datos (o durante loading). Tab "Rendimiento" se oculta si no hay métricas.
> **Pendiente (decisión de producto, requiere cliente):** ocultar/eliminar tabs avanzadas poco usadas (Rendimiento/Salud/Notas) — ver opciones "Ocultar tabs" y "Agresivo: eliminar", no ejecutadas.

## Contexto
La pantalla **perfil individual del atleta** ([src/pages/individual-athlete-profile/](../src/pages/individual-athlete-profile/), `index.jsx` ~1209 líneas + 9 componentes) está **sobre-construida para un gimnasio de este tamaño**. La estructura es prolija y profesional, pero para el uso real (la admin es **Cris**) muestra **demasiada info**, gran parte vacía. No está rota — está "de más" y suma ruido visual.

## Diagnóstico (observado en un perfil real)
- **Mucho vacío**: "No hay datos de salud", "0 ingresos", "Sin ingresos registrados", "No hay notas", "0% asistencia", "No hay horarios próximos". Secciones que probablemente **nunca se llenen** en el uso real: Rendimiento, Salud (métricas/radar), Notas.
- **Redundancia**: "Slots Activos" aparece **dos veces** (en la tarjeta "Membresía Estructural" y como KPI), ambas en 0. "Saldo Sesiones" y la info del plan se solapan.
- **Jerga técnica** para un admin de gym: "Membresía Estructural", "Visitas Totales (**Molinete**)", "**Tier** real del atleta", "Slots".
- **Bien logrado (conservar)**: la tarjeta de membresía con el aviso naranja ("la reasignación debe hacerse desde este flujo…") es un buen guardarraíl; las tabs (Resumen/Rendimiento/Asistencia/Pagos/Salud/Notas/Accesos) están limpias.

## Qué importa de verdad para el día a día
Lo que Cris necesita ver rápido: **¿está activo y al día con el pago? · ¿cuánto saldo de accesos le queda? · ¿qué horarios tiene? · últimos pagos/accesos.** El resto (analytics de rendimiento, radar de salud) es "nice to have".

## Propuesta de fix
1. **Priorizar** arriba lo esencial (estado, al día/pendiente, saldo de accesos, horarios) — ya está, pero limpiar jerarquía.
2. **Sacar la redundancia** de "Slots Activos" (dejar una sola instancia).
3. **De-jerga**: "Membresía Estructural"→"Membresía"; "Visitas Totales (Molinete)"→"Ingresos por kiosco"/"Visitas"; "Tier real"→"Precio acordado" (ya está en otra tarjeta); "Slots"→"Turnos".
4. **Colapsar/ocultar** las secciones avanzadas mayormente vacías (Rendimiento, Salud, Radar, Notas): o esconderlas detrás de un "Ver más", o mostrarlas solo si tienen datos (`EmptyState` discreto en vez de tarjetas grandes vacías).
5. Confirmar con el cliente **qué secciones realmente usan** antes de borrar (no romper flujos que sí quieran).

## Archivos
- [index.jsx](../src/pages/individual-athlete-profile/index.jsx) (orquesta las tabs y el layout).
- Componentes: `AthleteHeader`, `HealthMetrics`, `MetricCard`, `PerformanceChart`, `AttendanceCalendar`, `PaymentHistory`, `UpcomingSessions`, `CoachNotes`, `ModifyAthleteScheduleModal`.

## Nota
Es **decisión de producto** (qué mostrar) más que técnica. Idealmente validar con el cliente qué usa. No urgente: las secciones vacías no rompen nada, solo agregan ruido. Ver [[tarea-terminologia]] (parte de la de-jerga se solapa) y [[tarea-config-spacing]] (esta pantalla usa `h-64 md:h-80` afectados).
