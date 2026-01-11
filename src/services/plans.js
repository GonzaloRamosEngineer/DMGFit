import { supabase } from '../lib/supabaseClient';

export const fetchPlanById = async (planId) => {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchPlanByAthlete = async (athleteId) => {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('plan_id')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .single();

  if (enrollmentError) {
    if (enrollmentError?.code === 'PGRST116') {
      return null;
    }
    throw enrollmentError;
  }

  if (!enrollment?.plan_id) {
    return null;
  }

  return fetchPlanById(enrollment.plan_id);
};

export const fetchPlansByCoach = async (coachId) => {
  const { data, error } = await supabase
    .from('plan_coaches')
    .select('plan_id, plans (*)')
    .eq('coach_id', coachId);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((entry) => entry?.plans)
    .filter(Boolean);
};
