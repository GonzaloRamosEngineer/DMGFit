#!/usr/bin/env node
// Siembra datos DEMO para el atleta de prueba (prueba.portal@vcfit.app):
//   - ~10 semanas de entrenamientos (rutina A/B/C) con progresión realista
//     -> alimenta "Progreso por ejercicio", historial y mini-gráficos.
//   - Mediciones y tests (peso, % grasa, saltos, sprint, 1RM básicos)
//     -> alimenta radar, HUD del home y la sección Mediciones.
//
// Idempotente: las sesiones sembradas se marcan con notes='__seed_demo__' y se
// borran (cascade a workout_results) antes de re-sembrar; las métricas del
// atleta de prueba se limpian y recargan.
//
// Uso:  node scripts/seed-workout-demo.mjs            (muestra el plan)
//       node scripts/seed-workout-demo.mjs --commit   (escribe en la DB)
//       node scripts/seed-workout-demo.mjs --clear     (solo limpia lo demo)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const CLEAR = process.argv.includes('--clear');
const SEED_NOTE = '__seed_demo__';
const EMAIL = 'prueba.portal@vcfit.app';

const env = { ...process.env };
for (const l of readFileSync(join(__dirname, '.env.import'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const round = (n, step = 1) => Math.round(n / step) * step;
const jitter = (n, pct = 0.04) => n * (1 + (Math.random() * 2 - 1) * pct);
const dateNDaysAgo = (n) => {
  const d = new Date();
  d.setHours(18, 30, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function resolveAthlete() {
  const { data: list } = await sb.auth.admin.listUsers();
  const u = (list?.users || []).find((x) => x.email === EMAIL);
  if (!u) throw new Error(`No existe el usuario de prueba ${EMAIL}. Corré scripts/create-test-login.mjs primero.`);
  const { data: ath } = await sb.from('athletes').select('id').eq('profile_id', u.id).single();
  return ath.id;
}

// Resuelve un ejercicio por palabras clave (prefiere el que tenga media, y
// dentro de esos, el que matchee `prefer` y evite `reject`).
async function findExercise(keywords, { tracking, prefer, reject = [] } = {}) {
  let q = sb.from('exercises').select('id,name,primary_muscle,tracking_type,image_url').ilike('name', `%${keywords}%`).limit(30);
  if (tracking) q = q.eq('tracking_type', tracking);
  const { data } = await q;
  if (!data?.length) return null;
  const withMedia = data.filter((e) => e.image_url);
  const pool = withMedia.length ? withMedia : data;
  const clean = pool.filter((e) => !reject.some((r) => e.name.includes(r)));
  const candidates = clean.length ? clean : pool;
  if (prefer) {
    const hit = candidates.find((e) => e.name.includes(prefer));
    if (hit) return hit;
  }
  return candidates[0];
}

// Plan de ejercicios (nombre de búsqueda + progresión).
const PLAN = [
  { key: 'sentadilla', find: 'Sentadilla', prefer: '(Barra)', reject: ['Búlgara', 'Goblet', 'Salto'], tracking: 'reps_weight', day: 'B', base: 60, inc: 2.5, step: 2.5, sets: [10, 8, 8, 6] },
  { key: 'peso_muerto', find: 'Peso Muerto', prefer: '(Barra)', reject: ['Rumano', 'Piernas Rígidas'], tracking: 'reps_weight', day: 'B', base: 70, inc: 3, step: 2.5, sets: [8, 6, 5] },
  { key: 'gemelos', find: 'Gemelos', prefer: 'Máquina', tracking: 'reps_weight', day: 'B', base: 45, inc: 1.5, step: 2.5, sets: [15, 12, 12] },
  { key: 'banca', find: 'Press de Banca', prefer: '(Barra)', reject: ['Agarre', 'Declive', 'Inclinado'], tracking: 'reps_weight', day: 'A', base: 45, inc: 1.5, step: 1, sets: [10, 8, 8, 6] },
  { key: 'hombros', find: 'Press de Hombros', prefer: '(Barra)', reject: ['Cable'], tracking: 'reps_weight', day: 'A', base: 28, inc: 1, step: 1, sets: [10, 9, 8] },
  { key: 'curl', find: 'Curl de Bíceps', prefer: '(Mancuerna)', reject: ['Inclinado', 'Concentrado'], tracking: 'reps_weight', day: 'A', base: 12, inc: 0.5, step: 1, sets: [12, 10, 10] },
  { key: 'remo', find: 'Remo Inclinado', prefer: '(Barra)', tracking: 'reps_weight', day: 'C', base: 40, inc: 1.5, step: 1, sets: [10, 10, 8, 8] },
  { key: 'dominadas', find: 'Dominadas', prefer: '(Barra)', tracking: 'bodyweight', day: 'C', base: 6, inc: 0.6, sets: [1, 1, 1], reps: true },
  { key: 'bici', find: 'Bicicleta', tracking: 'time_distance', day: 'C', cardio: true },
];

const DAY_TITLES = { A: 'Empuje · Pecho y hombros', B: 'Pierna completa', C: 'Tirón y cardio' };
const WEEKS = 10;
const SESSIONS_PER_WEEK = [{ day: 'A', dow: 1 }, { day: 'B', dow: 3 }, { day: 'C', dow: 5 }];

const METRIC_PLAN = [
  { name: 'Peso Corporal', unit: 'kg', from: 84, to: 78.5, every: 1, dec: true },
  { name: 'Porcentaje Grasa', unit: '%', from: 23, to: 18.2, every: 1, dec: true },
  { name: 'Sentadilla', unit: 'kg', from: 92, to: 118, every: 3, dec: false },
  { name: 'Press Banca', unit: 'kg', from: 60, to: 76, every: 3, dec: false },
  { name: 'Peso Muerto', unit: 'kg', from: 110, to: 140, every: 3, dec: false },
  { name: 'Salto Vertical', unit: 'cm', from: 45, to: 54, every: 2, dec: false },
  { name: 'Sprint 10m', unit: 's', from: 1.95, to: 1.78, every: 2, dec: true },
];

async function clearDemo(athleteId) {
  const { data: sessions } = await sb.from('workout_sessions').select('id').eq('athlete_id', athleteId).eq('notes', SEED_NOTE);
  const ids = (sessions || []).map((s) => s.id);
  if (ids.length) {
    await sb.from('workout_results').delete().in('session_id', ids); // por si el cascade no está
    await sb.from('workout_sessions').delete().in('id', ids);
  }
  await sb.from('metrics').delete().eq('athlete_id', athleteId);
  console.log(`  limpiado: ${ids.length} sesiones demo + métricas del atleta`);
}

async function run() {
  console.log(COMMIT ? '== SEMBRANDO DEMO (--commit) ==' : CLEAR ? '== LIMPIANDO DEMO --' : '== PLAN (dry) ==');
  const athleteId = await resolveAthlete();
  console.log('  atleta:', athleteId);

  // Resolver ejercicios
  const resolved = {};
  for (const p of PLAN) {
    const ex = await findExercise(p.find, { tracking: p.tracking, prefer: p.prefer, reject: p.reject });
    if (!ex) { console.warn(`  ! no encontré ejercicio para "${p.find}" (${p.tracking})`); continue; }
    resolved[p.key] = { ...p, exercise: ex };
  }
  console.log('  ejercicios:', Object.values(resolved).map((r) => `${r.exercise.name}`).join(' · '));

  if (!COMMIT && !CLEAR) {
    console.log(`\n  PLAN: ${WEEKS} semanas × ${SESSIONS_PER_WEEK.length} sesiones = ${WEEKS * SESSIONS_PER_WEEK.length} entrenamientos`);
    console.log(`  MÉTRICAS: ${METRIC_PLAN.map((m) => m.name).join(', ')}`);
    console.log('\n  Ejecutá con --commit para escribir.');
    return;
  }

  await clearDemo(athleteId);
  if (CLEAR) { console.log('LISTO (solo limpieza).'); return; }

  // ── Entrenamientos ──
  let sessionCount = 0;
  let resultCount = 0;
  for (let w = 0; w < WEEKS; w++) {
    for (const { day, dow } of SESSIONS_PER_WEEK) {
      // días atrás: semana (WEEKS-1-w) → cuanto más vieja, más atrás
      const weeksAgo = WEEKS - 1 - w;
      const daysAgo = weeksAgo * 7 + (5 - dow); // aproximación L/M/V
      const start = dateNDaysAgo(daysAgo);
      const durationMin = 45 + Math.round(Math.random() * 25);
      const end = new Date(start.getTime() + durationMin * 60000);

      const exercisesToday = Object.values(resolved).filter((r) => r.day === day);
      if (!exercisesToday.length) continue;

      const { data: ses, error: e1 } = await sb.from('workout_sessions').insert({
        athlete_id: athleteId,
        session_date: ymd(start),
        title: DAY_TITLES[day],
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        status: 'completed',
        notes: SEED_NOTE,
      }).select('id').single();
      if (e1) throw new Error('session: ' + e1.message);
      sessionCount++;

      const rows = [];
      for (const r of exercisesToday) {
        if (r.cardio) {
          const dist = round(jitter(5000 + w * 300), 100);
          rows.push({
            session_id: ses.id, athlete_id: athleteId, exercise_id: r.exercise.id, set_index: 1,
            distance_m: dist, time_sec: round(jitter(1200 + w * 15), 10), created_at: end.toISOString(),
          });
          continue;
        }
        const target = r.base + r.inc * w;
        r.sets.forEach((baseReps, i) => {
          const reps = r.reps
            ? Math.max(3, Math.round(r.base + r.inc * w + (Math.random() * 2 - 1)))
            : Math.max(3, baseReps + (Math.random() < 0.3 ? -1 : 0));
          const load = r.reps ? null : round(jitter(target - i * (r.step || 1)), r.step || 1);
          rows.push({
            session_id: ses.id, athlete_id: athleteId, exercise_id: r.exercise.id, set_index: i + 1,
            reps_done: reps, load_done: load, created_at: end.toISOString(),
          });
        });
      }
      const { error: e2 } = await sb.from('workout_results').insert(rows);
      if (e2) throw new Error('results: ' + e2.message);
      resultCount += rows.length;
    }
  }
  console.log(`  entrenamientos: ${sessionCount} sesiones, ${resultCount} series`);

  // ── Mediciones y tests ──
  const metricRows = [];
  for (const m of METRIC_PLAN) {
    for (let w = 0; w <= WEEKS; w++) {
      if (w % m.every !== 0 && w !== WEEKS) continue;
      const t = w / WEEKS;
      const value = m.from + (m.to - m.from) * t;
      const daysAgo = (WEEKS - w) * 7;
      metricRows.push({
        athlete_id: athleteId,
        name: m.name,
        value: Math.round(jitter(value, 0.015) * 100) / 100,
        unit: m.unit,
        date: ymd(dateNDaysAgo(daysAgo)),
      });
    }
  }
  const { error: e3 } = await sb.from('metrics').insert(metricRows);
  if (e3) throw new Error('metrics: ' + e3.message);
  console.log(`  mediciones: ${metricRows.length} registros (${METRIC_PLAN.length} métricas)`);

  console.log('\n=== DEMO SEMBRADA. Entrá con', EMAIL, '===');
}

run().catch((e) => { console.error(e); process.exit(1); });
