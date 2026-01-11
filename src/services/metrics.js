import { supabase } from '../lib/supabaseClient';

export const fetchMetricsByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('metrics')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};
