# DMGFit — Estado y Roadmap

_Última actualización: 2026-07-19_

> Documento vivo de estado del producto y prioridades. Complementa la doc técnica
> del repo (CLAUDE.md, `docs/tarea-*.md`) y el análisis de auditoría.

---

## Veredicto global

DMGFit es un **MVP operativo real y en uso**. El núcleo de operación diaria
(kiosco de acceso, horarios, registro de atletas) está sólido. Desde la última
auditoría se sumó superficie de producto (biblioteca de ejercicios con media,
registrador de entrenamiento estilo Hevy, portal del atleta por secciones,
progreso de fuerza) y se cerraron varios bloqueantes transversales.

**El rol profesor y Pagos — antes los frentes más flojos — quedaron resueltos (🟢).**
Pagos pasó de "sólo registro" a **fuente de verdad contable** (migración 0026 en prod:
integridad, generación idempotente, editar/anular con auditoría, "vencido" unificado con
el kiosco, comprobante no-fiscal con WhatsApp y gráficos reales). Ver
[`docs/tarea-pagos.md`](./tarea-pagos.md). El próximo frente es **editar datos personales
del atleta** (requisito 3).

---

## Scorecard por requisito de negocio

| # | Requisito | Estado | Nota |
|---|---|---|---|
| 1 | Ordenar operación (kiosco) | 🟢 Listo | Sólido, en uso |
| 2 | Horarios / planificación | 🟢 Listo | — |
| 3 | Registros de atletas | 🟢 Resuelto | Alta + **edición de datos personales** desde el perfil (2026-07-19) |
| 4 | Pagos | 🟢 Resuelto | Fuente de verdad (0026 en prod) → `tarea-pagos.md` |
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

### 1) Pagos confiables 🟢 — RESUELTO (2026-07-19)
Ver [`docs/tarea-pagos.md`](./tarea-pagos.md) (sección "ESTADO: RESUELTO"). Migración 0026
en prod: integridad + generación idempotente vía RPC + editar/anular con auditoría +
"vencido" alineado al kiosco (verificado con datos reales) + comprobante no-fiscal con
WhatsApp + gráficos reales. **Fase 2 pendiente:** recordatorios automáticos a deudores,
factura fiscal AFIP/ARCA, `pg_cron` opcional.

### 2) Editar datos personales del atleta 🟢 — RESUELTO (2026-07-19)
Modal "Editar Datos" en el perfil del atleta (botón en el panel de detalles del header,
solo admin): nombre, DNI, email de contacto, teléfono, nacimiento, género, dirección,
ciudad, contacto de emergencia y condiciones médicas.
- El DNI se actualiza **en sincronía** en `profiles` (kiosco/login) y `athletes` (legacy),
  con validación de unicidad (mismo criterio que el alta + índice `uq_profiles_dni_normalized`).
- Si no hay email real, se conserva el interno `{DNI}@vcfit.internal` alineado al DNI nuevo.
- **Limitación conocida** (igual que en profes): si el atleta ya tenía login activado y se
  le cambia el DNI, el kiosco toma el nuevo de inmediato pero el login a la app sigue
  siendo con el DNI anterior (el email de auth no se toca — requeriría service_role /
  edge function). El modal lo advierte al editar el DNI.

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

1. ~~**Pagos confiables**~~ ✅ hecho (2026-07-19) — ver `tarea-pagos.md`.
2. ~~**Editar datos personales del atleta**~~ ✅ hecho (2026-07-19) — cierra el requisito 3.
3. **Baseline + tracking de migraciones** (continuidad) — **próximo**.
4. **Limpieza de demo** (pdf-export, performance-analytics, BulkActionsBar).
5. **Higiene**: sacar deps muertas, code-splitting, tests mínimos sobre RPCs críticas.
