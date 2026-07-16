import { supabase } from '../lib/supabaseClient';
import { hoyLocal } from '../utils/formatters';

/**
 * Registrador de entrenamiento del atleta sobre workout_sessions / workout_results.
 * Una fila de workout_results por SERIE (set_index): reps_done, load_done (kg),
 * time_sec y distance_m según el tipo de registro del ejercicio.
 */

export const saveWorkout = async ({ athleteId, title, startedAt, endedAt, entries }) => {
  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .insert({
      athlete_id: athleteId,
      session_date: hoyLocal(),
      title: title?.trim() || 'Entrenamiento',
      started_at: startedAt,
      ended_at: endedAt,
      status: 'completed',
    })
    .select('id, title, session_date, started_at, ended_at')
    .single();

  if (sessionError) throw sessionError;

  const rows = [];
  entries.forEach((entry) => {
    entry.sets.forEach((set, index) => {
      if (!set.done) return;
      rows.push({
        session_id: session.id,
        athlete_id: athleteId,
        exercise_id: entry.exercise.id,
        set_index: index + 1,
        reps_done: set.reps === '' ? null : Number(set.reps),
        load_done: set.kg === '' ? null : Number(set.kg),
        time_sec: set.timeSec ?? null,
        distance_m: set.km === '' || set.km == null ? null : Math.round(Number(set.km) * 1000),
      });
    });
  });

  if (rows.length) {
    const { error: resultsError } = await supabase.from('workout_results').insert(rows);
    if (resultsError) {
      // No dejar una sesión vacía si fallaron los resultados.
      await supabase.from('workout_sessions').delete().eq('id', session.id);
      throw resultsError;
    }
  }

  return session;
};

export const fetchRecentWorkouts = async (athleteId, limit = 8) => {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      id, title, session_date, started_at, ended_at, status, notes,
      workout_results (
        id, exercise_id, set_index, reps_done, load_done, time_sec, distance_m,
        exercises ( id, name, image_url, video_url, tracking_type )
      )
    `)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
};

export const fetchExerciseHistory = async (athleteId, exerciseId, limit = 60) => {
  const { data, error } = await supabase
    .from('workout_results')
    .select(`
      id, session_id, set_index, reps_done, load_done, time_sec, distance_m, created_at,
      workout_sessions ( id, title, session_date, started_at )
    `)
    .eq('athlete_id', athleteId)
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Agrupar por sesión, manteniendo el orden (más reciente primero).
  const bySession = new Map();
  (data ?? []).forEach((row) => {
    const key = row.session_id;
    if (!bySession.has(key)) {
      bySession.set(key, {
        sessionId: key,
        title: row.workout_sessions?.title || 'Entrenamiento',
        date: row.workout_sessions?.session_date,
        sets: [],
      });
    }
    bySession.get(key).sets.push(row);
  });
  bySession.forEach((s) => s.sets.sort((a, b) => a.set_index - b.set_index));
  return [...bySession.values()];
};

/**
 * Progreso de fuerza del atleta: todas sus series con fecha de sesión y
 * ejercicio, agrupadas por ejercicio → por sesión, con mejor serie, 1RM
 * estimado (Epley: carga × (1 + reps/30)) y volumen por sesión.
 */
export const fetchStrengthProgress = async (athleteId) => {
  const { data, error } = await supabase
    .from('workout_results')
    .select(`
      exercise_id, set_index, reps_done, load_done, created_at,
      workout_sessions ( session_date ),
      exercises ( id, name, primary_muscle, muscle_group, image_url, video_url, tracking_type, equipment )
    `)
    .eq('athlete_id', athleteId)
    .not('load_done', 'is', null)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const byExercise = new Map();
  (data ?? []).forEach((row) => {
    if (!row.exercises) return;
    const key = row.exercise_id;
    if (!byExercise.has(key)) {
      byExercise.set(key, { exercise: row.exercises, sessions: new Map() });
    }
    const date = row.workout_sessions?.session_date || row.created_at?.slice(0, 10);
    const group = byExercise.get(key);
    if (!group.sessions.has(date)) {
      group.sessions.set(date, { date, bestLoad: 0, best1rm: 0, volume: 0 });
    }
    const s = group.sessions.get(date);
    const load = Number(row.load_done) || 0;
    const reps = Number(row.reps_done) || 0;
    s.bestLoad = Math.max(s.bestLoad, load);
    s.best1rm = Math.max(s.best1rm, reps > 0 ? load * (1 + reps / 30) : load);
    s.volume += load * reps;
  });

  return [...byExercise.values()]
    .map(({ exercise, sessions }) => ({
      exercise,
      points: [...sessions.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    }))
    .sort((a, b) => b.points.length - a.points.length);
};

/** Volumen (kg) de una lista de filas de resultados: Σ carga × reps. */
export const computeVolume = (rows = []) =>
  rows.reduce((total, row) => {
    const load = Number(row.load_done);
    const reps = Number(row.reps_done);
    if (Number.isFinite(load) && Number.isFinite(reps)) return total + load * reps;
    return total;
  }, 0);
