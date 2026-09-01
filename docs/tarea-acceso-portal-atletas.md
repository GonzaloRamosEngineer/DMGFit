# Acceso de atletas al portal — diagnóstico, decisiones y pendientes

_Última actualización: 2026-09-01_

> Estado: **#1, #5 y #6 implementados** en la branch `fix/acceso-atletas-panel`
> (build verde). **Backend YA EN PRODUCCIÓN (2026-09-01):** migraciones `0015` y `0016`
> aplicadas por `db push` (pooler) y Edge Function `reset-athlete-password` deployada;
> verificación e2e más abajo. **Falta mergear a main y desplegar el front** — hasta
> entonces el panel sigue mostrando el botón viejo. Los hallazgos #2, #3, #4 y #7
> quedan abiertos: ver "Pendientes".

---

## El diagnóstico

Se relevó producción en vivo (Admin API de Auth + PostgREST) el 2026-09-01 porque
no se sabía si los atletas estaban usando el portal. Resultado:

| Dato | Valor |
|---|--:|
| Atletas en la base | 73 |
| **Sin login creado** | **0** |
| Login creado el mismo día del alta | 59 |
| Login creado después (import inicial de julio, activado en lote el 05-07) | 14 |
| **Ingresaron alguna vez** | **6** |
| De esos 6, entraron el mismo día en que se les creó la cuenta (pruebas del staff) | 3 |
| Último ingreso de un atleta | 2026-08-06 |

**Conclusión: el acceso funciona y nadie lo usa.** Cada alta desde el panel crea el
usuario de auth en el mismo momento ([`AddAthleteModal.jsx`](../src/pages/athletes-management/components/AddAthleteModal.jsx),
llamada a `activateAthleteLogin`), con identidad `{DNI}@vcfit.internal` y clave = DNI.
No hay nada pendiente de activar a mano.

Los problemas son de otro tipo: **el panel interpretaba mal quién tiene cuenta**, y
**al atleta nunca se le avisa que la suya está lista**.

### Sobre el email interno (no es residuo, es la pieza clave)

Supabase Auth necesita un email único para dar login con contraseña. `@vcfit.internal`
es un dominio inventado que no recibe correo: es el envase que permite que la identidad
real sea el DNI. La pantalla de login traduce DNI → `{DNI}@vcfit.internal` antes de
llamar a Supabase; el atleta nunca lo ve ni lo escribe.

Lo que sí es herencia del modelo viejo es que ese identificador **se copie a
`profiles.email`**, que es el campo de contacto que la UI muestra. De ahí salían los
falsos "sin acceso". Ver hallazgo #2 en Pendientes.

---

## Los 7 hallazgos

| # | Hallazgo | Impacto | Estado |
|---|---|---|---|
| 1 | El botón "Habilitar Acceso" y el "Sin acceso a App" mienten | 36 de 73 fichas | ✅ Resuelto |
| 2 | `profiles.email` guarda la identidad de login; el trigger la repone | raíz de #1 y #3 | ⏳ Pendiente |
| 3 | La heurística del dominio interno está copiada en 6 archivos | deuda | ⏳ Pendiente |
| 4 | Al atleta nunca se le avisa que tiene cuenta | 66 personas | ⏳ Pendiente |
| 5 | La clave es el DNI y nunca se cambia | 73 cuentas | ✅ Resuelto (como aviso) |
| 6 | No se puede restablecer una clave desde el panel | crece con #5 | ✅ Resuelto |
| 7 | El modal del portal habla de un email que ahí no existe | cosmético | ⏳ Pendiente |

---

## Lo implementado

### #1 — El panel lee el acceso real, no el dominio del email

**Decisión:** el acceso se le pregunta a `auth.users`, que es la única fuente de
verdad — el mismo criterio que ya usaba `list_coaches_admin()` para profesores (0002).
Nunca más se deduce del dominio del email.

**Decisión de alcance:** se resolvió con **una función liviana** (`athlete_id → has_login`)
en vez de una RPC de listado completo, para no reescribir los `select` con joins que
ya alimentan Gestión de Atletas y la ficha individual. Menos superficie, menos riesgo.

- Migración [`0015_athletes_login_status.sql`](../supabase/migrations/0015_athletes_login_status.sql):
  `athletes_login_status()` (mapa para listados) y `athlete_login_status(uuid)` (ficha).
  Ambas `security definer`, acotadas con `is_staff()`.
- Migración [`0016_login_status_revoke_public.sql`](../supabase/migrations/0016_login_status_revoke_public.sql):
  cierra el `EXECUTE` que Postgres otorga a **PUBLIC** por defecto al crear una función.
  El `revoke ... from anon` de 0015 no alcanzaba: revocar de un rol no quita el grant
  que ese rol hereda vía PUBLIC. Se detectó verificando contra prod (anon recibía 200,
  con lista vacía por el guard: no hubo filtración). **`list_coaches_admin()` (0002)
  arrastra el mismo grant heredado** — queda registrado como deuda, no se tocó acá.
- `src/services/athletes.js`: `fetchAthletesLoginStatus()` y `fetchAthleteLoginStatus()`.
- Gestión de Atletas: el email interno ya no se muestra como `"Sin acceso a App"`; si no
  hay email de contacto, la tarjeta muestra el **DNI**, que es el dato útil. `needsActivation`
  pasa a ser `hasLogin === false`.
- Ficha individual: el chip pasó de `OFFLINE` a **`Sin acceso`** y aparece solo si la base
  confirma que no hay usuario de auth. El botón "Habilitar Acceso", igual.
- El detalle de la ficha muestra **"Sin email"** en vez del identificador interno.

**Degradación elegida:** si la migración todavía no está aplicada, el estado queda en
`null`/`undefined` y **no se afirma nada** — ni acceso ni falta de acceso. El panel
prefiere no decir nada antes que volver a inventar.

### #5 — Aviso de contraseña (recomendación, NO obligación)

**Decisión (del cliente):** no se fuerza el cambio de contraseña. Se recomienda con un
aviso descartable.

**Decisión técnica:** no hace falta tocar la base. El único momento en que se conoce la
contraseña escrita es el login, así que ahí se compara con el DNI y se deja una marca en
`sessionStorage`. Se recalcula en cada ingreso: el que nunca la cambia lo sigue viendo,
el que la cambia deja de verlo para siempre.

- `login-role-selection/index.jsx`: marca `vcfit:clave-por-defecto` si entró con DNI y
  la clave era su DNI.
- `athlete-portal/components/PasswordNudge.jsx`: el aviso. Descartable ("Ahora no") y
  con enlace a Mi cuenta cuando está en otra sección.
- `MyDataCard.jsx`: al cambiar la clave, limpia la marca y emite `vcfit:clave-actualizada`
  para que el aviso desaparezca en el acto.
- Todos los accesos a `sessionStorage` van en `try/catch` (navegación privada).

### #6 — Restablecer la clave al DNI desde el panel

**Decisión:** se restablece **al DNI**, que es la credencial que el gimnasio ya sabe
comunicarle. **Solo admin** — restablecer la clave de otra persona no es tarea de profesor
(a diferencia de "habilitar acceso", que sí permite `profesor`).

- Edge Function [`reset-athlete-password`](../supabase/functions/reset-athlete-password/index.ts).
  Valida rol admin, exige que el atleta ya tenga login (si no, devuelve 409: lo que
  corresponde es habilitar el acceso) y contempla la cuenta con email real.
- Botón **"Restablecer clave"** en la ficha, visible solo con `hasLogin === true`.
  Confirmación explícita: si tenía clave propia, deja de funcionar.

---

## Cómo se pone en producción

1. **Migraciones:** aplicar `0015_athletes_login_status.sql` y `0016_login_status_revoke_public.sql`.
2. **Edge Function:** `supabase functions deploy reset-athlete-password`.
3. El front no requiere nada especial (deploy normal de Vercel).

Si se deploya el front **sin** la migración, no rompe: el estado de acceso queda en
"no sé" y ni el chip ni el botón aparecen. Si se deploya **sin** la Edge Function, el
botón "Restablecer clave" muestra un error al usarse.

### Verificación en producción (2026-09-01)

Los tres pasos de backend quedaron aplicados y verificados contra prod:

| Prueba | Resultado |
|---|---|
| `athletes_login_status()` con la publishable key (rol `anon`) | `42501 permission denied` — 0016 cerró el grant heredado |
| Idem con un JWT de usuario (`authenticated`) | `200` + lista vacía — el revoke NO rompió a la app y `is_staff()` filtra |
| Idem con la secret key | `200` + lista vacía |
| `reset-athlete-password` sin sesión | `401 "Sesión inválida"` |
| `reset-athlete-password` como no-admin | `403 "Solo el admin puede restablecer contraseñas"` |

**Falta la verificación en pantalla** (requiere sesión real de admin y de atleta): que el
botón desaparezca de las fichas, que aparezca "Restablecer clave", y que el aviso del
portal salga al entrar con DNI.

**Higiene del dato:** la prueba con JWT de usuario usó la cuenta de test
`prueba.portal@vcfit.app`, así que su `last_sign_in_at` quedó con fecha 2026-09-01.
No es un atleta real.

---

## Pendientes

### #4 — Avisarle al atleta que tiene cuenta (el de más valor)

**66 de 72 nunca entraron.** Ningún arreglo del panel mueve ese número: el atleta no
sabe que su cuenta existe. El aviso del alta va dirigido al staff, y no puede ir al
atleta porque su email de login es interno.

- **Canal disponible: 61 de 73 tienen teléfono usable.** Los otros 12 hay que
  resolverlos en el mostrador.
- Propuesta: botón "Enviar acceso por WhatsApp" en la ficha, con `wa.me` y el mensaje
  prearmado (link + DNI + recomendación de cambiar la clave). El patrón ya está
  resuelto en [`PaymentReceipt.jsx`](../src/pages/payment-management/components/PaymentReceipt.jsx)
  (`buildWhatsAppText` + `wa.me`): se copia.
- **Ojo con el orden:** enviar 66 credenciales sin el aviso de contraseña (#5, ya hecho)
  amplifica la exposición en vez de reducirla.

### #2 — Sacar la identidad de login de `profiles.email`

Principio a aplicar: **`profiles.email` = email de contacto, real o `NULL`; nunca el
interno. La identidad de login vive sólo en `auth.users`.**

1. `handle_new_user` ([`0000_baseline.sql:654`](../supabase/migrations/0000_baseline.sql))
   debe dejar de copiar el email cuando termina en `.internal`. **Es el cambio de más
   riesgo del lote**: ese trigger corre en cada alta, y si se rompe, se rompe la creación
   de atletas. Revisar en la misma pasada el matching del perfil fantasma, que también
   depende del dominio interno.
2. Poner `NULL` en los 36 perfiles que hoy tienen el interno (la columna es nullable y
   el índice único convive con varios nulos).

Mientras no se haga, cada alta nueva vuelve a generar el dato que confundía al panel.
El #1 ya no depende de esto (lee `auth.users`), pero el campo sigue sucio.

### #3 — Unificar la heurística del dominio interno

Seis archivos definen su propia lista de dominios: `pdfExport.js`, `EditAthleteModal.jsx`,
`coaches-management/index.jsx`, `athletes-management/index.jsx`, `AthleteHeader.jsx` y
`sync-athlete-login/index.ts`. Extraer un helper único (`isInternalEmail`) y que el
significado sea uno solo: **"no tenemos su email de contacto"**, nunca "no tiene cuenta".

### #7 — El modal del portal y el email de contacto

**Decisión del cliente (2026-09-01): postergado.** Se evaluó y se dejó fuera de esta tanda.

Son dos cosas:
- **(a)** La leyenda de "Editar mis datos" dice _"El DNI, el plan y el email no se editan
  acá"_ ([`MyDataCard.jsx:126`](../src/pages/athlete-portal/components/MyDataCard.jsx)),
  pero el portal no muestra ni edita el email en ningún lado. Debería nombrar sólo el DNI
  y el plan.
- **(b)** Dejar que el atleta cargue su email de contacto desde ahí — sería el mejor lugar
  para conseguir el canal que falta en #4. Requiere migración: `update_my_profile` tiene
  lista blanca de campos y el email no está.

**Advertencia registrada para cuando se retome (b):** `profiles.email` es `UNIQUE`, y en
el padrón hay grupos familiares (6 Rodriguez, 4 Cuellar, 2 Cruz, 2 Flores) con menores
entre ellos. Si dos hermanos cargan el mail del padre, el segundo choca contra el índice.
**Recomendación: guardar el mail de contacto en `athletes.contact_email` (columna nueva,
sin unicidad)**, que además es lo que ya proponía [`plan-login-por-dni.md`](./plan-login-por-dni.md).

### Medición de uso del portal

Hoy la única señal es `auth.users.last_sign_in_at`, que guarda **sólo el último ingreso**:
no hay historial de sesiones y la app no tiene analítica. No se puede saber cuántas veces
entró alguien ni qué miró.

Si se quiere seguir la adopción tras el #4, lo mínimo es un `profiles.last_portal_at` (o
una tabla `portal_visits`) que se escriba al montar el portal.

**Nota de higiene del dato:** los ingresos de prueba del staff con credenciales de un
atleta quedan registrados como actividad real de esa persona. El 2026-09-01 se probó con
la cuenta de un atleta (DNI 48655822) y su ficha pasó de `NUNCA` a esa fecha, subiendo el
contador de 6 a 7. Conviene anotar estas pruebas al hacerlas.

---

## Datos del padrón relevados (2026-09-01)

Útiles para dimensionar los pendientes:

- **Teléfono usable:** 61 de 73 (canal para #4).
- **Email de contacto real:** 37; con identificador interno: 36.
- **Menores de 18:** 18 confirmados, más 28 fichas sin fecha de nacimiento.
- **Con condición médica cargada:** 4. **Con contacto de emergencia:** 28.
- Identidad de login: 72 internas (`{DNI}@vcfit.internal`) + 1 con email real
  (`Atleta Prueba`, cuenta de test).
