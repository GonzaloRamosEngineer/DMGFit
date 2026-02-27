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

export const fetchPlanPricing = async (planId) => {
  const { data, error } = await supabase
    .from('plan_pricing_tiers')
    .select('id, visits_per_week, price')
    .eq('plan_id', planId)
    .order('visits_per_week', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const fetchPlanSlots = async (planId) => {
  const { data, error } = await supabase.rpc('plan_slot_availability', {
    p_plan_id: planId,
  });

  if (error) throw error;
  return data ?? [];
};

export const upsertPlanPricing = async (planId, tiers) => {
  const normalized = Array.from(
    new Map(
      (tiers || [])
        .map((tier) => ({
          visits_per_week: Number(tier.visits_per_week),
          price: Number(tier.price),
        }))
        .filter((tier) => tier.visits_per_week > 0 && Number.isFinite(tier.price))
        .map((tier) => [tier.visits_per_week, tier])
    ).values()
  );

  const { error: delError } = await supabase.from('plan_pricing_tiers').delete().eq('plan_id', planId);
  if (delError) throw delError;

  if (normalized.length === 0) return [];

  const payload = normalized.map((tier) => ({
    plan_id: planId,
    visits_per_week: tier.visits_per_week,
    price: tier.price,
  }));

  const { data, error } = await supabase.from('plan_pricing_tiers').insert(payload).select();
  if (error) throw error;
  return data ?? [];
};

export const upsertPlanSlots = async (planId, slots) => {
  const normalized = (slots || [])
    .map((slot) => ({
      day_of_week: Number(slot.day_of_week),
      start_time: slot.start_time,
      end_time: slot.end_time,
      capacity: Number(slot.capacity ?? 0),
    }))
    .filter((slot) => Number.isInteger(slot.day_of_week) && slot.day_of_week >= 0 && slot.day_of_week <= 6 && slot.start_time && slot.end_time);

  const { data: previousLinks, error: prevError } = await supabase
    .from('plan_schedule_slots')
    .select('weekly_schedule_id')
    .eq('plan_id', planId);
  if (prevError) throw prevError;

  const previousIds = (previousLinks || []).map((row) => row.weekly_schedule_id);

  const { error: delLinksError } = await supabase.from('plan_schedule_slots').delete().eq('plan_id', planId);
  if (delLinksError) throw delLinksError;

  if (normalized.length === 0) {
    if (previousIds.length > 0) {
      await supabase.from('weekly_schedule').delete().in('id', previousIds);
    }
    return [];
  }

  const { data: createdSchedules, error: scheduleError } = await supabase
    .from('weekly_schedule')
    .insert(normalized)
    .select('id, day_of_week, start_time, end_time, capacity');

  if (scheduleError) throw scheduleError;

  const links = (createdSchedules || []).map((schedule) => ({
    plan_id: planId,
    weekly_schedule_id: schedule.id,
  }));

  if (links.length > 0) {
    const { error: linkErr } = await supabase.from('plan_schedule_slots').insert(links);
    if (linkErr) throw linkErr;
  }

  if (previousIds.length > 0) {
    await supabase.from('weekly_schedule').delete().in('id', previousIds);
  }

  return createdSchedules ?? [];
};
