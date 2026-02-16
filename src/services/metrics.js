import { supabase } from '../lib/supabaseClient';

/**
 * Obtiene las métricas del atleta (Lectura desde la VISTA actual)
 */
export const fetchMetricsByAthlete = async (athleteId) => {
  const { data, error } = await supabase
    .from('metrics')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

/**
 * Agrega una nueva métrica (Escritura en la TABLA REAL)
 * Mapea los datos del frontend a la estructura de la tabla 'performance_metrics'
 */
export const addMetric = async (metricData) => {
  const payload = {
    athlete_id: metricData.athlete_id,
    name: metricData.name,
    value: metricData.value,
    unit: metricData.unit,
    metric_date: metricData.date, // IMPORTANTE: La tabla real usa 'metric_date'
    trend: null // Se deja null para cálculo futuro
  };

  const { data, error } = await supabase
    .from('performance_metrics')
    .insert([payload])
    .select();

  if (error) {
    throw error;
  }

  return data[0];
};