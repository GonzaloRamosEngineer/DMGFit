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
    // 1. Validar DNI duplicado
    const exists = await checkDniExists(athleteData.dni);
    if (exists) return { success: false, error: "El DNI ya existe en el sistema." };

    // 2. Generar ID manual para el perfil
    const tempProfileId = crypto.randomUUID();

    // --- LOGICA DE EMAIL UNICO ---
    // Si no hay email, creamos uno basado en el DNI que sea UNICO.
    // Usamos el DNI porque ya validamos que no existe otro igual.
    const finalEmail = athleteData.email && athleteData.email.trim() !== "" 
      ? athleteData.email.trim() 
      : `sin_email_${athleteData.dni}@dmg.internal`; 
    // -----------------------------

    const sanitizedBirthDate = athleteData.birth_date && athleteData.birth_date !== "" 
      ? athleteData.birth_date 
      : null;

    // 3. Crear el Perfil base
    const { error: profileError } = await supabase.from('profiles').insert({
      id: tempProfileId,
      full_name: athleteData.full_name,
      email: finalEmail, // Ahora es único porque incluye el DNI
      role: 'atleta'
    });

    if (profileError) {
      if (profileError.code === "23505") throw new Error("El correo electrónico ya está registrado.");
      throw profileError;
    }

    // 4. Crear el Atleta vinculado
    const { data: newAthlete, error: athleteError } = await supabase
      .from('athletes')
      .insert([{
        profile_id: tempProfileId,
        dni: athleteData.dni,
        phone: athleteData.phone,
        plan_id: athleteData.plan_id,
        coach_id: athleteData.coach_id,
        join_date: athleteData.join_date || new Date().toISOString().split('T')[0],
        status: 'active',
        birth_date: sanitizedBirthDate,
        gender: athleteData.gender,
        address: athleteData.address,
        city: athleteData.city,
        emergency_contact_name: athleteData.emergency_contact_name,
        emergency_contact_phone: athleteData.emergency_contact_phone,
        medical_conditions: athleteData.medical_conditions
      }])
      .select().single();

    if (athleteError) throw athleteError;

    // 5. Deuda Inicial
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