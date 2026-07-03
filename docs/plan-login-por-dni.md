# Plan de implementación — Login por DNI (portal del atleta)

> Estado: **DISEÑO** (para ejecutar en otra sesión). No implementado.
> Contexto: muchos clientes **no tienen email**; el DNI es la identidad universal
> (ya se usa en el kiosco). Objetivo: que el atleta entre al portal con **DNI + contraseña**,
> con email real **opcional**. Unifica identidad (kiosco + portal) y elimina la fricción
> actual de activación.

## Por qué
- Supabase Auth es email-based, pero se puede usar un **email interno sintético
  `{DNI}@vcfit.internal`** como "usuario" invisible para el cliente.
- Hoy: `create_full_athlete_atomic` + `handle_new_user` fueron pensados para fantasmas
  con email interno, pero la carga real quedó con email real → el botón "Habilitar cuenta"
  no aparece para email real, y `handle_new_user` **choca** (unique de `profiles.email`)
  si el fantasma tiene el mismo email real que el signup. Login por DNI evita todo esto.

## Modelo objetivo
- Identidad de login = **DNI**. Email interno `{DNI}@vcfit.internal` por debajo (oculto).
- `profiles.email` real = **opcional** (solo recuperación/notificaciones).
- Activación uniforme por DNI (individual o masiva), sin depender de mail.

## Cambios

### A. Base de datos (migración nueva, ej. 0018_login_por_dni.sql)
1. **RPC `activate_athlete_login(p_dni text, p_password text)`** (SECURITY DEFINER, solo staff):
   - Busca el atleta por DNI. Crea el usuario en `auth.users` con email `{DNI}@vcfit.internal`
     y la contraseña dada (usar `auth.admin` desde una Edge Function, o `extensions`/`pgsodium`
     no alcanza → **la creación del usuario auth conviene hacerla server-side con service_role**,
     no desde SQL puro). → **Definir**: Edge Function `activate-athlete` (service_role) que
     crea el user (email interno, `email_confirm:true`, metadata full_name+role) y linkea el
     fantasma. Alternativa sin Edge Function: endpoint/script admin con service_role.
   - Idempotente: si ya existe el user para ese DNI, no duplica.
2. **Arreglar `handle_new_user`**: al linkear el fantasma, si el fantasma tiene `email` que
   colisiona, **primero** setear `email = null` (o interno) en el fantasma / migrar y borrar
   ANTES de insertar el nuevo profile. Orden correcto: (1) migrar athletes/coaches al new.id,
   (2) borrar fantasma, (3) upsert profile new.id. Así nunca choca el unique de email.
3. **Activación masiva**: función/lote que recorre atletas sin `auth.users` y les crea login
   por DNI con una contraseña temporal (o token de primer acceso).

### B. Frontend — pantalla de login (`src/pages/login-role-selection/index.jsx`)
1. Campo **"DNI"** (además de, o en lugar de, email). Toggle "Ingresar con DNI / con email".
2. Al enviar con DNI: `signInWithPassword({ email: `${dni}@vcfit.internal`, password })`.
   Mantener el path de email real para quien lo tenga.
3. Mensajería de error amigable (DNI/contraseña incorrectos).

### C. Frontend — activación (Gestión de Atletas)
1. Mostrar "Habilitar acceso" para **todos** los que no tienen login (no depender de email
   interno/vacío) → nuevo flag real: ¿existe `auth.users` para ese atleta? (traer del backend).
2. Modal de activación por **DNI + contraseña temporal** (sin pedir email). Opción "activar
   todos los pendientes" (masivo) que devuelve la lista de credenciales para repartir.

### D. Import / normalización de los 14 ya cargados
- Setear a los 14 (o a los que no tengan login) el email interno `{DNI}@vcfit.internal` como
  identidad de auth, conservando el email real en un campo aparte si se quiere (o en
  `profiles.email` sólo si es único y real). Definir: ¿el email real va a `profiles.email`
  (único) o a un campo `contact_email` nuevo? → **Recomendado**: agregar `athletes.contact_email`
  (o `profiles.contact_email`) para el email real de contacto, y reservar `profiles.email`
  para la identidad de login (interno o real). Evita el choque de unicidad.

## Decisiones a cerrar antes de codear
- ¿Login **solo** por DNI, o DNI + email (ambos)? (Recomendado: DNI primario, email opcional.)
- ¿Contraseña la pone el admin (temporal) o el cliente en primer acceso (link/token)?
- ¿Dónde guardar el email real de contacto para no chocar con el unique de login?
- ¿Activación masiva ahora (14) o individual on-demand?

## Riesgos
- Crear usuarios auth requiere service_role (server-side): Edge Function o script admin, no
  SQL puro. Definir el mecanismo.
- Tocar `handle_new_user` afecta TODO signup → testear bien (fantasma con email interno,
  con email real, sin fantasma).
- RLS: asegurar que el atleta autenticado por DNI tenga los mismos permisos que hoy.

## Reutilizable que ya existe
- `handle_new_user` (linkeo de fantasma) — ajustar orden.
- Patrón de email interno `@vcfit.internal` ya reconocido en la app (needsActivation).
- RPCs self-service scoped a `auth.uid()` (`get_my_slot_options`/`set_my_slot_preferences`,
  0017) como plantilla para nuevas self-service.
