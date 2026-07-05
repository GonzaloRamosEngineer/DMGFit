// Inspección read-only del esquema para preparar la carga de atletas.
// Uso:  node scripts/inspect-schema.mjs
// Requiere: scripts/.env.import con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
//   (ese archivo está gitignored — NO se commitea)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Cargar env (scripts/.env.import) ---
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(__dirname, '.env.import'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* usa process.env */ }
  return env;
}

const env = loadEnv();
const URL = env.SUPABASE_URL || 'https://plbycllbuwfrkknlbhno.supabase.co';
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en scripts/.env.import');
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const line = (s = '') => console.log(s);

async function main() {
  // 1) Planes
  const { data: plans, error: pErr } = await supabase
    .from('plans')
    .select('id, name, status, price, capacity, session_duration_min')
    .order('created_at', { ascending: true });
  if (pErr) throw pErr;

  line('════════════════════════════════════════════');
  line(`PLANES (${plans.length})`);
  line('════════════════════════════════════════════');

  for (const plan of plans) {
    line(`\n▸ ${plan.name}  [${plan.status}]  id=${plan.id}`);

    // Tiers de precio
    const { data: tiers } = await supabase
      .from('plan_pricing_tiers')
      .select('visits_per_week, price')
      .eq('plan_id', plan.id)
      .order('visits_per_week', { ascending: true });
    line('  Tiers (visitas/sem → precio):');
    (tiers || []).forEach((t) => line(`    ${t.visits_per_week}x → $${t.price}`));
    if (!tiers?.length) line('    (sin tiers)');

    // Slots disponibles (weekly_schedule_id + día + hora + cupo)
    const { data: slots, error: sErr } = await supabase.rpc('plan_slot_availability', {
      p_plan_id: plan.id,
    });
    if (sErr) {
      line(`  Slots: ERROR ${sErr.message}`);
      continue;
    }
    line(`  Slots (${slots?.length || 0}):`);
    (slots || [])
      .slice()
      .sort((a, b) => (a.day_of_week - b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time)))
      .forEach((s) => {
        line(`    ${DAYS[s.day_of_week] || s.day_of_week} ${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}  cap=${s.capacity} rem=${s.remaining}  wsid=${s.weekly_schedule_id}`);
      });
  }

  // 2) Columnas de tablas clave (muestro las keys de 1 fila)
  line('\n════════════════════════════════════════════');
  line('COLUMNAS (muestra de 1 fila por tabla)');
  line('════════════════════════════════════════════');
  for (const table of ['profiles', 'athletes', 'athlete_slot_assignments']) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) { line(`\n${table}: ERROR ${error.message}`); continue; }
    line(`\n${table}: ${data?.[0] ? Object.keys(data[0]).join(', ') : '(tabla vacía — no puedo inferir columnas)'}`);
  }

  line('\n✅ Inspección completa.');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
