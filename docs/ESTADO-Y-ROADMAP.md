# DMGFit — Estado y Roadmap

_Última actualización: 2026-07-18_

> Documento vivo de estado del producto y prioridades. Complementa la doc técnica
> del repo (CLAUDE.md, `docs/tarea-*.md`) y el análisis de auditoría.

---

## Veredicto global

DMGFit es un **MVP operativo real y en uso**. El núcleo de operación diaria
(kiosco de acceso, horarios, registro de atletas) está sólido. Desde la última
auditoría se sumó superficie de producto (biblioteca de ejercicios con media,
registrador de entrenamiento estilo Hevy, portal del atleta por secciones,
progreso de fuerza) y se cerraron varios bloqueantes transversales.

**El rol profesor — antes el frente más flojo (🔴) — quedó resuelto (🟢)**
(ver detalle abajo). El próximo frente importante es **Pagos** (🟠): funciona
para registrar, pero todavía no es "fuente de verdad contable". Ver
[`docs/tarea-pagos.md`](./tarea-pagos.md) para el plan masticado.

---

## Scorecard por requisito de negocio

| # | Requisito | Estado | Nota |
|---|---|---|---|
| 1 | Ordenar operación (kiosco) | 🟢 Listo | Sólido, en uso |
| 2 | Horarios / planificación | 🟢 Listo | — |
| 3 | Registros de atletas | 🟡 Listo con huecos | Falta **editar datos personales** ya cargados |
| 4 | Pagos | 🟠 Registra, no es fuente de verdad | **Próximo frente** → `tarea-pagos.md` |
| 5 | Profesores | 🟢 Resuelto | Login, panel, vista entrenador, asistencia, seguimiento |

---

## Rol profesor — RESUELTO (2026-07-18)

Migraciones **0023, 0024, 0025** (todas aplicadas a prod y verificadas).

- **Login por DNI** (mismo esquema que atletas): los 7 profes tienen acceso.
  Los 5 sin datos recibieron **DNI provisorio** (`99000101`–`99000105`, clave = DNI),
  editables desde la pantalla de Profesores.
- **Vista entrenador** en el perfil del atleta: ve asistencia/rendimiento/salud/
  accesos/notas y **puede cargar notas**; NO ve pagos; no edita plan ni da de baja.
  (Se arregló el bug de "Ver Perfil" → `/unauthorized`.)
- **Panel "Mi Panel"** rediseñado a una sola pantalla: "Todos los atletas" (scroll
  interno) + rail (Mi Asistencia, Mis Turnos, Gestión de Clases, Notas). Sidebar con
  Mi Panel primero. Se quitó "Planes" (confuso) y el botón demo "Analytics".
- **Seguimiento de atletas** (`coach_athlete_follows`): tabs Todos/Siguiendo, botón
  seguir/dejar de seguir por atleta (many-to-many por profesor).
- **Asistencia flexible del profe** en el kiosco: ficha con su DNI cuando llega,
  tenga o no turno asignado (registra "cuándo vino"); se ve en "Asistencia Profes".
- **Seguridad**: `is_staff()` ya no habilita a un profesor a ejecutar RPCs de admin;
  los 3 RPCs sensibles (`create_full_athlete_atomic`, `save_plan_configuration`,
  `reassign_athlete_slots_atomic`) exigen `is_admin` (0023).

**Pendiente menor del rol profesor:** "Gestión de Clases" (asistencia de alumnos por
sesión) sigue vacía porque el modelo flexible no usa la tabla `sessions`; se dejó como
está. Si se quiere asistencia de alumnos real, hay que modelarla sobre el kiosco/`access_logs`.

---

## Frentes abiertos (prioridad)

### 1) Pagos confiables 🟠 — PRÓXIMO
Ver [`docs/tarea-pagos.md`](./tarea-pagos.md). Resumen: generación de cuotas manual y
no idempotente, "vencido" sólo derivado en el front (y con criterio distinto al del
kiosco), no se puede editar/borrar un pago, sin CHECK de monto, 8 componentes muertos.

### 2) Editar datos personales del atleta 🟡
Hoy se puede cambiar plan/frecuencia/horarios y dar de baja, pero **nombre/DNI/tel/
email/dirección no tienen form de edición**. (Nota: la pantalla de **profes** sí quedó
con DNI/teléfono editables; el de **atletas** no.)

### 3) Endurecimiento / continuidad 🟠🟡
- **Sin `0000_baseline.sql`**: el esquema troncal sólo vive en `schema_snapshot.sql`
  (dump). No se puede reconstruir la base desde cero de forma versionada.
- **Migraciones sin tracking**: no existe `supabase_migrations.schema_migrations`;
  se aplican a mano (riesgo de drift). Van hasta la **0025**.

### 4) Limpieza de demo 🟡
- `performance-analytics`: mezcla `mockPeers` con datos reales. **Ya no es alcanzable
  desde el panel del profesor** (se quitó el botón "Analytics"), pero la ruta admin sigue.
- `pdf-export-center`: datos hardcodeados ("Carlos Rodríguez", "487 atletas").
- `BulkActionsBar` (acciones masivas de atletas): decorativa (sólo limpia selección).

### 5) Higiene técnica 🟡
- Deps muertas: `axios`, `redux`+`@reduxjs/toolkit`, `d3` (0 imports). `framer-motion` SÍ se usa.
- **Cero tests** (no hay runner; quedan `@testing-library/*` huérfanas).
- Bundle monolítico ~4MB sin code-splitting.
- Licencia de media de ejercicios (Gym Visual) — decisión de negocio si se revende como SaaS.

---

## Orden sugerido hacia "Fase 2 cerrada"

1. **Pagos confiables** (`tarea-pagos.md`) — mayor peso para el cliente.
2. **Editar datos personales del atleta** (chico, cierra el requisito 3).
3. **Baseline + tracking de migraciones** (continuidad).
4. **Limpieza de demo** (pdf-export, performance-analytics, BulkActionsBar).
5. **Higiene**: sacar deps muertas, code-splitting, tests mínimos sobre RPCs críticas.
