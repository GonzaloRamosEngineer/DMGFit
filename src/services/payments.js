import { supabase } from '../lib/supabaseClient';

/**
 * Obtiene el historial de pagos de un atleta específico.
 */
export const fetchPaymentsByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

/**
 * FASE 2: MOTOR DE GENERACIÓN DE CUOTAS (VERSIÓN ROBUSTA & DEBUG)
 */
export const generateMonthlyInvoices = async () => {
  console.log(">>> INICIO: generateMonthlyInvoices");
  
  try {
    const today = new Date();
    // Fechas en formato ISO
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    // Para el fin de mes, calculamos el día 0 del mes siguiente
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();
    
    // Fecha limpia para la base de datos (YYYY-MM-DD) para evitar problemas con tipos 'date'
    const paymentDateClean = today.toISOString().split('T')[0];

    console.log(`1. Periodo detectado: ${currentMonthStart} a ${currentMonthEnd}`);

    // --- PASO 1: Obtener Atletas Activos ---
    // Nota: Pedimos 'plans' sin alias complejos para dejar que Supabase resuelva
    const { data: activeAthletes, error: athletesError } = await supabase
      .from('athletes')
      .select(`
        id,
        status,
        visits_per_week,
        plan_tier_price,
        plans ( id, name, price )
      `)
      .eq('status', 'active');

    if (athletesError) {
      console.error("Error Paso 1 (Atletas):", athletesError);
      throw athletesError;
    }

    if (!activeAthletes || activeAthletes.length === 0) {
      console.log("Aviso: No hay atletas activos.");
      return { created: 0, message: "No hay atletas activos para generar." };
    }

    console.log(`2. Atletas activos encontrados: ${activeAthletes.length}`);

    // --- PASO 2: Verificar Pagos Existentes ---
    const { data: existingPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('athlete_id')
      .gte('payment_date', currentMonthStart)
      .lte('payment_date', currentMonthEnd);

    if (paymentsError) {
      console.error("Error Paso 2 (Pagos existentes):", paymentsError);
      throw paymentsError;
    }

    const paidAthleteIds = new Set(existingPayments.map(p => p.athlete_id));
    console.log(`3. Atletas que ya tienen pago este mes: ${paidAthleteIds.size}`);

    // --- PASO 3: Construir Facturas (Mapeo Defensivo) ---
    const invoicesToCreate = activeAthletes
      .filter(athlete => !paidAthleteIds.has(athlete.id))
      .map(athlete => {
        // FIX CRÍTICO: Manejar si plans es Array u Objeto
        const planData = Array.isArray(athlete.plans) ? athlete.plans[0] : athlete.plans;
        
        // Si no tiene plan o precio, usamos defaults seguros
        const planName = planData?.name || 'Membresía General';
        const tierPrice = Number(athlete.plan_tier_price);
        const legacyPlanPrice = Number(planData?.price || 0);
        const planPrice = Number.isFinite(tierPrice) ? tierPrice : legacyPlanPrice;

        const monthName = today.toLocaleDateString('es-ES', { month: 'long' });
        const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const visits = Number(athlete?.visits_per_week || 0);
        const visitsLabel = visits > 0
          ? ` - ${visits} ${visits === 1 ? 'vez' : 'veces'} por semana`
          : '';

        return {
          athlete_id: athlete.id,
          amount: planPrice,
          status: 'pending',
          method: 'efectivo',
          payment_date: paymentDateClean,
          concept: `Cuota ${formattedMonth} - ${planName}${visitsLabel}`
        };
      });

    console.log(`4. Facturas a crear: ${invoicesToCreate.length}`);

    if (invoicesToCreate.length === 0) {
      return { created: 0, message: "Todos los atletas están al día." };
    }

    // --- PASO 4: Inserción Masiva ---
    const { error: insertError } = await supabase
      .from('payments')
      .insert(invoicesToCreate);

    if (insertError) {
      console.error("Error Paso 4 (Inserción):", insertError);
      throw insertError;
    }

    console.log(">>> ÉXITO: Cuotas generadas.");
    
    return { 
      created: invoicesToCreate.length, 
      message: `Se generaron ${invoicesToCreate.length} nuevas cuotas pendientes.` 
    };

  } catch (err) {
    console.error(">>> ERROR FATAL en generateMonthlyInvoices:", err);
    // Relanzamos o devolvemos un mensaje de error para que la UI se entere y quite el loading
    return { created: 0, message: "Error técnico: " + err.message };
  }
};