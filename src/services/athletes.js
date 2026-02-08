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
export const fetchAthletesByCoach = async (coachId) => {
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('coach_id', coachId);

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
 * ALTA INTEGRAL DE ATLETA (Roadmap Prioridad 1)
 * 1. Crea Usuario en Auth (Email/Password)
 * 2. El trigger de DB crea el Profile (o lo actualizamos)
 * 3. Crea registro en Athletes
 * 4. Crea registro en Enrollments
 * 5. Genera deuda inicial en Payments
 */
export const createFullAthlete = async (athleteData) => {
  try {
    const exists = await checkDniExists(athleteData.dni);
    if (exists) return { success: false, error: "El DNI ya existe." };

    const normalizedEmail = athleteData.email?.trim() || "";
    const isInternal = !normalizedEmail || normalizedEmail.includes('.internal');
    const finalEmail = isInternal 
      ? `sin_email_${athleteData.dni}@dmg.internal` 
      : normalizedEmail;

    const profileId = crypto.randomUUID();

    // 1. Crear Perfil Fantasma (Sin Auth)
    const { error: pErr } = await supabase.from('profiles').insert({
      id: profileId, full_name: athleteData.full_name, email: finalEmail, role: 'atleta'
    });
    if (pErr) throw pErr;

    // 2. Crear Atleta
    const { data: newAthlete, error: aErr } = await supabase.from('athletes').insert([{
      profile_id: profileId, dni: athleteData.dni, phone: athleteData.phone,
      plan_id: athleteData.plan_id, coach_id: athleteData.coach_id,
      status: 'active', gender: athleteData.gender, city: athleteData.city
    }]).select().single();
    if (aErr) throw aErr;

    // 3. Deuda Inicial
    const { data: plan } = await supabase.from('plans').select('price, name').eq('id', athleteData.plan_id).single();
    if (plan) {
      await supabase.from('payments').insert({
        athlete_id: newAthlete.id, amount: plan.price, status: 'pending',
        concept: `Inscripción inicial - ${plan.name}`,
        payment_date: new Date().toISOString().split('T')[0]
      });
    }

    return { success: true, data: newAthlete };
  } catch (error) {
    return { success: false, error: error.message };
  }
};