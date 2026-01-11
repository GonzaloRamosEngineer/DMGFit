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
    .from('routines')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};
