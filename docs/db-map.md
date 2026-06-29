# Mapa de la base de datos — DMGFit

> Relevado en vivo (PostgreSQL 17.6, proyecto `plbycllbuwfrkknlbhno`). Fuente de verdad para ajustes quirúrgicos.
> Estado: 33 tablas, 2 vistas, ~26 funciones de usuario.

## 1. Inventario de tablas (filas reales + RLS)

| Tabla | Filas | RLS | Políticas | Clasificación |
|---|--:|:--:|--:|---|
| weekly_schedule | 140 | ✅ | 2 | Core (slots) |
| plan_schedule | 108 | ✅ | 1 | ⚠️ Legacy (texto, no se lee) |
| plan_schedule_slots | 108 | ✅ | 1 | Core |
| access_logs | 24 | ✅ | 4 | Core (kiosco) |
| plan_availability_windows | 22 | 🔴 **OFF** | 0 | Core config — **expuesta** |
| kiosk_reason_codes | 18 | 🔴 **OFF** | 0 | Catálogo — **expuesta** |
| profiles | 15 | ✅ | 5 | Core |
| sessions | 15 | ✅ | 2 | ⚠️ Poco usada |
| plan_pricing_tiers | 12 | ✅ | 1 | Core |
| plan_schedule_slot_coaches | 6 | ✅ | 2 | Core (profe↔turno) |
| athlete_slot_assignments | 10 | ✅ | 2 | Core (cambia con acceso flexible) |
| coaches | 7 | ✅ | 2 | Core |
| metrics_catalog | 7 | ✅ | 2 | ⚠️ leakea a anon (policy permisiva) |
| payments | 7 | ✅ | 3 | Core |
| athletes | 6 | ✅ | 3 | Core — **datos de prueba** |
| class_types | 4 | 🔴 **OFF** | 0 | Catálogo — **expuesta** |
| athlete_monthly_counters | 3 | ✅ | 2 | Core (saldo de accesos) |
| exercises | 3 | ✅ | 3 | ⚠️ leakea a anon |
| plans | 3 | ✅ | 3 | Core |
| routine_exercises | 3 | ✅ | 2 | Legacy (entrenamiento) |
| schedule_coaches | 2 | ✅ | 2 | Core (profe↔turno, kiosco) |
| routines | 1 | ✅ | 2 | Legacy |
| daily_wods | 0 | 🔴 **OFF** | 0 | Huérfana — **expuesta** |
| athlete_routines, attendance, enrollments, notes, performance_metrics, plan_coaches, plan_features, session_attendees, workout_results, workout_sessions | 0 | ✅ | — | Vacías (legacy o sin uso) |

**Vistas:** `metrics` (métricas de salud del atleta), `profiles_public` (perfil público seguro).

## 2. Seguridad — grants y RLS

🔴 **Todas las tablas otorgan `SELECT,INSERT,UPDATE,DELETE,TRUNCATE` a `anon` y `authenticated`** (default de Supabase). El RLS es lo ÚNICO que protege. Excepción correcta: `weekly_schedule` solo da `SELECT` a `authenticated` (modelo a imitar).

**Tablas expuestas a anónimos** (publishable key) — confirmado en vivo:
- **RLS OFF (lectura Y escritura por anon):** `plan_availability_windows`, `kiosk_reason_codes`, `class_types`, `daily_wods`. Un anónimo podría leer, modificar o **borrar** estas tablas.
- **RLS ON pero política permisiva (solo lectura):** `metrics_catalog`, `exercises`.

**Fix quirúrgico** (no rompe la app, que usa rol `authenticated`):
```sql
revoke all on public.plan_availability_windows, public.kiosk_reason_codes,
               public.class_types, public.daily_wods from anon;
-- y revisar/cerrar las políticas permisivas de metrics_catalog y exercises
```
Ninguna contiene datos personales (son catálogos/config), por eso es prioridad media, no crítica.

## 3. Funciones de usuario (RPCs)

**Negocio:** `kiosk_check_in` ⚠️ (a reescribir para acceso flexible), `create_full_athlete_atomic`, `reassign_athlete_slots_atomic`, `save_plan_configuration`, `assign_coach_to_plan_slot`, `unassign_coach_from_plan_slot`, `plan_grid_availability`, `plan_slot_availability`, `coach_planned_hours`.
**Autorización (`security definer`):** `is_admin` ✅ (existe → sirve para separar admin de profe), `is_staff`, `is_coach_of_athlete`, `is_athlete`, `is_coach`, `current_coach_id`, `current_profile_id`, `athlete_id_for_user`, `coach_id_for_user`.
**Identidad/sistema:** `handle_new_user` ✅ (existe en prod, NO está en el repo — es el que usa "Habilitar cuenta"), `set_profiles_identity_normalized`, `only_digits`, `set_updated_at`, `touch_updated_at`, `pssc_resolve_timeslot`, `populate_workout_result_athlete`, `profiles_public_list`.

⚠️ **`kiosk_remaining` NO existe en prod** pero el frontend lo llama (`fetchKioskRemaining` en `services/kiosk.js`) → esa llamada falla. Bug latente a resolver.

## 4. Triggers
- `set_updated_at`/`touch_updated_at` en varias tablas (timestamps).
- `trg_profiles_identity_normalized` (normaliza dni/teléfono en profiles).
- `trg_pssc_resolve_timeslot` (resuelve timeslot de profe↔slot).
- `set_workout_result_athlete` (workout_results).
- (`handle_new_user` cuelga de `auth.users`, fuera del schema public.)

## 5. Conclusiones para los ajustes
1. **Hay datos de PRUEBA** (6 atletas, 7 coaches, 3 planes, 24 accesos, 7 pagos) — no está vacío. Decidir si se limpian antes de cargar los 13 reales.
2. **`is_admin()` ya existe** → fácil endurecer las RPCs sensibles (separar admin de profesor).
3. **`handle_new_user` existe en prod** pero no en el repo → falta versionarlo (junto al baseline).
4. **`kiosk_remaining` falta en prod** → reponerlo o quitar la llamada del frontend.
5. Confirmado muerto/vacío: `enrollments`, `attendance` (el real es `access_logs`), `plan_schedule` (legacy), y el módulo de rutinas/workout.
