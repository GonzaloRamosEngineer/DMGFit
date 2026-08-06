import { supabase } from '../lib/supabaseClient';

// Corrección manual de la entrada/salida de un profesor (admin). Las horas van como
// 'HH:MM' locales del día del registro; el backend las ancla a la zona horaria.
// Salida vacía = deja el día "En curso". Ver 0013_corregir_asistencia_profes.sql.
export const setCoachAttendance = async ({ logId, checkIn, checkOut }) => {
  try {
    const { data, error } = await supabase.rpc('admin_set_coach_attendance', {
      p_log_id: logId,
      p_check_in: checkIn,
      p_check_out: checkOut || null,
    });

    if (error) throw error;
    return { success: true, result: data };
  } catch (error) {
    console.error('Error en setCoachAttendance:', error);
    const message = String(error?.message || '');
    if (message.includes('FORBIDDEN')) {
      return { success: false, error: 'No tenés permisos para corregir la asistencia.' };
    }
    return { success: false, error: message || 'No se pudo guardar la corrección.' };
  }
};

export const fetchAttendanceByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};
