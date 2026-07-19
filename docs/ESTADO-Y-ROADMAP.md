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

## Consistencia UI/UX — pasada integral (2026-07-19, mergeado a main)

Merge `feat/kpi-cards-unificadas` (d97be63), 3 commits lógicos. Motivación: la
administradora real no es técnica → cero jerga, cero datos inventados, una sola
línea visual. Verificado con Playwright (login real del atleta de prueba + previews).

1. **KPIs unificados**: nuevo `ui/StatCard` (+ `ui/InfoTip`, burbuja "?" con
   explicación en castellano llano por métrica) reemplaza los 4 estilos de cards
   de Dashboard/Atletas/Planes/Caja. Se eliminaron datos falsos de Atletas
   (retención 95% hardcodeada, sparklines/chips decorativos) → métricas reales
   ("Nuevos este mes", "Al día con la cuota"). Dashboard: "Sesiones Hoy" (siempre
   0) → "Profesores hoy" (fichajes reales del kiosco); "Accesos hoy" cuenta solo
   atletas. Adiós "Basado en access_logs".
2. **Fin de las superficies navy "tech"**: header de PlanCard, MyPlanCard (sin
   "ID: MBR-…"), card Disciplina, AthleteRadar, LevelCard de Logros y el gradiente
   negro del hero de fuerza pasaron a la línea clara con tokens. **Dedup**: la
   membresía completa vive solo en Cuenta; Inicio usa `MembershipSummaryCard`
   compacto con link a Cuenta.
3. **Sección Progreso alineada**: gramática única de headers (kicker + título,
   ícono `bg-info-light`), chip activo azul primary (se fueron los negros),
   azul de dato `#0066FF` (marca) en los 3 charts, copy des-techificado
   ("Performance Analytics/Inteligencia Biométrica" → "Evolución de tus métricas",
   "Volatilidad" → "Variación", sin "Datos Verificados").

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
- **Sync del login al cambiar DNI**: Edge Function `sync-athlete-login` (service_role,
  solo admin, idempotente). Si el atleta tiene login interno (`{DNI}@vcfit.internal`),
  re-apunta el email de auth al DNI nuevo; si la clave seguía siendo el DNI viejo
  (se verifica con un sign-in efímero), la resetea al DNI nuevo — **no pisa claves
  personalizadas**. Cuentas con email real no se tocan (su login no depende del DNI).
  Si la sync falla, los datos igual quedan guardados y el modal avisa con un warning.
  Deploy: `supabase functions deploy sync-athlete-login` (requiere cuenta con acceso
  a la org de "Fitness DMG"). Los profes siguen con la limitación vieja (su edición
  no sincroniza auth); si molesta, se generaliza esta misma función.

### 3) Endurecimiento / continuidad 🟢 — RESUELTO (2026-07-19)
Diagnóstico confirmado con evidencia: las migraciones `0001–0026` **no** reconstruían
la base (asumían ~25 tablas troncales creadas a mano que sólo vivían en
`schema_snapshot.sql` → `supabase db reset` fallaba en la 0001), y
`supabase_migrations.schema_migrations` **no existía** en prod (todo aplicado a mano).

- **`supabase/migrations/0000_baseline.sql`**: foto consolidada y versionada del esquema
  `public` de producción (`supabase db dump`) — **35 tablas, 224 funciones, 86 policies,
  8 triggers públicos** — **+ el trigger `on_auth_user_created` sobre `auth.users`**
  (que el dump de `public` no captura; los triggers de `storage.*` son internos de
  Supabase y se omiten a propósito). **Verificado**: `supabase db reset` reconstruye una
  base local **idéntica a prod** (conteos 1:1). Reemplaza al viejo `schema_snapshot.sql`
  (eliminado).
- **`0001–0026` archivadas** en `supabase/_archive_migrations/` (historial preservado,
  fuera de la cadena activa). Se crearon además `supabase/config.toml` y `.gitignore`
  del CLI (no existían).
- **Tracking registrado en prod**: `supabase migration repair --status applied 0000`
  creó `supabase_migrations.schema_migrations` e insertó el baseline. `migration list`
  muestra **Local 0000 = Remote 0000** → `supabase db push` queda confiable, sin drift.
- **Lo que habilita** (ver también el mapa de acceso a la DB): clonar el sistema para un
  gimnasio nuevo (`db push` sobre un proyecto vacío = esquema listo, sin datos),
  reconstrucción de esquema ante desastre (los **datos** siguen dependiendo de backups),
  y mover la base a otra cuenta/proyecto. **Nota de producto**: el catálogo de ejercicios
  (era la 0020, ahora archivada) NO viene en el baseline → una instancia nueva arranca con
  `exercises` vacía; si se quiere precargado hay que armar un `seed.sql`.

### 4) Limpieza de demo 🟢 — RESUELTO (2026-07-19)
Rama `chore/demo-cleanup-y-informe-pdf` (build verde, −1633 líneas netas). Se eliminó todo
lo decorativo/muerto y se **enchufó el informe PDF por atleta** (que era lo único con valor):
- **Informe PDF del atleta** ✅: `utils/pdfExport.js` reescrito a un único `generateAthletePDF`
  limpio (marca **VC Fit** — el nombre de este cliente — azul `#0066FF`) con **datos reales**
  (identidad, membresía, estado de cuota, asistencia, saldo de accesos por kiosco, últimos
  pagos — sin secciones inventadas de rendimiento/salud). Conectado a un **botón real
  "Exportar PDF"** en el header del perfil (antes el menú de 3 puntos era `console.log`). Se
  borraron los generadores huérfanos `generatePaymentReportPDF`/`generateDashboardSummaryPDF`.
- **Menú de 3 puntos del perfil** (muerto: `console.log`) → eliminado; "Agendar" renombrado a
  **"Turnos"** (asigna/modifica turnos semanales) + botón "Exportar PDF".
- **3 puntos del directorio** (Editar/Mensaje, muertos y redundantes) → eliminados; queda el
  cobro rápido "$" (real) y un chevron "Ver perfil".
- **`BulkActionsBar`** (solo limpiaba selección) → eliminada junto con los checkboxes de
  selección que la alimentaban.
- **Páginas demo huérfanas** `pdf-export-center` (hardcode "Carlos Rodríguez") y
  `performance-analytics` (`mockPeers`) → **eliminadas** (rutas, imports, breadcrumb).
  También se borró el componente `QuickActionMenu` (ya sin usos).
- **Botón "Exportar" decorativo del portal del atleta** (Progreso · "Evolución de tus
  métricas", en `PerformanceChart.jsx`, sin `onClick`) → eliminado.

> **Marca = "VC Fit"** (el nombre de este cliente). La solución es multi-cliente: para cada
> gimnasio se re-brandea. No unificar a otro nombre.

### 5) Higiene técnica 🟡
- Deps muertas: `axios`, `redux`+`@reduxjs/toolkit`, `d3` (0 imports). `framer-motion` SÍ se usa.
- **Cero tests** (no hay runner; quedan `@testing-library/*` huérfanas).
- Bundle monolítico ~4MB sin code-splitting.
- Licencia de media de ejercicios (Gym Visual) — decisión de negocio si se revende como SaaS.

---

## Orden sugerido hacia "Fase 2 cerrada"

1. ~~**Pagos confiables**~~ ✅ hecho (2026-07-19) — ver `tarea-pagos.md`.
2. ~~**Editar datos personales del atleta**~~ ✅ hecho (2026-07-19) — cierra el requisito 3.
3. ~~**Baseline + tracking de migraciones**~~ ✅ hecho (2026-07-19) — `0000_baseline.sql` + `migration repair` en prod.
4. ~~**Limpieza de demo**~~ ✅ hecho (2026-07-19) — rama `chore/demo-cleanup-y-informe-pdf` + informe PDF enchufado.
5. **Higiene**: sacar deps muertas (`axios`, `redux`+`@reduxjs/toolkit`, `d3`), code-splitting, tests mínimos sobre RPCs críticas.
