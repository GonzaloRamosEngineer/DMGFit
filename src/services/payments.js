import { supabase } from '../lib/supabaseClient';

export const fetchPaymentsByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};
