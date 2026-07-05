// Crea un ATLETA DE PRUEBA con login, para validar el portal.
//   node scripts/create-test-login.mjs
// Crea: usuario auth (email_confirm) → el trigger crea el profile →
// insertamos athlete (PLAN BASE, 3x) + contador + 3 turnos (L/M/V 09:00).
// Para borrarlo después: node scripts/create-test-login.mjs --delete
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
for (const l of readFileSync(join(__dirname, '.env.import'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const s = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const EMAIL = 'prueba.portal@vcfit.app';
const PASSWORD = 'Prueba1234!';
const DNI = '99000001';
const DELETE = process.argv.includes('--delete');

// buscar user auth existente por email
const { data: list } = await s.auth.admin.listUsers();
const existing = (list?.users || []).find((u) => u.email === EMAIL);

if (DELETE) {
  if (existing) {
    const { data: prof } = await s.from('profiles').select('id').eq('id', existing.id).maybeSingle();
    const { data: ath } = await s.from('athletes').select('id').eq('dni', DNI).maybeSingle();
    if (ath) {
      await s.from('athlete_slot_assignments').delete().eq('athlete_id', ath.id);
      await s.from('athlete_monthly_counters').delete().eq('athlete_id', ath.id);
      await s.from('athletes').delete().eq('id', ath.id);
    }
    await s.auth.admin.deleteUser(existing.id); // borra auth (profile queda por FK? lo limpiamos)
    await s.from('profiles').delete().eq('id', existing.id);
    console.log('🗑️  Atleta de prueba borrado.');
  } else console.log('No existía el atleta de prueba.');
  process.exit(0);
}

let userId;
if (existing) {
  userId = existing.id;
  console.log('ℹ️  El usuario de prueba ya existía, reuso.');
} else {
  const { data, error } = await s.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: 'Atleta Prueba', role: 'atleta' },
  });
  if (error) { console.error('❌ createUser:', error.message); process.exit(1); }
  userId = data.user.id;
  await new Promise((r) => setTimeout(r, 800)); // dar tiempo al trigger
}

// ¿ya tiene athlete?
const { data: existingAth } = await s.from('athletes').select('id').eq('dni', DNI).maybeSingle();
if (existingAth) {
  console.log('\n✅ Login de prueba listo (ya estaba cargado).');
} else {
  const { data: plan } = await s.from('plans').select('id').eq('name', 'PLAN BASE').single();
  const { data: tier } = await s.from('plan_pricing_tiers').select('price').eq('plan_id', plan.id).eq('visits_per_week', 3).maybeSingle();
  const today = new Date().toISOString().split('T')[0];
  const { data: ath, error: aErr } = await s.from('athletes').insert({
    profile_id: userId, dni: DNI, plan_id: plan.id, visits_per_week: 3,
    plan_tier_price: tier?.price ?? null, status: 'active', join_date: today,
    gender: 'Masculino',
  }).select('id').single();
  if (aErr) { console.error('❌ athlete:', aErr.message); process.exit(1); }
  await s.from('athlete_monthly_counters').insert({
    athlete_id: ath.id, period_start: today,
    period_end: new Date(Date.now() + 29 * 864e5).toISOString().split('T')[0],
    allowed_sessions: 12, consumed_sessions: 0,
  });
  // 3 turnos L/M/V 09:00 de PLAN BASE
  const { data: pss } = await s.from('plan_schedule_slots')
    .select('weekly_schedule_id, weekly_schedule:weekly_schedule_id ( day_of_week, start_time )')
    .eq('plan_id', plan.id);
  const wanted = [[1, '09:00'], [3, '09:00'], [5, '09:00']];
  const ids = (pss || []).filter((r) => wanted.some(([d, t]) => r.weekly_schedule.day_of_week === d && String(r.weekly_schedule.start_time).slice(0, 5) === t)).map((r) => r.weekly_schedule_id);
  if (ids.length) {
    await s.from('athlete_slot_assignments').insert(ids.map((wsid) => ({ athlete_id: ath.id, weekly_schedule_id: wsid, starts_on: today, is_active: true })));
  }
  console.log(`\n✅ Atleta de prueba creado (${ids.length} turnos, PLAN BASE 3x).`);
}

console.log('\n══════════════ LOGIN DE PRUEBA ══════════════');
console.log(`  URL:   http://localhost:4028/login`);
console.log(`  Email: ${EMAIL}`);
console.log(`  Pass:  ${PASSWORD}`);
console.log('═════════════════════════════════════════════');
