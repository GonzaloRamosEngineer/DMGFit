// Activa el login (por DNI) de los atletas cargados.
//   Dry-run:   node scripts/activate-athletes.mjs
//   Real:      node scripts/activate-athletes.mjs --commit
//
// Cada atleta obtiene un usuario de auth con email interno {DNI}@vcfit.internal
// y contraseña = su DNI. Se re-apunta el atleta al nuevo perfil y se borra el
// fantasma. El email real (si existe) queda en profiles.email para contacto/UI.
// Idempotente: saltea atletas ya linkeados a un usuario de auth (incl. el de prueba).

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

// Atletas + su perfil actual
const { data: aths, error } = await s
  .from('athletes')
  .select('id, dni, profile_id, profiles:profile_id ( full_name, email )')
  .not('dni', 'is', null)
  .order('id');
if (error) { console.error('❌', error.message); process.exit(1); }

const plan = [];
for (const a of aths) {
  const dni = String(a.dni).replace(/\D/g, '');
  if (!dni) continue;
  const alreadyLinked = authIds.has(a.profile_id); // su perfil YA es un usuario de auth
  const internalEmail = `${dni}@vcfit.internal`;
  const existsInternal = authByEmail.has(internalEmail);
  plan.push({
    athleteId: a.id, ghostId: a.profile_id, dni,
    name: a.profiles?.full_name || 'Atleta',
    realEmail: a.profiles?.email || null,
    internalEmail,
    action: alreadyLinked ? 'skip-activo' : (existsInternal ? 'link-existente' : 'crear'),
  });
}

console.log(`\n${'='.repeat(64)}`);
console.log(`${COMMIT ? '🔴 ACTIVACIÓN REAL' : '🟡 DRY-RUN'} · ${plan.length} atletas · contraseña inicial = DNI`);
console.log('='.repeat(64));
for (const p of plan) {
  const tag = p.action === 'skip-activo' ? '⏭  ya activo' : p.action === 'link-existente' ? '🔗 linkear' : '✅ crear login';
  console.log(`${tag}  ${p.name}  · DNI ${p.dni}  ${p.realEmail ? '· mail ' + p.realEmail : '· sin mail'}`);
}

if (!COMMIT) {
  console.log(`\n🟡 Dry-run. Nada se escribió. Corré con --commit para activar.\n`);
  process.exit(0);
}

console.log(`\n${'─'.repeat(64)}\nActivando...\n`);
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
        user_metadata: { full_name: p.name, role: 'atleta' },
      });
      if (cErr) throw new Error(`createUser: ${cErr.message}`);
      authUid = data.user.id;
      await sleep(500); // trigger handle_new_user
    }

    // Re-apuntar el atleta al nuevo perfil (login)
    if (p.ghostId !== authUid) {
      const { error: upErr } = await s.from('athletes').update({ profile_id: authUid }).eq('id', p.athleteId);
      if (upErr) throw new Error(`repoint athlete: ${upErr.message}`);
      // Borrar fantasma viejo (ya sin FK)
      await s.from('profiles').delete().eq('id', p.ghostId);
    }
    // Completar el perfil nuevo: nombre + dni + email real (si hay) para contacto/UI
    const patch = { full_name: p.name, dni: p.dni };
    if (p.realEmail && !p.realEmail.includes('@vcfit.internal')) patch.email = p.realEmail;
    await s.from('profiles').update(patch).eq('id', authUid);

    ok++;
    console.log(`✅ ${p.name} · login: DNI ${p.dni} / clave ${p.dni}`);
  } catch (e) {
    fail++; console.log(`❌ ${p.name} (DNI ${p.dni}): ${e.message}`);
  }
}
console.log(`\n${'─'.repeat(64)}\n✅ ${ok} activados · ⏭ ${skip} ya activos · ❌ ${fail} con error`);
console.log(`\n📋 Los socios entran en /login con:  usuario = DNI  ·  contraseña = DNI\n`);
