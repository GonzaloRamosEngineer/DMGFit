# Tarea dedicada — Bug del config de spacing de Tailwind

> Estado: **RESUELTA (Opción B, 2026-07-11).** Se sacó el override completo de `tailwind.config.js` y se re-auditaron visualmente las 17 pantallas + modales clave + portal atleta + kiosco (login admin `crisalevera@gmail.com` / atleta de prueba `scripts/create-test-login.mjs`). `npm run build` verde.

## Síntoma
Componentes que usan utilidades de ancho/alto/padding esperando el valor **default de Tailwind** salen mal dimensionados (chicos). Casos confirmados a ojo:
- El **Toast** de error salía como una tira vertical (usaba `w-80`, esperaba 320px, salía 80px).
- El **toggle "cobrar ahora"** salía como pastilla vertical (usaba `w-12`, esperaba ~48px, salía 12px).
- Sospechosos fuertes (a verificar visualmente): gráficos `h-64 md:h-80 lg:h-96` (salen 64/80/384px → salto raro en mobile/tablet), buscadores `sm:w-48`/`sm:w-64`, skeletons `w-48`/`w-36`, anillo de asistencia `w-36 h-36`.

## Causa raíz
`tailwind.config.js` (líneas ~80-92) **pisa la escala de `spacing`** de Tailwind con valores en px:
```js
spacing: { '6':'6px','12':'12px','18':'18px','24':'24px','28':'28px',
           '32':'32px','36':'36px','48':'48px','64':'64px','80':'80px','120':'120px' }
```
Como está dentro de `theme.extend`, para las claves que **también existen en el default** (6,12,24,28,32,36,48,64,80) el valor px **sobreescribe** el default en rem. Y como `width/height/padding/margin/gap` derivan de `spacing`, `w-80` pasa de 320px (20rem) a **80px**, `w-12` de 48px a **12px**, etc. `18` y `120` no colisionan (no son claves default). `metrics_catalog`… (no aplica).

## Alcance (medido)
Uso de clases con claves colisionadas (`grep` de `[whpm]-N`, `gap-N`, `space-N`, `translate-N`):
`*-6`→337 · `*-12`→82 · `*-24`→32 · `*-32`→18 · `*-64`→12 · `*-48`→5 · `*-80`→5 · `*-36`→3 · `*-28`→1. **Total ~575 usos.**
→ **NO se puede simplemente borrar el override**: casi toda la app se construyó con estos valores en efecto y muchos "se ven bien" con el px (ej. `p-6`=6px en chips). El problema son solo los que asumieron el default en rem.

## Fix — dos estrategias

### Opción A — Quirúrgica (RECOMENDADA, bajo riesgo)
Dejar el override como está y **cazar solo los spots que asumían el default de Tailwind** (típicamente **dimensiones grandes**: `w-*`/`h-*`/`size-*` con claves 36/48/64/80, y anchos de switches/paneles). Reemplazarlos por **valores arbitrarios** inmunes a la escala: `w-[22rem]`, `w-[46px]`, `h-[256px]`, etc.
- Ya arreglados así: [src/components/ui/Toast/Toast.jsx](../src/components/ui/Toast/Toast.jsx) (`w-[22rem]`) y el toggle en [src/pages/athletes-management/components/AddAthleteModal.jsx](../src/pages/athletes-management/components/AddAthleteModal.jsx) (`w-[46px] h-[26px]`).
- **Cómo cazar:** revisar visualmente las 17 pantallas + grep de `w-64|w-48|w-36|w-80|h-64|h-80` y evaluar caso por caso si el tamaño esperado era grande.

### Opción B — Correcta de fondo (grande, alto riesgo)
Sacar del config las claves que colisionan (6,12,24,28,32,36,48,64,80), dejar que vuelvan los defaults de Tailwind, y **re-auditar los ~575 usos** + revisar visualmente las 17 pantallas para reajustar lo que se corra. Alternativa más limpia: renombrar la escala custom a tokens que NO colisionen (ej. no usar nombres numéricos que pisen el default) y migrar los usos. Mucho trabajo, pero elimina la trampa para siempre.

**Recomendación original:** Opción A (rápida, tapa los casos visibles). **Decisión real del usuario (2026-07-11): se hizo Opción B** — sacar el override y re-auditar visualmente, para eliminar la trampa de fondo en vez de ir parcheando.

## Qué se hizo (Opción B, 2026-07-11)
1. Se borró el bloque `spacing` completo de `tailwind.config.js` (líneas ~80-92) → vuelve la escala default de Tailwind.
2. Auditoría visual con Playwright (login real, admin + atleta de prueba) de las 17 pantallas, 4 modales clave (AddAthleteModal, AddPaymentModal, CreatePlanModal, PlanAvailabilityGridModal), el portal del atleta completo (Inicio/Cuenta/Agenda/Progreso/Coach/Logros, desktop + mobile) y el kiosco (`/access-control`, flujo de validación real).
3. **Único bug real encontrado:** en `Análisis de Rendimiento` → tarjeta "Clasificación de Rendimiento" ([PerformanceLeaderboard.jsx](../src/pages/performance-analytics/components/PerformanceLeaderboard.jsx)), el avatar circular usaba `md:w-12 md:h-12` (clave `12`, antes forzada a 12px por el bug) — al volver a 48px reales, en la columna angosta (`lg:col-span-3`, ~212px de contenido) el nombre del atleta colapsaba a 0px de ancho y su texto se pintaba encima del score. **Fix:** se sacó el badge de rango como círculo aparte y se superpuso como badge pequeño sobre la esquina del avatar (ahorra un elemento + un gap), liberando ~47px para el nombre. Verificado con Playwright que el rectángulo del nombre ya no da 0px.
4. **Resto de las 575 apariciones no rompió nada visible** — la mayoría son paddings/gaps donde el valor default (más grande) simplemente se ve bien o incluso mejor (más aire), no colapsan layouts.
5. Hallazgo aparte, **no relacionado con este bug**, encontrado durante la auditoría: en `professor-dashboard` la tarjeta oscura "Notas del Coach" tenía el `<h3>Notas del Coach</h3>` casi ilegible (texto casi negro sobre fondo casi negro) — bug de cascada CSS (`text-white` en el div padre, pero `@layer base` define `h3 { color: var(--color-text-primary) }` directo sobre el elemento, y una declaración explícita sobre el elemento le gana a un color heredado del padre). **RESUELTO (2026-07-12)**, ver sección siguiente.

## Fixes de seguimiento (2026-07-12, a pedido del usuario tras revisar en su propio navegador)

**1. Bug de contraste en headings dentro de cards oscuras** (no relacionado al spacing, mismo mecanismo CSS en 3 lugares — ver arriba). Se agregó `text-white` directo al heading en:
- `professor-dashboard/index.jsx` — `<h3>Notas del Coach</h3>`.
- `athlete-portal/components/StatsOverview.jsx:98` — `StatCard theme="dark"` (la card "Disciplina" del HUD del portal), el número grande no tenía color propio.
- `athlete-portal/components/UpcomingSessionsCard.jsx` — `NextSessionHero` (hero de próxima sesión), `<h2>{session.time}</h2>` y `<h3>{session.title}</h3>`.
Búsqueda exhaustiva (2 pasadas) confirmó que no quedan más instancias del mismo bug en el resto de cards oscuras.

**2. `athletes-management` — panel "Actividad Reciente" se veía cortado/vacío** (reportado por el usuario con capturas de su navegador). Causa: `RecentActivity.jsx` tenía `overflow-hidden` en el Card sin ningún elemento decorativo que lo necesitara. Por la spec de flexbox, un flex item con `overflow` distinto de `visible` tiene su **automatic minimum size tratado como 0** (en vez de content-based), así que en la columna angosta de la derecha (compartida con el gráfico de Segmentación) el Card se achicaba a ~102px y el resto del contenido real (~465px, los 5 movimientos con nombre/fecha) quedaba invisible sin scrollbar ni ninguna señal de que había más contenido. Fix: se sacó `overflow-hidden` y se agregó `shrink-0` (mismo patrón que la card de Segmentación al lado) — ahora el Card mide su alto real y la columna (que ya tenía `xl:overflow-y-auto`) scrollea correctamente para mostrar toda la actividad.
- **Nota de proceso:** al re-levantar el dev server en esta sesión se usó por error `npm run dev` (no existe; el script correcto es `npm run start`) — como el puerto 4028 ya respondía (servidor del usuario corriendo), no se notó el error hasta que un `pkill` posterior cortó sin querer el dev server del usuario. Ya reiniciado con el script correcto.

## Verificación
`npm run build` verde. Revisión visual completa hecha, incluyendo esta segunda ronda de fixes. Screenshots efímeros en scratchpad de la sesión (no versionados).

## Relacionado
Ver [[tarea-perfil-atleta-simplificar]] (misma pantalla puede tener spots afectados). Config: [tailwind.config.js](../tailwind.config.js).
