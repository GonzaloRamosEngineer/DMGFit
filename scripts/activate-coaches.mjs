// Activa el login (por DNI) de los PROFESORES/coaches, igual que los atletas.
//   Dry-run:   node scripts/activate-coaches.mjs
//   Real:      node scripts/activate-coaches.mjs --commit
//
// Cada profe sin login obtiene un usuario de auth con email interno
// {DNI}@vcfit.internal y contraseña = su DNI. Se re-apunta coaches.profile_id
// al nuevo perfil y se borra el fantasma. Idempotente (saltea los ya linkeados).
//
// Los profes sin DNI reciben un DNI PROVISORIO (990001xx) que el admin luego
// edita al real desde la pantalla de Profesores. OJO: cambiar el DNI por pantalla
// actualiza el kiosco (que busca por profiles.dni), pero el LOGIN queda con el DNI
// original hasta volver a correr este script.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const env = { ...process.env };
for (const l of readFileSync(join(__dirname, '.env.import'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const s = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Usuarios de auth existentes
const { data: list } = await s.auth.admin.listUsers({ perPage: 1000 });
const authIds = new Set((list?.users || []).map((u) => u.id));
const authByEmail = new Map((list?.users || []).map((u) => [String(u.email || '').toLowerCase(), u.id]));

// DNIs ya usados (para no colisionar al asignar provisorios)
const { data: allProfiles } = await s.from('profiles').select('dni').not('dni', 'is', null);
const usedDnis = new Set((allProfiles || []).map((p) => String(p.dni).replace(/\D/g, '')).filter(Boolean));

// Coaches + su perfil actual
const { data: coaches, error } = await s
  .from('coaches')
  .select('id, profile_id, phone, profiles:profile_id ( full_name, email, dni, phone )')
  .order('id');
if (error) { console.error('❌', error.message); process.exit(1); }

let provBase = 99000101;
const nextProvisional = () => {
  while (usedDnis.has(String(provBase))) provBase++;
  const v = String(provBase);
  usedDnis.add(v);
  return v;
};

const plan = [];
for (const c of coaches) {
  const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
  const name = prof?.full_name || 'Profesor';
  const alreadyLinked = authIds.has(c.profile_id);
  let dni = String(prof?.dni || '').replace(/\D/g, '');
  const isProvisional = !dni;
  if (isProvisional && !alreadyLinked) dni = nextProvisional();
  const internalEmail = dni ? `${dni}@vcfit.internal` : null;
  const existsInternal = internalEmail ? authByEmail.has(internalEmail) : false;
  plan.push({
    coachId: c.id, ghostId: c.profile_id, dni, name, isProvisional,
    phone: prof?.phone || c.phone || null,
    realEmail: prof?.email && !prof.email.includes('.internal') ? prof.email : null,
    internalEmail,
    action: alreadyLinked ? 'skip-activo' : (existsInternal ? 'link-existente' : 'crear'),
  });
}

console.log(`\n${'='.repeat(66)}`);
console.log(`${COMMIT ? '🔴 ACTIVACIÓN REAL' : '🟡 DRY-RUN'} · ${plan.length} profes · contraseña inicial = DNI`);
console.log('='.repeat(66));
for (const p of plan) {
  const tag = p.action === 'skip-activo' ? '⏭  ya activo' : p.action === 'link-existente' ? '🔗 linkear' : '✅ crear login';
  const prov = p.isProvisional ? ' (DNI PROVISORIO — editar al real)' : '';
  console.log(`${tag}  ${p.name}  · DNI ${p.dni || '—'}${prov}`);
}

if (!COMMIT) {
  console.log(`\n🟡 Dry-run. Nada se escribió. Corré con --commit para activar.\n`);
  process.exit(0);
}

console.log(`\n${'─'.repeat(66)}\nActivando...\n`);
let ok = 0, skip = 0, fail = 0;
for (const p of plan) {
  if (p.action === 'skip-activo') { skip++; continue; }
  try {
    let authUid;
    if (p.action === 'link-existente') {
      authUid = authByEmail.get(p.internalEmail);
    } else {
      const { data, error: cErr } = await s.auth.admin.createUser({
        email: p.internalEmail, password: p.dni, email_confirm: true,
        user_metadata: { full_name: p.name, role: 'profesor' },
      });
      if (cErr) throw new Error(`createUser: ${cErr.message}`);
      authUid = data.user.id;
      await sleep(500); // trigger handle_new_user
    }

    // Re-apuntar el coach al nuevo perfil (login) y borrar fantasma
    if (p.ghostId !== authUid) {
      const { error: upErr } = await s.from('coaches').update({ profile_id: authUid }).eq('id', p.coachId);
      if (upErr) throw new Error(`repoint coach: ${upErr.message}`);
      await s.from('profiles').delete().eq('id', p.ghostId);
    }
    // Completar el perfil nuevo (rol profesor + dni + teléfono para kiosco/UI)
    const patch = { full_name: p.name, role: 'profesor', dni: p.dni };
    if (p.phone) patch.phone = p.phone;
    if (p.realEmail) patch.email = p.realEmail;
    await s.from('profiles').update(patch).eq('id', authUid);

    ok++;
    console.log(`✅ ${p.name} · login: DNI ${p.dni} / clave ${p.dni}${p.isProvisional ? '  (provisorio)' : ''}`);
  } catch (e) {
    fail++; console.log(`❌ ${p.name} (DNI ${p.dni}): ${e.message}`);
  }
}
console.log(`\n${'─'.repeat(66)}\n✅ ${ok} activados · ⏭ ${skip} ya activos · ❌ ${fail} con error`);
console.log(`\n📋 Los profes entran en /login con:  usuario = DNI  ·  contraseña = DNI\n`);
