import { supabase } from '../lib/supabaseClient';

export const fetchSessionsByCoach = async (coachId) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('coach_id', coachId)
    .order('session_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((session) => ({
    ...session,
    date: session?.session_date
  }));
};

export const fetchSessionsByPlan = async (planId) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('plan_id', planId)
    .order('session_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((session) => ({
    ...session,
    date: session?.session_date
  }));
};

export const fetchUpcomingSessionsByAthlete = async (athleteId, limit = 3) => {
  const today = new Date().toISOString();
  const { data, error } = await supabase
    .from('session_attendees')
    .select('sessions (*)')
    .eq('athlete_id', athleteId)
    .gte('sessions.session_date', today)
    .order('session_date', { ascending: true, referencedTable: 'sessions' })
    .limit(limit, { referencedTable: 'sessions' });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((entry) => entry?.sessions)
    .filter(Boolean)
    .map((session) => ({
      ...session,
      date: session?.session_date
    }));
};
