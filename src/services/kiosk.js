import { supabase } from '../lib/supabaseClient';

export async function runKioskCheckIn({ dni, phone }) {
  const cleanDni = dni?.trim() || null;
  const cleanPhone = phone?.trim() || null;

  if (!cleanDni && !cleanPhone) {
    throw new Error('Debes ingresar DNI o teléfono.');
  }

  const { data, error } = await supabase.rpc('kiosk_check_in', {
    p_dni: cleanDni,
    p_phone: cleanPhone,
    p_now: new Date().toISOString(),
    p_timezone: 'America/Argentina/Buenos_Aires'
  });

  if (error) throw error;

  return {
    allowed: Boolean(data?.allowed),
    reason_code: data?.reason_code || 'ERROR',
    message: data?.message || null,
    remaining: data?.remaining,
    athleteId: data?.athlete_id || null,
    weeklyScheduleId: data?.weekly_schedule_id || null,
    athleteName: data?.athlete_name || null,
    planName: data?.plan_name || null,
    avatarUrl: data?.avatar_url || null
  };
}

export async function fetchKioskRemaining({ athleteId }) {
  if (!athleteId) return null;

  const { data, error } = await supabase.rpc('kiosk_remaining', {
    p_athlete_id: athleteId,
    p_now: new Date().toISOString(),
    p_timezone: 'America/Argentina/Buenos_Aires'
  });

  if (error) throw error;
  return data || null;
}
