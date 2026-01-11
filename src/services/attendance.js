import { supabase } from '../lib/supabaseClient';

export const fetchAttendanceByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};
