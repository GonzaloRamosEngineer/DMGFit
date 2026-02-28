import { supabase } from '../lib/supabaseClient';

/**
 * Consulta un atleta por su ID
 */
export const fetchAthleteById = async (athleteId) => {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', athleteId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Consulta atletas asignados a un profesor
 */
export const fetchAthletesByCoach = async (coachId, { status = 'active' } = {}) => {
  let query = supabase
    .from('athletes')
    .select('*')
    .eq('coach_id', coachId);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
};

/**
 * Consulta notas de un atleta
 */
export const fetchAthleteNotes = async (athleteId) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

/**
 * VERIFICACIÓN DE DNI: Evita duplicados antes de intentar el alta
 */
export const checkDniExists = async (dni) => {
  const { data, error } = await supabase
    .from('athletes')
    .select('id')
    .eq('dni', dni)
    .maybeSingle();
  
  if (error) return false;
  return !!data;
};

/**
 * ALTA INTEGRAL DE ATLETA (Corregido)
 * Soluciona: join_date null constraint y profiles_email_key duplicate
 */
export const createFullAthlete = async (athleteData) => {
  try {
    // 1. Validaciones Previas de Negocio
    const exists = await checkDniExists(athleteData.dni);
    if (exists) return { success: false, error: "El DNI ya existe en el sistema." };

    if (!athleteData.plan_id) {
      return { success: false, error: "Debes seleccionar un plan obligatorio." };
    }

    const normalizedEmail = athleteData.email?.trim() || "";
    const isInternal = !normalizedEmail || normalizedEmail.includes('.internal');
    const finalEmail = isInternal 
      ? `sin_email_${athleteData.dni}@dmg.internal` 
      : normalizedEmail;

    // 2. Verificar si el email ya existe en PROFILES para evitar el error UNIQUE
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', finalEmail)
      .maybeSingle();

    if (existingProfile) {
      return { success: false, error: "Este correo ya está registrado en el sistema." };
    }

    const profileId = crypto.randomUUID();

    // 3. Crear Perfil Fantasma
    const { error: pErr } = await supabase.from('profiles').insert({
      id: profileId,
      full_name: athleteData.full_name,
      email: finalEmail,
      role: 'atleta'
    });
    if (pErr) throw pErr;

    // 4. Crear Atleta (Blindando los campos NOT NULL detectados por SQL)
    const { data: newAthlete, error: aErr } = await supabase.from('athletes').insert([{
      profile_id: profileId,
      dni: athleteData.dni,
      phone: athleteData.phone,
      plan_id: athleteData.plan_id, // Obligatorio según SQL
      plan_option: athleteData.plan_option?.trim() || null,
      coach_id: athleteData.coach_id,
      visits_per_week: athleteData.visits_per_week || null,
      plan_tier_price: athleteData.tier_price || null,
      status: 'active',
      gender: athleteData.gender,
      city: athleteData.city,
      // Obligatorio según SQL: Si no viene, usamos la fecha de hoy
      join_date: athleteData.join_date || new Date().toISOString().split('T')[0] 
    }]).select().single();

    if (aErr) throw aErr;

    if (Array.isArray(athleteData.selected_weekly_schedule_ids) && athleteData.selected_weekly_schedule_ids.length > 0) {
      const assignments = athleteData.selected_weekly_schedule_ids.map((weeklyScheduleId) => ({
        athlete_id: newAthlete.id,
        weekly_schedule_id: weeklyScheduleId,
        starts_on: athleteData.join_date || new Date().toISOString().split('T')[0],
        is_active: true,
      }));

      const { error: assignmentError } = await supabase.from('athlete_slot_assignments').insert(assignments);
      if (assignmentError) throw assignmentError;
    }

    // 5. Generar Deuda Inicial
    const { data: plan } = await supabase.from('plans').select('price, name').eq('id', athleteData.plan_id).single();
    if (plan) {
      await supabase.from('payments').insert({
        athlete_id: newAthlete.id,
        amount: athleteData.tier_price ?? plan.price,
        status: 'pending',
        concept: `Inscripción inicial - ${plan.name}`,
        payment_date: new Date().toISOString().split('T')[0]
      });
    }

    return { success: true, data: newAthlete };
  } catch (error) {
    console.error("❌ Error en createFullAthlete:", error);

    const isPolicyError =
      error?.code === '42501' ||
      String(error?.message || '').toLowerCase().includes('row-level security');

    if (isPolicyError) {
      return {
        success: false,
        error: 'No tienes permisos para crear atletas. Verifica tu rol o las políticas de seguridad.',
      };
    }

    return { success: false, error: error.message };
  }
};


export const deactivateAthlete = async (athleteId) => {
  const today = new Date().toISOString().split('T')[0];

  const { error: athleteError } = await supabase
    .from('athletes')
    .update({ status: 'inactive' })
    .eq('id', athleteId);

  if (athleteError) throw athleteError;

  const { error: assignmentError } = await supabase
    .from('athlete_slot_assignments')
    .update({ is_active: false, ends_on: today })
    .eq('athlete_id', athleteId)
    .eq('is_active', true);

  if (assignmentError) throw assignmentError;

  return { success: true };
};


export const fetchAthleteAssignedSlots = async (athleteId, effectiveDate = new Date().toISOString().split('T')[0]) => {
  const { data, error } = await supabase
    .from('athlete_slot_assignments')
    .select(`
      id,
      athlete_id,
      weekly_schedule_id,
      starts_on,
      ends_on,
      is_active,
      weekly_schedule:weekly_schedule_id (
        id,
        day_of_week,
        start_time,
        end_time,
        capacity
      )
    `)
    .eq('athlete_id', athleteId)
    .eq('is_active', true)
    .lte('starts_on', effectiveDate)
    .or(`ends_on.is.null,ends_on.gte.${effectiveDate}`);

  if (error) throw error;
  return data ?? [];
};

export const reassignAthleteSlots = async ({
  athleteId,
  planId,
  visitsPerWeek,
  selectedWeeklyScheduleIds,
  effectiveDate = new Date().toISOString().split('T')[0],
  fetchPlanSlots,
}) => {
  try {
    if (!athleteId || !planId) {
      return { success: false, error: 'Falta atleta o plan para reasignar horarios.' };
    }

    const frequency = Number(visitsPerWeek || 0);
    if (!frequency || frequency <= 0) {
      return { success: false, error: 'El atleta no tiene una frecuencia semanal válida.' };
    }

    const uniqueSelected = Array.from(new Set((selectedWeeklyScheduleIds || []).filter(Boolean)));
    if (uniqueSelected.length !== frequency) {
      return { success: false, error: `Debes seleccionar exactamente ${frequency} horarios.` };
    }

    const { data: planLinks, error: linkError } = await supabase
      .from('plan_schedule_slots')
      .select('weekly_schedule_id')
      .eq('plan_id', planId)
      .in('weekly_schedule_id', uniqueSelected);

    if (linkError) throw linkError;

    if ((planLinks || []).length !== uniqueSelected.length) {
      return { success: false, error: 'Se detectaron horarios fuera del plan del atleta.' };
    }

    const currentAssignments = await fetchAthleteAssignedSlots(athleteId, effectiveDate);
    const currentSlotIds = new Set(currentAssignments.map((row) => row.weekly_schedule_id));

    if (typeof fetchPlanSlots === 'function') {
      const slotAvailability = await fetchPlanSlots(planId);
      const availabilityMap = new Map((slotAvailability || []).map((slot) => [slot.weekly_schedule_id, slot]));

      for (const slotId of uniqueSelected) {
        const slot = availabilityMap.get(slotId);
        if (!slot) {
          return { success: false, error: 'No se pudo validar la disponibilidad del horario seleccionado.' };
        }

        const isAlreadyOwned = currentSlotIds.has(slotId);
        if (!isAlreadyOwned && Number(slot.remaining) <= 0) {
          return { success: false, error: 'Uno o más horarios seleccionados no tienen cupo disponible.' };
        }
      }
    }

    const selectedSet = new Set(uniqueSelected);
    const toKeep = currentAssignments.filter((assignment) => selectedSet.has(assignment.weekly_schedule_id));
    const toDeactivate = currentAssignments.filter((assignment) => !selectedSet.has(assignment.weekly_schedule_id));
    const keepIds = new Set(toKeep.map((assignment) => assignment.weekly_schedule_id));
    const toInsert = uniqueSelected.filter((slotId) => !keepIds.has(slotId));

    if (toDeactivate.length > 0) {
      const ids = toDeactivate.map((assignment) => assignment.id);
      const { error: deactivateError } = await supabase
        .from('athlete_slot_assignments')
        .update({
          is_active: false,
          ends_on: effectiveDate,
        })
        .in('id', ids);

      if (deactivateError) throw deactivateError;
    }

    if (toInsert.length > 0) {
      const payload = toInsert.map((weeklyScheduleId) => ({
        athlete_id: athleteId,
        weekly_schedule_id: weeklyScheduleId,
        starts_on: effectiveDate,
        is_active: true,
      }));

      const { error: insertError } = await supabase.from('athlete_slot_assignments').insert(payload);
      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error en reassignAthleteSlots:', error);
    return { success: false, error: error.message || 'No se pudo reasignar horarios.' };
  }
};
