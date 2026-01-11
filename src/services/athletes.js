import { supabase } from '../lib/supabaseClient';

export const fetchAthleteById = async (athleteId) => {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', athleteId)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchAthletesByCoach = async (coachId) => {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('coach_id', coachId);

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchAthleteNotes = async (athleteId) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};
