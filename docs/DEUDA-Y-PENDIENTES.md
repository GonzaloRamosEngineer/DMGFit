# DMGFit / VC Fit — Inventario de deuda y pendientes

_Relevado el 2026-09-02. Consolida lo disperso en `ESTADO-Y-ROADMAP.md`, los `tarea-*.md`
y verificaciones nuevas contra producción._

> **Cómo leer:** lo marcado **✅ verificado** se comprobó contra la base de producción el
> 2026-09-02. Lo marcado **📄 según doc** viene de la documentación previa y **no** se
> volvió a comprobar. Los seis frentes del roadmap (pagos, edición de datos, migraciones,
> limpieza de demo, higiene técnica, biblioteca) están **cerrados**: lo de abajo es lo que
> quedó afuera o apareció después.

---

## 1. Negocio y plata — lo más urgente

### 1.1 · 23 atletas facturando por debajo de la tarifa vigente 🔴 ✅ verificado

Diferencia: **~$280.000 por mes**. Sobre 74 atletas activos.

| Caso | Cobra | Tarifa | Cuántos |
|---|--:|--:|--:|
| 2x/semana | $50.000 | $60.000 | 13 |
| 3x/semana | $60.000 | $70.000 | 5 |
| 3x/semana | $25.000–$35.000 | $70.000 | 2 |
| 1x/semana | $10.000 | $15.000 | 2 |
| 5x/semana | $80.000 | $90.000 | 1 |

**No es necesariamente un error:** los de $50.000 y $60.000 parecen la lista de precios
anterior, pero los de $25.000/$35.000 podrían ser descuentos deliberados (familiares,
becas). **Requiere que Cris revise caso por caso** y diga cuáles actualizar. El sistema
no distingue "precio viejo" de "descuento acordado" — y esa es, en sí, una carencia del
modelo de datos: no hay campo para registrar un descuento como tal.

Uno de los 23 es `Atleta Prueba` (cuenta de test), así que el neto real son 22.

### 1.2 · $3.595.000 en cuotas pendientes acumuladas ✅ verificado

63 cuotas en estado `pending`, la más vieja del **2026-06-24**. En paralelo hay 74
cuotas cobradas por $4.102.000, la última registrada el **2026-08-25**.

El cron `generate-due-invoices-daily` genera las cuotas solas. No se sabe cuánto de esos
$3,6M es deuda real de atletas y cuánto son cuotas generadas que nunca se cobraron ni se
anularon. **Decisión pendiente de Cris**, no técnica.

📌 **Corrección al roadmap:** decía que Cris "todavía no cargó ningún pago" (audio del
2026-08-05). Ya no es cierto: hay 74 pagos registrados y el último es del 25-ago. La
propuesta de "pausar el cron" pierde sentido con ese dato.

---

## 2. Seguridad

### 2.1 · Un atleta logueado puede borrar tablas de configuración 🟠 ✅ verificado

Probado con una sesión real de atleta (`DELETE` con filtro que no coincide con nada, para
no destruir nada):

| Tabla | Resultado |
|---|---|
| `plan_availability_windows` | 🔴 **HTTP 204 — tiene permiso de borrado** |
| `class_types` | 🔴 **HTTP 204 — tiene permiso de borrado** |
| `daily_wods` | 🔴 **HTTP 204 — tiene permiso de borrado** |
| `kiosk_reason_codes` | HTTP 400 — el filtro no aplica (su PK es `code`, texto), **el permiso no quedó descartado** |

`plan_availability_windows` es configuración del kiosco: si se vacía, se afecta el control
de acceso. Requiere estar logueado y llamar la API a mano — no es trivial, pero los 73
atletas tienen sesión.

**Fix:** prender RLS en esas tablas con policy staff-only, o `revoke` de `authenticated`
dejando sólo `select`.

📌 **Corrección a la doc:** decía que anon podía leerlas y escribirlas. **Ya no**: las
cuatro devuelven 401 a la publishable key (lo cerró la migración que revocó el grant a
`anon`). El agujero que queda es `authenticated`, que es distinto y menos grave.

### 2.2 · `exercises` y `metrics_catalog` se leen sin login 🟢 ✅ verificado

Ambas responden 200 con datos a la publishable key. Son catálogos, **no hay datos
personales**. Prioridad baja; el fix es cambiar la policy de `public` a `authenticated`.

### 2.3 · `list_coaches_admin()` con `EXECUTE` heredado de PUBLIC 🟢 ✅ verificado (indirecto)

Descubierto el 2026-09-01 al verificar la migración 0015: Postgres otorga `EXECUTE` a
`PUBLIC` al crear una función, y `anon` lo hereda. **No hay filtración** — el guard
`is_admin()` interno devuelve lista vacía. La 0016 lo cerró para las funciones nuevas;
`list_coaches_admin` quedó con el grant. Defensa en profundidad, no un agujero.

### 2.4 · La clave de los atletas sigue siendo el DNI 🟠 decisión tomada

Se resolvió como **recomendación, no obligación** (decisión del cliente, 2026-09-01): el
portal avisa pero no fuerza el cambio. Quien no la cambie queda con una credencial que se
dicta en voz alta en el kiosco. Hay 18 menores entre los 73.

**No es un pendiente sino un riesgo aceptado**, pero el cálculo cambia si el portal
llegara a mostrar más datos sensibles que hoy.

---

## 3. Funcionalidad incompleta

| Qué | Detalle | Fuente |
|---|---|---|
| **"Gestión de Clases"** del panel del profe | Vacía: el modelo flexible no usa la tabla `sessions`. Para tener asistencia de alumnos real hay que modelarla sobre el kiosco / `access_logs` | 📄 según doc |
| **Un profe archivado todavía puede fichar** | `kiosk_check_in` identifica por DNI y no chequea `archived_at` | 📄 según doc |
| **Pagos fase 2** | Recordatorios automáticos a deudores, factura fiscal AFIP/ARCA, `pg_cron` opcional | 📄 según doc |
| **No hay creación del primer admin desde la UI** | Se siembra a mano. Bloquea clonar el sistema para un gimnasio nuevo sin intervención técnica | 📄 según doc |
| **El portal está construido y casi nadie lo usa** | 66 de 72 nunca entraron. **Cerrado por decisión**: se avisa de palabra en el mostrador → [`tarea-acceso-portal-atletas.md`](./tarea-acceso-portal-atletas.md) | ✅ verificado |
| **No hay métrica de uso del portal** | `auth.users.last_sign_in_at` guarda sólo el último ingreso; no hay historial ni analítica | ✅ verificado |

---

## 4. Deuda técnica

### 4.1 · Comprobante de pago por WhatsApp — roto en producción 🟠 ✅ verificado

Dos bugs, detalle en [`tarea-pagos.md`](./tarea-pagos.md):

1. **El número va sin código de país.** 56 de 73 teléfonos están guardados con 10 dígitos
   (`3874579668`), y `wa.me` exige formato internacional → WhatsApp abre la pantalla
   genérica en vez del chat. Fix: un helper `waNumber()`.
2. **Los emojis llegan como `�`.** Se descartó código fuente, bundle y `charset` servido
   (los tres correctos). **Causa sin identificar.** Salida barata: sacar los emojis.

Es lo único de este inventario que un cliente real está viendo mal hoy. No está solicitado.

### 4.2 · `profiles.email` guarda la identidad de login 🟢 ✅ verificado

36 de 73 perfiles tienen `{DNI}@vcfit.internal` en el campo de contacto, porque el trigger
`handle_new_user` lo copia en cada alta. **No afecta ninguna pantalla** — se resolvió
enseñándole a la UI a ocultarlo.

**Recomendación explícita: no hacerlo aislado.** No hay beneficio visible y toca el trigger
del alta. Vale la pena sólo junto con el #7b (que el atleta cargue su mail), que necesita el
campo limpio. Análisis completo, incluyendo por qué el riesgo es menor de lo estimado en un
principio, en [`tarea-acceso-portal-atletas.md`](./tarea-acceso-portal-atletas.md).

### 4.3 · Resto

| Qué | Detalle | Fuente |
|---|---|---|
| Heurística del dominio interno duplicada en 6 archivos | Extraer un helper único; el criterio correcto ya está escrito (`has_login`) | ✅ verificado |
| El modal del portal menciona un email que ahí no existe | Una línea, cosmético | ✅ verificado |
| Override de `spacing` en `tailwind.config` | Pisa la escala default (`w-80` = 80px en vez de 20rem); ~575 usos colisionados → [`tarea-config-spacing.md`](./tarea-config-spacing.md) | 📄 según doc |
| Código muerto | `mockData.js`, `PlanForm.jsx` | 📄 según doc |
| Tablas/columnas huérfanas | `attendance` (la real es `access_logs`), `plan_schedule` legacy, `enrollments` vs `athletes.plan_id` | 📄 según doc |
| ~47 ramas `codex/*` sin podar | Higiene de repo | 📄 según doc |
| Media de ejercicios a 180×180 px | Se ve pixelada al agrandar; mitigado topando el display. Fix real = media en alta resolución | 📄 según doc |
| `handle_new_user` busca el perfil viejo por `@dmg.internal` | Dominio que ya no se usa (hoy es `@vcfit.internal`) → ese bloque del trigger está **inerte** | ✅ verificado |

---

## 5. Riesgos operativos y de negocio

- **Los datos dependen de los backups de Supabase.** El baseline `0000` reconstruye el
  **esquema**, no el contenido. Ante un borrado accidental, el esquema vuelve; los atletas,
  pagos y accesos no.
- **Una instancia nueva arranca con `exercises` vacía** (el catálogo era la migración 0020,
  hoy archivada). Si se quiere precargado hay que armar un `seed.sql`.
- **Licencia de la media de ejercicios (Gym Visual):** la atribución es obligatoria y está
  implementada (`MediaCredit.jsx`). **No quitar el crédito** mientras se use esa media. Si
  se revende como SaaS hay que resolver la licencia o migrar a Free Exercise DB (dominio
  público, pero fotos estáticas en vez de GIFs).

---

## 6. Correcciones a la documentación existente

Detectadas en este relevamiento:

| Doc | Decía | Realidad |
|---|---|---|
| `tarea-accesos-desde-inscripcion.md` | "Pendiente para aplicar a prod: correr la 0006" | **Ya aplicada.** El `db push` del 2026-09-01 sólo listó 0015 y 0016, o sea que 0001–0014 están todas trackeadas |
| `ESTADO-Y-ROADMAP.md` | Cris "todavía no cargó ningún pago" | 74 pagos registrados, el último del 2026-08-25 |
| `db-map.md` / memoria | anon puede leer y escribir 4 tablas de catálogo | anon recibe 401; el agujero que queda es `authenticated` |
| `plan-login-por-dni.md` | Estado "DISEÑO, no implementado" | Implementado y en producción (corregido el 2026-09-01) |

---

## Si hubiera que elegir por dónde seguir

1. **1.1 y 1.2** — no son técnicos, son decisiones de Cris, y valen ~$280.000 por mes más
   $3,6M por definir. Todo lo demás junto vale menos.
2. **2.1** — el permiso de borrado del atleta. Es una policy, trabajo acotado.
3. **4.1** — el WhatsApp del comprobante, si molesta a alguien.

El resto es deuda que no está lastimando a nadie hoy.
