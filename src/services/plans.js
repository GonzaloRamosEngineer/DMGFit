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

    if (enrollError) console.warn('Error checking enrollment:', enrollError);

    if (enrollment && enrollment.plans) {
      return {
        ...enrollment.plans,
        enrollment_id: enrollment.id,
        enrollment_status: enrollment.status,
        start_date: enrollment.enrollment_date,
      };
    }

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
        enrollment_status: 'implicit',
      };
    }

    return null;
  } catch (err) {
    console.error('Critical error fetching plan:', err);
    return null;
  }
};

export const fetchPlansByCoach = async (coachId) => {
  const { data, error } = await supabase
    .from('plan_coaches')
    .select('plan_id, plans (*)')
    .eq('coach_id', coachId);

  if (error) throw error;

  return (data ?? []).map((entry) => entry?.plans).filter(Boolean);
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

export const fetchPlanAvailabilityWindows = async (planId) => {
  const { data, error } = await supabase
    .from('plan_availability_windows')
    .select('id, day_of_week, start_time, end_time, capacity')
    .eq('plan_id', planId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

const timeToMinutes = (value = '') => {
  const [hh = '0', mm = '0'] = String(value).slice(0, 5).split(':');
  return Number(hh) * 60 + Number(mm);
};

const minutesToTime = (minutes) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const expandWindowsToSlots = (windows, sessionDurationMin = 60) => {
  const duration = Math.max(15, Number(sessionDurationMin) || 60);
  const slots = [];

  (windows || []).forEach((window) => {
    const day = Number(window.day_of_week);
    const start = timeToMinutes(window.start_time);
    const end = timeToMinutes(window.end_time);
    const capacity = Math.max(0, Number(window.capacity ?? 0));

    if (!Number.isInteger(day) || day < 0 || day > 6 || end <= start) return;

    for (let cursor = start; cursor + duration <= end; cursor += duration) {
      slots.push({
        day_of_week: day,
        start_time: minutesToTime(cursor),
        end_time: minutesToTime(cursor + duration),
        capacity,
      });
    }
  });

  const unique = Array.from(
    new Map(
      slots.map((slot) => [`${slot.day_of_week}-${slot.start_time}-${slot.end_time}`, slot])
    ).values()
  );

  return unique.sort((a, b) => (a.day_of_week - b.day_of_week) || a.start_time.localeCompare(b.start_time));
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

export const upsertPlanAvailabilityWindows = async (planId, windows) => {
  const normalized = (windows || [])
    .map((window) => ({
      day_of_week: Number(window.day_of_week),
      start_time: String(window.start_time || '').slice(0, 5),
      end_time: String(window.end_time || '').slice(0, 5),
      capacity: Math.max(0, Number(window.capacity ?? 0)),
    }))
    .filter((window) => Number.isInteger(window.day_of_week) && window.day_of_week >= 0 && window.day_of_week <= 6 && window.start_time && window.end_time && window.end_time > window.start_time);

  const { error: delError } = await supabase.from('plan_availability_windows').delete().eq('plan_id', planId);
  if (delError) throw delError;

  if (normalized.length === 0) return [];

  const { data, error } = await supabase
    .from('plan_availability_windows')
    .insert(normalized.map((window) => ({ ...window, plan_id: planId })))
    .select('id, day_of_week, start_time, end_time, capacity');

  if (error) throw error;
  return data ?? [];
};

export const upsertPlanSlots = async (planId, slots) => {
  const normalized = (slots || [])
    .map((slot) => ({
      day_of_week: Number(slot.day_of_week),
      start_time: String(slot.start_time || '').slice(0, 5),
      end_time: String(slot.end_time || '').slice(0, 5),
      capacity: Number(slot.capacity ?? 0),
    }))
    .filter((slot) => Number.isInteger(slot.day_of_week) && slot.day_of_week >= 0 && slot.day_of_week <= 6 && slot.start_time && slot.end_time);

  const { error: delLinksError } = await supabase.from('plan_schedule_slots').delete().eq('plan_id', planId);
  if (delLinksError) throw delLinksError;

  if (normalized.length === 0) {
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

  return createdSchedules ?? [];
};
