# scripts/ — herramientas operativas (una sola vez / mantenimiento)

Scripts de Node (ESM) para cargas y mantenimiento contra Supabase usando la
**service_role key**. Se corren a mano desde la raíz del proyecto: `node scripts/<archivo>.mjs`.

## Requisitos (NO se commitean — gitignored)
- **`scripts/.env.import`** con las credenciales:
  ```
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
  ```
- **`scripts/data/`** para CSVs con datos personales (PII).

> ⚠️ La service_role key saltea RLS: es de uso local/administrativo. No la subas al repo.

## Scripts

| Script | Qué hace |
|---|---|
| `inspect-schema.mjs` | Lista planes, tiers y columnas de tablas clave (diagnóstico). |
| `inspect-slots.mjs` | Lista los turnos configurados por plan (`plan_schedule_slots` ⋈ `weekly_schedule`). |
| `import-athletes.mjs` | Carga atletas desde `data/athletes.csv` (dedup por DNI, plan/tier, turnos como preferencia, sin pago). Dry-run por defecto; `--commit` para escribir. |
| `activate-athletes.mjs` | Crea el **login por DNI** de los atletas (email interno `{DNI}@vcfit.internal`, contraseña = DNI) y linkea el perfil. Idempotente. Dry-run; `--commit` para activar. |
| `create-test-login.mjs` | Crea un atleta de PRUEBA con login para validar el portal. `--delete` para borrarlo. |

## Flujo típico de carga de socios nuevos (desde el formulario)
1. Poner el CSV exportado en `scripts/data/athletes.csv`.
2. `node scripts/import-athletes.mjs` (revisar dry-run) → `--commit`.
3. `node scripts/activate-athletes.mjs` (revisar) → `--commit` (les da login por DNI).
4. Comunicar a los socios: **entrar con su DNI (usuario y contraseña)**.
