import { supabase } from '../lib/supabaseClient';

export const fetchRoutineById = async (routineId) => {
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .eq('id', routineId)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchRoutinesByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('athlete_routines')
    .select(`
      id,
      athlete_id,
      routine_id,
      start_date,
      status,
      routines (
        *,
        routine_exercises (
          id,
          order_index,
          prescribed_sets,
          prescribed_reps,
          prescribed_load,
          prescribed_time_sec,
          notes,
          exercises (*)
        )
      )
    `)
    .eq('athlete_id', athleteId)
    .order('start_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((assignment) => ({
      ...(assignment.routines || {}),
      assignment_id: assignment.id,
      start_date: assignment.start_date,
      assignment_status: assignment.status,
      athlete_id: assignment.athlete_id,
      routine_exercises: (assignment.routines?.routine_exercises || [])
        .slice()
        .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0)),
    }))
    .filter((routine) => routine.id);
};
