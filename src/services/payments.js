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
 * Generación idempotente de cuotas mensuales.
 * Delega en la RPC `generate_monthly_invoices` (SECURITY DEFINER, admin-only):
 * fechas locales, unicidad por (athlete_id, period) y ON CONFLICT DO NOTHING.
 * Correr dos veces NO duplica. Reemplaza la vieja lógica JS con bug de rango UTC.
 */
export const generateMonthlyInvoices = async () => {
  const { data, error } = await supabase.rpc('generate_monthly_invoices');
  if (error) throw error;
  return data ?? { created: 0, message: 'Sin cambios.' };
};

/**
 * Estado de deuda ("vencido") de todos los atletas activos, alineado al ciclo del
 * kiosco (último pago 'paid' + 30d + gracia). Fuente única de verdad para Pagos.
 * Devuelve un mapa athlete_id -> { state, last_paid_at, expires_at, days_late }.
 * state: 'ok' | 'grace' | 'overdue' | 'pending'.
 */
export const fetchBillingStatus = async () => {
  const { data, error } = await supabase.rpc('admin_billing_status');
  if (error) throw error;
  const map = new Map();
  (data ?? []).forEach((row) => {
    map.set(row.athlete_id, {
      state: row.state,
      lastPaidAt: row.last_paid_at,
      expiresAt: row.expires_at,
      daysLate: row.days_late,
    });
  });
  return map;
};

/**
 * Edita un pago existente (admin) con traza de auditoría.
 * `patch` acepta amount, method, concept, payment_date, discount_value, discount_type.
 * Los campos ausentes/undefined no se pisan. Para quitar descuento mandar discount_value: 0.
 */
export const updatePayment = async (id, patch = {}, reason = null) => {
  const { data, error } = await supabase.rpc('update_payment', {
    p_id: id,
    p_amount: patch.amount ?? null,
    p_base_amount: patch.base_amount ?? null,
    p_method: patch.method ?? null,
    p_concept: patch.concept ?? null,
    p_payment_date: patch.payment_date ?? null,
    p_discount_value: patch.discount_value ?? null,
    p_discount_type: patch.discount_type ?? null,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
};

/**
 * Anula un pago (soft-delete, status='void') con traza de auditoría.
 * Anular un 'paid' lo saca del ciclo del kiosco → puede re-bloquear al atleta.
 */
export const voidPayment = async (id, reason = null) => {
  const { data, error } = await supabase.rpc('void_payment', {
    p_id: id,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
};