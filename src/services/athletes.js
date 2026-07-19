import { supabase } from '../lib/supabaseClient';
import { hoyLocal } from '../utils/formatters';

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
 * Alta integral atómica vía RPC transaccional.
 */
export const createFullAthlete = async (athleteData) => {
  try {
    const exists = await checkDniExists(athleteData.dni);
    if (exists) return { success: false, error: 'El DNI ya existe en el sistema.' };

    if (!athleteData.plan_id) {
      return { success: false, error: 'Debes seleccionar un plan obligatorio.' };
    }

    const { data, error } = await supabase.rpc('create_full_athlete_atomic', {
      p_payload: athleteData,
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('❌ Error en createFullAthlete:', error);

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

/**
 * Edición de datos personales por el admin (nombre/DNI/email/teléfono/dirección…).
 * El DNI vive en profiles (kiosco/login lo buscan ahí) Y en athletes (legacy),
 * así que se actualizan las dos tablas en sincronía. RLS: solo admin puede
 * actualizar profiles/athletes de terceros ("admin full access").
 * Si cambia el DNI y el atleta tiene login interno ({DNI}@vcfit.internal),
 * se sincroniza el email de auth vía Edge Function sync-athlete-login
 * (service_role server-side). El kiosco toma el nuevo DNI de inmediato.
 */
export const updateAthletePersonalData = async ({ athleteId, profileId, previousDni, data }) => {
  try {
    const fullName = (data.fullName || '').trim();
    const dniDigits = (data.dni || '').trim().replace(/\D/g, '');
    const email = (data.email || '').trim() || null;
    const phone = (data.phone || '').trim() || null;

    if (!fullName) return { success: false, error: 'El nombre es obligatorio.' };
    if (!dniDigits) return { success: false, error: 'El DNI es obligatorio.' };

    // Unicidad de DNI contra otros atletas (mismo criterio que el alta)
    const { data: dniClash, error: dniErr } = await supabase
      .from('athletes')
      .select('id')
      .eq('dni', dniDigits)
      .neq('id', athleteId)
      .maybeSingle();
    if (dniErr) throw dniErr;
    if (dniClash) return { success: false, error: 'Ese DNI ya pertenece a otro atleta.' };

    // Unicidad de email de contacto (si es real, no interno)
    if (email && !email.includes('.internal')) {
      const { data: emailClash, error: emailErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .neq('id', profileId)
        .maybeSingle();
      if (emailErr) throw emailErr;
      if (emailClash) return { success: false, error: 'Ese email ya está registrado en el sistema.' };
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        email,
        dni: dniDigits,
        phone,
      })
      .eq('id', profileId);
    if (profileError) throw profileError;

    const { error: athleteError } = await supabase
      .from('athletes')
      .update({
        dni: dniDigits,
        phone,
        birth_date: data.birthDate || null,
        gender: data.gender && data.gender !== 'select' ? data.gender : null,
        address: (data.address || '').trim() || null,
        city: (data.city || '').trim() || null,
        emergency_contact_name: (data.emergencyName || '').trim() || null,
        emergency_contact_phone: (data.emergencyPhone || '').trim() || null,
        medical_conditions: (data.medicalConditions || '').trim() || null,
      })
      .eq('id', athleteId);
    if (athleteError) throw athleteError;

    // DNI cambiado → sincronizar el login interno de auth (si lo tiene).
    // Si la sync falla, los datos YA quedaron guardados: se devuelve warning, no error.
    const prevDigits = (previousDni || '').replace(/\D/g, '');
    if (prevDigits && prevDigits !== dniDigits) {
      try {
        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          'sync-athlete-login',
          { body: { athlete_id: athleteId } }
        );
        if (syncError) throw syncError;
        if (syncData?.error) throw new Error(syncData.error);
        return { success: true, loginSync: syncData };
      } catch (syncErr) {
        console.error('⚠️ Datos guardados, pero falló la sync del login:', syncErr);
        return {
          success: true,
          loginSyncWarning:
            'Los datos se guardaron, pero no se pudo sincronizar el login: ' +
            'si el atleta tenía acceso a la app, sigue entrando con su DNI anterior.',
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error en updateAthletePersonalData:', error);
    if (error?.code === '23505') {
      return { success: false, error: 'Ese DNI ya está registrado en el sistema.' };
    }
    const isPolicyError =
      error?.code === '42501' ||
      String(error?.message || '').toLowerCase().includes('row-level security');
    if (isPolicyError) {
      return { success: false, error: 'No tienes permisos para editar datos de atletas.' };
    }
    return { success: false, error: error.message || 'No se pudieron guardar los cambios.' };
  }
};

export const deactivateAthlete = async (athleteId) => {
  const today = hoyLocal();

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

export const fetchAthleteAssignedSlots = async (athleteId, effectiveDate = hoyLocal()) => {
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
  effectiveDate = hoyLocal(),
}) => {
  try {
    const { data, error } = await supabase.rpc('reassign_athlete_slots_atomic', {
      p_athlete_id: athleteId,
      p_plan_id: planId,
      p_visits_per_week: Number(visitsPerWeek || 0),
      p_selected_weekly_schedule_ids: selectedWeeklyScheduleIds || [],
      p_effective_date: effectiveDate,
    });

    if (error) throw error;

    if (data?.success === false) {
      return { success: false, error: data.error || 'No se pudo reasignar horarios.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error en reassignAthleteSlots:', error);
    return { success: false, error: error.message || 'No se pudo reasignar horarios.' };
  }
};

// ── Auto-gestión de turnos por el propio atleta (modelo flexible: preferencia) ──
// Usan RPCs SECURITY DEFINER acotadas al auth.uid() (ver 0017_athlete_self_slot_preferences.sql)
export const getMySlotOptions = async () => {
  const { data, error } = await supabase.rpc('get_my_slot_options');
  if (error) throw error;
  return data || null;
};

export const setMySlotPreferences = async (weeklyScheduleIds) => {
  const { error } = await supabase.rpc('set_my_slot_preferences', {
    p_weekly_schedule_ids: weeklyScheduleIds || [],
  });
  if (error) throw error;
  return { success: true };
};

// ── Autoservicio: mis datos personales (ver 0018_athlete_self_profile.sql) ──
export const getMyProfile = async () => {
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) throw error;
  return data || null;
};

export const updateMyProfile = async (payload) => {
  const { error } = await supabase.rpc('update_my_profile', { p_payload: payload });
  if (error) throw error;
  return { success: true };
};

// El propio usuario cambia su contraseña (tiene su sesión; no requiere service_role).
export const changeMyPassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return { success: true };
};

// Activa el login por DNI de un atleta vía Edge Function (service_role server-side).
// Requiere deployar supabase/functions/activate-athlete. Idempotente.
export const activateAthleteLogin = async (athleteId) => {
  const { data, error } = await supabase.functions.invoke('activate-athlete', {
    body: { athlete_id: athleteId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data; // { ok, dni, already?, message }
};
