// Carga de atletas desde el CSV del formulario (una sola vez).
//   Dry-run (no escribe):   node scripts/import-athletes.mjs
//   Carga real:             node scripts/import-athletes.mjs --commit
//
// Requiere scripts/.env.import (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) y
// scripts/data/athletes.csv. Ambos gitignored.
//
// Qué hace: perfil + atleta (PLAN BASE, tier por visitas/sem) + contador
// mensual + asignación de turnos (día+horario → weekly_schedule). SIN pago.
// Idempotente: saltea DNIs que ya existen. No usa el RPC (que exige is_staff);
// inserta directo con service_role replicando su lógica.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const PLAN_NAME = 'PLAN BASE';

// ── env ──
const env = { ...process.env };
try {
  for (const l of readFileSync(join(__dirname, '.env.import'), 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── helpers ──
const fixEnc = (s) => Buffer.from(String(s ?? ''), 'latin1').toString('utf8');
const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(String(s || '').toLowerCase().trim());

const DAY_MAP = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

// Parser CSV mínimo (respeta comillas y comas internas, "" escapado)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function parseTimestamp(s) {
  // "2026/06/10 11:12:22 a.m. GMT-3" → orden cronológico simple
  const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(a\.m\.|p\.m\.)?/i);
  if (!m) return 0;
  let [, Y, Mo, D, h, mi, se, ap] = m;
  h = Number(h);
  if (ap && /p/i.test(ap) && h < 12) h += 12;
  if (ap && /a/i.test(ap) && h === 12) h = 0;
  return Number(`${Y}${Mo}${D}${String(h).padStart(2, '0')}${mi}${se}`);
}

async function main() {
  // 1) Leer + parsear CSV (con fix de encoding)
  const raw = readFileSync(join(__dirname, 'data', 'athletes.csv'), 'utf8');
  const rows = parseCSV(raw).slice(1); // saltear header

  let records = rows.map((r) => {
    const visits = Number((r[5] || '').match(/\d+/)?.[0] || 0);
    const days = fixEnc(r[6] || '')
      .split(';')
      .map((d) => DAY_MAP[norm(d)])
      .filter((d) => d !== undefined);
    const startTime = (r[7] || '').match(/(\d{1,2}:\d{2})/)?.[1];
    return {
      ts: parseTimestamp(r[0] || ''),
      name: fixEnc(r[1] || '').trim().replace(/\s+/g, ' '),
      dni: String(r[2] || '').replace(/\D/g, ''),
      email: (r[3] || '').trim().replace(/\.com\s+ar$/i, '.com.ar'),
      phone: String(r[4] || '').replace(/\D/g, '') || null,
      visits,
      days,
      startTime: startTime ? `${startTime}:00` : null,
      birth: (r[8] || '').trim() || null,
      gender: fixEnc(r[9] || '').trim() || null,
      emgName: fixEnc(r[10] || '').trim() || null,
      emgPhone: String(r[11] || '').replace(/\D/g, '') || null,
      medical: fixEnc(r[12] || '').trim() || null,
      address: fixEnc(r[13] || '').trim() || null,
    };
  });

  // 2) Dedup por DNI (última respuesta por timestamp)
  const byDni = new Map();
  for (const rec of records) {
    if (!rec.dni) continue;
    const prev = byDni.get(rec.dni);
    if (!prev || rec.ts > prev.ts) byDni.set(rec.dni, rec);
  }
  records = [...byDni.values()].sort((a, b) => a.ts - b.ts);

  // 3) Emails/teléfonos compartidos → el real queda en el primero (por ts), null en el resto (perfil)
  const emailSeen = new Set(), phoneSeen = new Set();
  for (const rec of records) {
    rec.profileEmail = rec.email || null;
    rec.profilePhone = rec.phone;
    const e = norm(rec.email);
    if (e) { if (emailSeen.has(e)) { rec.profileEmail = null; rec.emailShared = true; } else emailSeen.add(e); }
    if (rec.phone) { if (phoneSeen.has(rec.phone)) { rec.profilePhone = null; rec.phoneShared = true; } else phoneSeen.add(rec.phone); }
  }

  // 4) Resolver PLAN BASE + tiers + mapa de turnos
  const { data: plan } = await supabase.from('plans').select('id, name').eq('name', PLAN_NAME).maybeSingle();
  if (!plan) throw new Error(`No encontré el plan "${PLAN_NAME}"`);
  const { data: tiers } = await supabase
    .from('plan_pricing_tiers').select('visits_per_week, price').eq('plan_id', plan.id);
  const tierByVisits = new Map((tiers || []).map((t) => [Number(t.visits_per_week), Number(t.price)]));

  const { data: pss } = await supabase
    .from('plan_schedule_slots')
    .select('weekly_schedule_id, weekly_schedule:weekly_schedule_id ( day_of_week, start_time )')
    .eq('plan_id', plan.id);
  const slotMap = new Map(); // "day|HH:MM" → weekly_schedule_id
  for (const r of pss || []) {
    const w = r.weekly_schedule;
    if (w) slotMap.set(`${w.day_of_week}|${String(w.start_time).slice(0, 5)}`, r.weekly_schedule_id);
  }

  // DNIs ya existentes (idempotencia)
  const { data: existing } = await supabase.from('athletes').select('dni');
  const existingDni = new Set((existing || []).map((a) => String(a.dni || '').replace(/\D/g, '')));

  // 5) Enriquecer + validar
  const today = new Date().toISOString().split('T')[0];
  const startHM = (t) => (t ? t.slice(0, 5) : '');
  for (const rec of records) {
    rec.exists = existingDni.has(rec.dni);
    rec.tierPrice = tierByVisits.get(rec.visits) ?? null;
    rec.slotIds = rec.days.map((d) => slotMap.get(`${d}|${startHM(rec.startTime)}`)).filter(Boolean);
    rec.warnings = [];
    if (rec.tierPrice == null) rec.warnings.push(`sin tier ${rec.visits}x`);
    if (rec.days.length !== rec.visits) rec.warnings.push(`${rec.days.length} días vs ${rec.visits} visitas`);
    if (rec.slotIds.length !== rec.days.length) rec.warnings.push(`turnos: ${rec.slotIds.length}/${rec.days.length} resueltos`);
    if (rec.emailShared) rec.warnings.push('email compartido → null en perfil');
    if (rec.phoneShared) rec.warnings.push('tel compartido → null en perfil');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) rec.warnings.push(`email dudoso: "${rec.email}"`);
  }

  // 6) Reporte
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${COMMIT ? '🔴 CARGA REAL' : '🟡 DRY-RUN (no escribe nada)'} · Plan: ${PLAN_NAME} · ${records.length} atletas únicos`);
  console.log('='.repeat(70));
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  for (const r of records) {
    const dias = r.days.map((d) => DAYS[d]).join('/');
    const flag = r.exists ? '⏭  YA EXISTE' : (r.warnings.length ? '⚠️ ' : '✅');
    console.log(`\n${flag}  ${r.name}  · DNI ${r.dni}`);
    console.log(`     ${r.visits}x  ${dias} ${startHM(r.startTime)}  · tier $${r.tierPrice ?? '—'}  · turnos ${r.slotIds.length}`);
    if (r.warnings.length) console.log(`     ⚠️  ${r.warnings.join(' · ')}`);
  }

  if (!COMMIT) {
    console.log(`\n🟡 Dry-run. Nada se escribió. Corré con --commit para cargar.\n`);
    return;
  }

  // 7) Carga real
  console.log(`\n${'─'.repeat(70)}\nCargando...\n`);
  let ok = 0, skip = 0, fail = 0;
  for (const r of records) {
    if (r.exists) { skip++; console.log(`⏭  ${r.name} (DNI ya existe)`); continue; }
    const profileId = crypto.randomUUID();
    try {
      const { error: pErr } = await supabase.from('profiles').insert({
        id: profileId, full_name: r.name || 'Atleta sin nombre',
        email: r.profileEmail, role: 'atleta', dni: r.dni, phone: r.profilePhone,
      });
      if (pErr) throw new Error(`profile: ${pErr.message}`);

      const { data: ath, error: aErr } = await supabase.from('athletes').insert({
        profile_id: profileId, dni: r.dni, phone: r.phone, plan_id: plan.id,
        visits_per_week: r.visits, plan_tier_price: r.tierPrice, status: 'active',
        join_date: today, birth_date: r.birth, gender: r.gender, address: r.address,
        emergency_contact_name: r.emgName, emergency_contact_phone: r.emgPhone,
        medical_conditions: r.medical,
      }).select('id').single();
      if (aErr) { await supabase.from('profiles').delete().eq('id', profileId); throw new Error(`athlete: ${aErr.message}`); }

      // contador mensual (visitas*4) — como el RPC
      await supabase.from('athlete_monthly_counters').insert({
        athlete_id: ath.id, period_start: today,
        period_end: new Date(Date.now() + 29 * 864e5).toISOString().split('T')[0],
        allowed_sessions: Math.max(r.visits * 4, 1), consumed_sessions: 0,
      });

      // turnos
      if (r.slotIds.length) {
        await supabase.from('athlete_slot_assignments').insert(
          r.slotIds.map((wsid) => ({
            athlete_id: ath.id, weekly_schedule_id: wsid, starts_on: today, is_active: true,
          })),
        );
      }
      ok++; console.log(`✅ ${r.name} (${r.slotIds.length} turnos)`);
    } catch (e) {
      fail++; console.log(`❌ ${r.name}: ${e.message}`);
    }
  }
  console.log(`\n${'─'.repeat(70)}\n✅ ${ok} creados · ⏭ ${skip} ya existían · ❌ ${fail} con error\n`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
