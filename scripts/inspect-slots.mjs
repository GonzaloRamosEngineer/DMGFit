// Lista los turnos configurados por plan (plan_schedule_slots ⋈ weekly_schedule).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
try {
  for (const l of readFileSync(join(__dirname, '.env.import'), 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const { data: plans } = await supabase.from('plans').select('id, name').order('name');
for (const plan of plans) {
  const { data: pss, error } = await supabase
    .from('plan_schedule_slots')
    .select('weekly_schedule_id, weekly_schedule:weekly_schedule_id ( day_of_week, start_time, end_time, capacity )')
    .eq('plan_id', plan.id);
  console.log(`\n▸ ${plan.name}  (${pss?.length || 0} turnos)  ${error ? 'ERR ' + error.message : ''}`);
  (pss || [])
    .map((r) => r.weekly_schedule)
    .filter(Boolean)
    .sort((a, b) => (a.day_of_week - b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time)))
    .forEach((w, i) => console.log(`   ${DAYS[w.day_of_week]} ${String(w.start_time).slice(0,5)}-${String(w.end_time).slice(0,5)} cap=${w.capacity}`));
}

// Conteos generales
const { count: athletesCount } = await supabase.from('athletes').select('*', { count: 'exact', head: true });
const { count: wsCount } = await supabase.from('weekly_schedule').select('*', { count: 'exact', head: true });
console.log(`\nAtletas existentes: ${athletesCount} · weekly_schedule filas: ${wsCount}`);
