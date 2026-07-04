#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultSource = path.join(repoRoot, 'supabase/seeds/exercises_hevy_es.txt');

const args = new Set(process.argv.slice(2));
const getArgValue = (name, fallback = null) => {
  const prefix = `${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};

const SOURCE_FILE = path.resolve(getArgValue('--file', defaultSource));
const PRINT_SQL = args.has('--sql');
const DRY_RUN = args.has('--dry-run') || PRINT_SQL;

const MUSCLE_ALIASES = {
  'Espalda Baja': 'Espalda baja',
  'Espalda Superior': 'Espalda superior',
  'Cuerpo Entero': 'Cuerpo entero',
  Cuádriceps: 'Cuádriceps',
  Biceps: 'Bíceps',
  Bíceps: 'Bíceps',
  Triceps: 'Tríceps',
  Tríceps: 'Tríceps',
  Gluteos: 'Glúteos',
  Glúteos: 'Glúteos',
  Hombros: 'Hombros',
  Pecho: 'Pecho',
  Abdominales: 'Abdominales',
  Cardio: 'Cardio',
  Antebrazos: 'Antebrazos',
  Isquiotibiales: 'Isquiotibiales',
  Pantorrillas: 'Pantorrillas',
  Trapecios: 'Trapecios',
  Aductores: 'Aductores',
  Adductores: 'Aductores',
  Abductores: 'Abductores',
};

const normalizeText = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const slugify = (value = '') =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const titleCase = (value = '') =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const normalizeMuscle = (value = '') => {
  const clean = value.trim().replace(/\s+/g, ' ');
  return MUSCLE_ALIASES[clean] || titleCase(clean);
};

const inferEquipment = (name = '') => {
  const text = normalizeText(name);

  if (text.includes('abdominal bicicleta') || text.includes('abdominales bicicleta')) return 'Peso corporal';
  if (text.includes('con peso anadido')) return 'Peso libre';

  const checks = [
    ['Máquina Smith', ['smith']],
    ['Máquina', ['maquina', 'machine', 'prensa', 'pec deck']],
    ['Cable', ['cable', 'polea']],
    ['Barra', ['barra', 'barbell']],
    ['Mancuerna', ['mancuerna', 'dumbbell']],
    ['Banda', ['banda', 'band']],
    ['Kettlebell', ['kettlebell', 'pesa rusa']],
    ['Suspensión', ['suspension', 'trx']],
    ['Banco', ['banco']],
    ['Balón medicinal', ['ball slam', 'balon', 'medicine']],
    ['Cajón', ['cajon', 'box jump', 'salto al cajon']],
    ['Bicicleta', ['bicicleta', 'bike']],
    ['Cinta', ['cinta', 'treadmill']],
    ['Remo ergómetro', ['remo ergometro', 'rowing machine']],
  ];

  const hit = checks.find(([, tokens]) => tokens.some((token) => text.includes(token)));
  if (hit) return hit[0];

  if (text.includes('peso corporal') || text.includes('bodyweight')) return 'Peso corporal';
  return 'Peso corporal';
};

const inferCategory = (muscle, name) => {
  const text = normalizeText(`${muscle} ${name}`);
  if (text.includes('cardio') || text.includes('aerobics') || text.includes('boxeo')) return 'cardio';
  if (text.includes('estiramiento') || text.includes('stretch')) return 'stretching';
  if (text.includes('movilidad') || text.includes('mobility')) return 'mobility';
  return 'strength';
};

const inferTrackingType = (category, equipment, name) => {
  const text = normalizeText(name);
  if (category === 'cardio') return 'time_distance';
  if (text.includes('plancha') || text.includes('hold') || text.includes('hollow')) return 'time';
  if (equipment === 'Peso corporal') return 'bodyweight';
  return 'reps_weight';
};

const parseExercises = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== 'Todos los ejercicios');

  if (lines.length % 2 !== 0) {
    throw new Error(`La lista debe tener pares ejercicio/músculo. Líneas útiles: ${lines.length}`);
  }

  const bySlug = new Map();
  for (let index = 0; index < lines.length; index += 2) {
    const name = lines[index];
    const primaryMuscle = normalizeMuscle(lines[index + 1]);
    const equipment = inferEquipment(name);
    const category = inferCategory(primaryMuscle, name);
    const trackingType = inferTrackingType(category, equipment, name);
    const slug = slugify(name);

    if (!slug || bySlug.has(slug)) continue;

    bySlug.set(slug, {
      name,
      slug,
      muscle_group: primaryMuscle,
      primary_muscle: primaryMuscle,
      secondary_muscles: [],
      equipment,
      category,
      tracking_type: trackingType,
      aliases: [],
      source: 'hevy_style_seed_es',
      is_custom: false,
    });
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
};

const sqlString = (value) => {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const printSql = (rows) => {
  const values = rows
    .map((row) => `  (${[
      sqlString(row.name),
      sqlString(row.slug),
      sqlString(row.muscle_group),
      sqlString(row.primary_muscle),
      "ARRAY[]::text[]",
      sqlString(row.equipment),
      sqlString(row.category),
      sqlString(row.tracking_type),
      "ARRAY[]::text[]",
      sqlString(row.source),
      'false',
    ].join(', ')})`)
    .join(',\n');

  process.stdout.write(`insert into public.exercises (
  name,
  slug,
  muscle_group,
  primary_muscle,
  secondary_muscles,
  equipment,
  category,
  tracking_type,
  aliases,
  source,
  is_custom
)
values
${values}
on conflict (slug) do update set
  name = excluded.name,
  slug = excluded.slug,
  muscle_group = excluded.muscle_group,
  primary_muscle = excluded.primary_muscle,
  equipment = excluded.equipment,
  category = excluded.category,
  tracking_type = excluded.tracking_type,
  source = excluded.source,
  is_custom = excluded.is_custom,
  updated_at = now();
`);
};

const upsertSupabase = async (rows) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan SUPABASE_URL/VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY.');
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const chunkSize = 100;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client
      .from('exercises')
      .upsert(chunk, { onConflict: 'slug', ignoreDuplicates: false });

    if (error) throw error;
  }
};

const rows = await parseExercises(SOURCE_FILE);

if (PRINT_SQL) {
  printSql(rows);
} else if (DRY_RUN) {
  process.stdout.write(JSON.stringify({ source: SOURCE_FILE, count: rows.length, sample: rows.slice(0, 8) }, null, 2));
} else {
  await upsertSupabase(rows);
  process.stdout.write(`Seed de ejercicios completado: ${rows.length} ejercicios.\n`);
}
