# Kiosco de Control de Acceso — Casos y mensajes

Referencia completa de **todas las casuísticas** que puede devolver el kiosco (`/access-control`),
con el color/pantalla que ve la persona, el mensaje en pantalla, el código que queda en el
**Historial de Accesos** y si el intento se registra.

> Fuente: RPC `kiosk_check_in` (migración `0001_kiosk_flexible_access.sql`) + pantalla `access-control`.
> Zona horaria: **America/Argentina/Buenos_Aires**. Regla base: **1 acceso = 1 día**.

## Cómo identifica a la persona
1. Se ingresa **DNI o teléfono** (solo dígitos; el teclado del kiosco o un lector).
2. Busca el perfil por **DNI**, luego por **teléfono**, luego en la tabla de atletas.
3. Según el rol resuelve la rama **Profesor** o **Atleta**.
4. **Todos los intentos quedan registrados** en el historial (incluso los no encontrados, que guardan el DNI/teléfono tipeado).

## Leyenda de pantallas (colores)

| Pantalla | Color | Cuándo | ¿Entra? |
|---|---|---|---|
| **¡BIENVENIDO!** | 🟢 Verde | Acceso normal | Sí |
| **ATENCIÓN** — "Acceso con Excepción" | 🟡 Ámbar | Entra, pero con un aviso | Sí |
| **NO TE ENCONTRAMOS** | 🔵 Azul (neutro) | No está en el sistema | No (registra) |
| **ACCESO DENEGADO** | 🔴 Rojo | Bloqueo real | No (registra) |

---

## Atletas

### ✅ Entra en verde (SUCCESS)

| Caso | Código | En pantalla | Registro |
|---|---|---|---|
| Todo OK: al día, en horario, con saldo | `OK` | 🟢 ¡BIENVENIDO! · "Te quedan **N** accesos disponibles." | Sí |
| Ya había entrado hoy | `ALREADY_TODAY` | 🟢 ¡BIENVENIDO! · "Te quedan **N** accesos disponibles." *(no descuenta otra vez)* | Sí |

### 🟡 Entra con aviso (WARNING — "Acceso con Excepción")

Todos muestran de base **"¡Bienvenido, {nombre}! Te quedan N accesos."** y le agregan la aclaración correspondiente.
Si además llegó con la clase empezada, suma: *"(La clase comenzó a las HH:MM.)"*.

| Caso | Código | Aclaración que agrega | Registro |
|---|---|---|---|
| Fuera de sus días/horarios asignados | `OK_OFF_SCHEDULE` | "Recordá que tus días/horarios asignados son: **{lista}**." *(o "Recordá venir en tus días y horarios asignados." si no tiene turnos cargados)* | Sí |
| Turno completo (cupo lleno) | `OK_TURNO_FULL` | "El turno está completo, te dejamos pasar igual." | Sí |
| Cuota vencida (pasado el período de gracia) | `OK_OVERDUE` | "Cuota vencida: pasá por administración a regularizar tu pago." | Sí |
| Cuota vencida, dentro de los días de gracia | `OK_GRACE` | "Cuota vencida: regularizá tu pago (quedan **X** días de gracia)." | Sí |
| Nunca registró un pago | `OK_PENDING` | "Cuota pendiente: pasá por administración a registrar tu pago." | Sí |

> **Se combinan.** Si aplican varias a la vez (ej. fuera de horario **y** con cuota vencida), el mensaje suma todas las aclaraciones. El código que queda en el historial es el más importante, con esta prioridad:
> `OK_OVERDUE` → `OK_OFF_SCHEDULE` → `OK_TURNO_FULL` → `OK_GRACE` → `OK_PENDING`.

### 🔴 No entra — Denegado (DENIED)

| Caso | Código | En pantalla | Registro |
|---|---|---|---|
| Sin accesos disponibles este mes | `NO_BALANCE` | 🔴 ACCESO DENEGADO · "Sin accesos disponibles este mes. Consultá en administración." | Sí |
| Cuenta inactiva / dado de baja | `NOT_ACTIVE` | 🔴 ACCESO DENEGADO · "Cuenta inactiva. Consultá en administración." | Sí |

### 🔵 No encontrado — aviso neutro (NOTICE)

| Caso | Código | En pantalla | Registro |
|---|---|---|---|
| Perfil sin ficha de atleta | `ATHLETE_NOT_FOUND` | 🔵 NO TE ENCONTRAMOS · "No te encontramos como atleta. Consultá en administración." | Sí (con el DNI) |

---

## Profesores

La asistencia del profe es **flexible**: ficha cuando llega, tenga o no un turno asignado a esa hora.

| Caso | Código | En pantalla | Registro |
|---|---|---|---|
| Fichaje del día (con o sin turno) | `OK` | 🟢 ¡BIENVENIDO! · "¡Hola, {nombre}! Asistencia registrada." | Sí |
| Ya fichó hoy | `ALREADY_TODAY` | 🟢 ¡BIENVENIDO! · "Ya registraste tu asistencia de hoy. ¡Buena clase!" | Sí |
| Perfil profesor sin ficha en `coaches` | `COACH_NOT_FOUND` | 🔵 NO TE ENCONTRAMOS · "Perfil de profesor sin registro en coaches." | Sí |

---

## Identidad (aplica a cualquiera)

| Caso | Código | En pantalla | Registro |
|---|---|---|---|
| DNI/teléfono que no existe en el sistema | `USER_NOT_FOUND` | 🔵 NO TE ENCONTRAMOS · "No te encontramos. Pasá por recepción." | Sí (guarda el DNI tipeado) |
| No se ingresó nada | `MISSING_IDENTIFIER` | 🔵 NO TE ENCONTRAMOS · "Debes ingresar DNI o teléfono." | Sí |

---

## Resumen: qué se relajó (vs. el kiosco viejo)

| Situación | Antes | Ahora |
|---|---|---|
| Fuera de día/horario (`NO_TURNO`) | 🔴 Denegado | 🟡 Entra con recordatorio |
| Turno completo (`TURNO_FULL`) | 🔴 Denegado | 🟡 Entra con aviso |
| Cuota vencida (`PAYMENT_BLOCKED`) | 🔴 Denegado | 🟡 Entra con aviso |
| Sin accesos del mes (`NO_BALANCE`) | 🔴 Denegado | 🔴 **Sigue denegado** |
| Cuenta inactiva (`NOT_ACTIVE`) | 🔴 Denegado | 🔴 **Sigue denegado** |
| DNI desconocido | 🔴 "Acceso denegado" | 🔵 Aviso neutro (y registra el DNI) |

## Notas y consideraciones

- **En pantalla vs. historial:** en un acceso verde de atleta, el kiosco muestra *"Te quedan N accesos disponibles."* (mensaje amable). El código exacto (`OK`, `ALREADY_TODAY`, etc.) queda en el **Historial de Accesos**. En los accesos con aviso (ámbar) se ve el mensaje completo con las aclaraciones.
- **Cupo del turno:** se calcula por los **accesos concedidos del día** a ese turno; con el kiosco flexible el cupo lleno ya no bloquea, solo avisa.
- **Días de gracia:** por defecto **3** días después del vencimiento de la cuota (parámetro `p_grace_days`).
- **Ciclo de cuota:** 30 días desde el último pago `paid`.
- **Profesor archivado:** al archivar un profe se le **bloquea el login** de la app, pero el kiosco identifica por DNI y **no chequea el archivado**, así que un profe archivado todavía podría fichar en el molinete. Si hace falta bloquearlo también en el kiosco, es un ajuste chico a futuro.
