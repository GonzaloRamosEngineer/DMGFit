import { supabase } from '../lib/supabaseClient';

export const fetchSessionsByCoach = async (coachId) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('coach_id', coachId)
    .order('date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchSessionsByPlan = async (planId) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('plan_id', planId)
    .order('date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchUpcomingSessionsByAthlete = async (athleteId, limit = 3) => {
  const today = new Date().toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .contains('attendees', [athleteId])
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
};
