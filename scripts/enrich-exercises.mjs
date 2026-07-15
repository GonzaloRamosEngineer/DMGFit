#!/usr/bin/env node
// Enriquece el catálogo de ejercicios con media (GIF + thumbnail) e instrucciones
// del dataset exercises-dataset (hasaneyldrm), y agrega ejercicios nuevos curados.
//
// Media © Gym visual — https://gymvisual.com/ (redistribuida con permiso, 180x180).
//
// Requiere: scripts/.env.import (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//           scripts/data/catalog_import.json (mapa consolidado: updates/inserts/media)
//           media local en MEDIA_DIR (images/*.jpg, videos/*.gif)
//
// Uso:  node scripts/enrich-exercises.mjs            (dry-run: no escribe nada)
//       node scripts/enrich-exercises.mjs --commit   (sube media + aplica a la DB)

import { readFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const BUCKET = 'exercise-media';
const MEDIA_DIR = '/private/tmp/claude-502/-Users-gramos-Documents-dev/4fa1f417-c7c0-47e2-bfd4-49ac3f10899c/scratchpad/media';

// ── env ──
const env = { ...process.env };
for (const l of readFileSync(join(__dirname, '.env.import'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const SUPABASE_URL = env.SUPABASE_URL;
const sb = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const imp = JSON.parse(readFileSync(join(__dirname, 'data/catalog_import.json'), 'utf8'));
const publicUrl = (kind, file) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${kind}/${file}`;

// instrucciones: preferimos pasos numerados (uno por línea) para render de lista en la UI
const stepsToText = (steps, fallback) =>
  Array.isArray(steps) && steps.length
    ? steps.map((s) => String(s).trim()).filter(Boolean).join('\n')
    : (fallback || '').trim();

const contentType = (file) => (file.endsWith('.gif') ? 'image/gif' : 'image/jpeg');

async function ensureBucket() {
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) {
    console.log(`  bucket "${BUCKET}" ya existe`);
    return;
  }
  if (!COMMIT) { console.log(`  [dry] crearía bucket público "${BUCKET}"`); return; }
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg', 'image/gif', 'image/png'],
  });
  if (error) throw new Error(`createBucket: ${error.message}`);
  console.log(`  bucket "${BUCKET}" creado (público)`);
}

async function uploadMedia() {
  const files = imp.media; // [[kind, file], ...]
  let up = 0, skip = 0, fail = 0;
  for (let i = 0; i < files.length; i++) {
    const [kind, file] = files[i];
    const path = `${kind}/${file}`;
    const local = join(MEDIA_DIR, kind, file);
    if (!existsSync(local)) { fail++; console.warn(`  ! falta local: ${local}`); continue; }
    if (!COMMIT) { skip++; continue; }
    const body = await readFile(local);
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, body, { contentType: contentType(file), upsert: true });
    if (error) { fail++; console.warn(`  ! upload ${path}: ${error.message}`); }
    else { up++; if (up % 150 === 0) console.log(`  subidos ${up}/${files.length}`); }
  }
  console.log(`  media -> subidos:${up} omitidos(dry):${skip} fallos:${fail}`);
}

async function applyUpdates() {
  const rows = imp.updates;
  let ok = 0, fail = 0;
  for (const u of rows) {
    const patch = {
      image_url: publicUrl('images', u.image_file),
      video_url: publicUrl('videos', u.video_file),
      instructions: stepsToText(u.instruction_steps, u.instructions),
      secondary_muscles: u.secondary_muscles ?? [],
      aliases: u.alias_en ? [u.alias_en] : [],
      updated_at: new Date().toISOString(),
    };
    if (!COMMIT) { ok++; continue; }
    const { error } = await sb.from('exercises').update(patch).eq('id', u.db_id);
    if (error) { fail++; console.warn(`  ! update ${u.db_id}: ${error.message}`); }
    else { ok++; if (ok % 100 === 0) console.log(`  updates ${ok}/${rows.length}`); }
  }
  console.log(`  updates (enriquecidos) -> ok:${ok} fallos:${fail}`);
}

async function applyInserts() {
  const rows = imp.inserts.map((n) => ({
    name: n.name,
    slug: n.slug,
    muscle_group: n.muscle_group,
    primary_muscle: n.primary_muscle,
    secondary_muscles: n.secondary_muscles ?? [],
    equipment: n.equipment,
    category: n.category,
    tracking_type: n.tracking_type,
    aliases: n.alias_en ? [n.alias_en] : [],
    instructions: stepsToText(n.instruction_steps, n.instructions),
    image_url: publicUrl('images', n.image_file),
    video_url: publicUrl('videos', n.video_file),
    source: n.source,
    is_custom: false,
  }));
  if (!COMMIT) { console.log(`  inserts (nuevos) -> ${rows.length} (dry)`); return; }
  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error, count } = await sb
      .from('exercises')
      .upsert(batch, { onConflict: 'slug', ignoreDuplicates: false, count: 'exact' });
    if (error) { fail += batch.length; console.warn(`  ! insert batch ${i}: ${error.message}`); }
    else { ok += batch.length; }
  }
  console.log(`  inserts (nuevos) -> ok:${ok} fallos:${fail}`);
}

(async () => {
  console.log(COMMIT ? '== APLICANDO (--commit) ==' : '== DRY-RUN (sin cambios) ==');
  console.log(`updates:${imp.updates.length}  inserts:${imp.inserts.length}  media:${imp.media.length}`);
  await ensureBucket();
  await uploadMedia();
  await applyUpdates();
  await applyInserts();
  const { count } = await sb.from('exercises').select('*', { count: 'exact', head: true });
  console.log(`Filas en exercises ahora: ${count}`);
  console.log('LISTO.');
})().catch((e) => { console.error(e); process.exit(1); });
