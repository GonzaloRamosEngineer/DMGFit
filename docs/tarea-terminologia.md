# Tarea dedicada — Unificar terminología (alumno / atleta / cliente / socio)

> Estado: **HECHA** (2026-07-11). Término elegido: **"Atleta"**. Alcance acotado (solo estos 4 términos; jerga de turnos/planes queda para [[tarea-perfil-atleta-simplificar]]). Build verde.

## Problema
La UI mezcla varios términos para la misma entidad (la persona que entrena), lo que da sensación de desprolijidad y confunde.

## Estado real (medido en `src/`)
| Término | Usos | Dónde |
|---|--:|---|
| **atleta / Atleta** | ~288 | Dominante. Gestión de Atletas, rutas, kiosco, etc. |
| **alumno / Alumnos** | 9 | Profesores (`CoachesTable`, `CoachAthletesModal`) y Pagos (`payment-management`: "Alumnos con deuda", "Buscar alumno") |
| **cliente / Cliente** | ~4 | Header `<th>Cliente / Alumno</th>` en Pagos + comentarios |
| **socio / Socio** | ~4 | Menor |
| **member** | ~65 | **Código, NO UI** (`membership_type`, identificadores). Dejar como está. |

Caso emblemático: [payment-management/index.jsx:547](../src/pages/payment-management/index.jsx#L547) → `<th>Cliente / Alumno</th>` usa **dos** términos en una sola celda.

## Fix propuesto
1. **Decidir UN término user-facing** con el cliente. Candidatos:
   - **"Atleta"** → ya es el dominante (menos cambios, ~13 spots a tocar). Suena "fitness/performance".
   - **"Alumno"** o **"Socio"** → capaz más natural para un gimnasio de barrio (pero implica renombrar ~288 usos). Decisión de marca del cliente.
   - **Recomendado:** quedarse con **"Atleta"** salvo que el cliente prefiera fuerte otra cosa (por costo de cambio).
2. **Reemplazar los desvíos** en strings de UI: los 9 "alumno/Alumnos" y los "cliente" → al término elegido. Foco: `CoachesTable.jsx`, `CoachAthletesModal.jsx`, `payment-management/index.jsx` (incluido el `<th>` mezclado).
3. **NO tocar el código interno** (`member`, `athlete`, `membership_type`, nombres de tablas/columnas/props) — es solo un tema de **textos visibles**. Cambiar identificadores es riesgo alto sin beneficio para el usuario.
4. Opcional (prolijidad a futuro): centralizar los textos user-facing en un solo lugar (ya existe `react-i18next` en otros proyectos del usuario; acá no está, así que por ahora es reemplazo directo de strings).

## Cómo cazar todo
```
grep -rin "alumn\|cliente\|socio" src --include="*.jsx" | grep -v "supabaseClient\|createClient"
```
Revisar cada match: si es string visible en la UI → normalizar; si es comentario o identificador → dejar.

## Verificación
`npm run build` verde + revisión visual de Profesores, Pagos y donde aparezcan los términos. Es cambio de texto, riesgo bajo.

## Nota
Parte se solapa con la de-jerga de [[tarea-perfil-atleta-simplificar]] ("Slots"→"Turnos", etc.). Conviene decidir el glosario completo (atleta, turno, plan, acceso, cuota) de una y aplicarlo en ambas.
