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
      coach_id: athleteData.coach_id,
      status: 'active',
      gender: athleteData.gender,
      city: athleteData.city,
      // Obligatorio según SQL: Si no viene, usamos la fecha de hoy
      join_date: athleteData.join_date || new Date().toISOString().split('T')[0] 
    }]).select().single();

    if (aErr) throw aErr;

    // 5. Generar Deuda Inicial
    const { data: plan } = await supabase.from('plans').select('price, name').eq('id', athleteData.plan_id).single();
    if (plan) {
      await supabase.from('payments').insert({
        athlete_id: newAthlete.id,
        amount: plan.price,
        status: 'pending',
        concept: `Inscripción inicial - ${plan.name}`,
        payment_date: new Date().toISOString().split('T')[0]
      });
    }

    return { success: true, data: newAthlete };
  } catch (error) {
    console.error("❌ Error en createFullAthlete:", error);
    return { success: false, error: error.message };
  }
};