import { supabase } from '../lib/supabaseClient';

export const fetchPlanById = async (planId) => {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) throw error;
  return data;
};

// LÓGICA ROBUSTA: Enrollment > Athlete Link
export const fetchPlanByAthlete = async (athleteId) => {
  try {
    // 1. PRIMER INTENTO: Buscar inscripción ACTIVA en 'enrollments'
    // Usamos maybeSingle() para evitar el error 406 si no hay resultados.
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        enrollment_date,
        plans (*) 
      `)
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .maybeSingle();

    if (enrollError) console.warn("Error checking enrollment:", enrollError);

    // Si encontramos una inscripción activa y tiene el plan asociado, retornamos eso.
    if (enrollment && enrollment.plans) {
      return {
        ...enrollment.plans,
        enrollment_id: enrollment.id,
        enrollment_status: enrollment.status,
        start_date: enrollment.enrollment_date
      };
    }

    // 2. SEGUNDO INTENTO (FALLBACK): Usar la relación directa en tabla 'athletes'
    // Esto salva la UI si 'enrollments' está vacío pero el atleta tiene plan asignado.
    const { data: athlete, error: athleteError } = await supabase
      .from('athletes')
      .select(`
        plan_id,
        plans (*)
      `)
      .eq('id', athleteId)
      .maybeSingle();

    if (athleteError) throw athleteError;

    if (athlete && athlete.plans) {
      return {
        ...athlete.plans,
        enrollment_status: 'implicit', // Indicador de que viene directo del atleta
      };
    }

    return null;

  } catch (err) {
    console.error("Critical error fetching plan:", err);
    return null;
  }
};

export const fetchPlansByCoach = async (coachId) => {
  const { data, error } = await supabase
    .from('plan_coaches')
    .select('plan_id, plans (*)')
    .eq('coach_id', coachId);

  if (error) throw error;

  return (data ?? [])
    .map((entry) => entry?.plans)
    .filter(Boolean);
};