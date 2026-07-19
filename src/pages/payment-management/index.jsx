import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// UI
import Icon from '../../components/AppIcon';
import { useToast } from '../../hooks/useToast';
import { EmptyState } from '../../components/ui/EmptyState';

// Modal
import AddPaymentModal from './components/AddPaymentModal';
import PaymentReceipt from './components/PaymentReceipt';

// Servicio de pagos
import {
  generateMonthlyInvoices,
  fetchBillingStatus,
  updatePayment,
  voidPayment,
} from '../../services/payments';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// FIX: parseo local para evitar desfase UTC → timezone del browser
const formatTxDateTime = (dateLike) => {
  if (!dateLike) return '—';

  let dt;
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    const [y, m, d] = dateLike.split('-').map(Number);
    dt = new Date(y, m - 1, d); // constructor LOCAL, sin UTC
  } else {
    dt = new Date(dateLike);
  }

  if (Number.isNaN(dt.getTime())) return '—';

  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const dtDay = startOfDay(dt);

  const hasMeaningfulTime = !(dt.getHours() === 0 && dt.getMinutes() === 0);
  const timeStr = hasMeaningfulTime
    ? dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (isSameDay(dtDay, today)) return timeStr ? `Hoy, ${timeStr}` : 'Hoy';
  if (isSameDay(dtDay, yesterday)) return timeStr ? `Ayer, ${timeStr}` : 'Ayer';

  const dateStr = dt.toLocaleDateString('es-ES');
  return timeStr ? `${dateStr}, ${timeStr}` : dateStr;
};

const mapMethodLabel = (method) => {
  const m = String(method || '').toLowerCase();
  if (m === 'efectivo') return 'Efectivo';
  if (m === 'tarjeta') return 'Tarjeta';
  if (m === 'transferencia') return 'Transferencia';
  if (m === 'mp' || m === 'mercadopago') return 'Mercado Pago';
  return method ? String(method) : '—';
};

const KpiCard = ({ title, value, variant = 'neutral' }) => {
  const border =
    variant === 'success'
      ? 'border-l-4 border-success'
      : variant === 'danger'
        ? 'border-l-4 border-error'
        : variant === 'warning'
          ? 'border-l-4 border-warning'
          : 'border-l-4 border-border';

  return (
    <div className={`bg-card rounded-2xl border border-border shadow-sm p-5 ${border}`}>
      <p className="text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em]">
        {title}
      </p>
      <div className="mt-2 text-3xl font-black text-text-primary tracking-tight">
        {value}
      </div>
    </div>
  );
};

// --- MODAL DETALLE DE PAGO ---
const PaymentDetailModal = ({ payment, onClose, onNavigate, onEdit, onVoid, onReceipt }) => {
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [busy, setBusy] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const [form, setForm] = useState({
    amount: '',
    method: 'efectivo',
    concept: '',
    payment_date: '',
    reason: '',
  });

  useEffect(() => {
    if (payment) {
      setMode('view');
      setShowVoid(false);
      setVoidReason('');
      setForm({
        amount: String(payment.amount ?? ''),
        method: payment.method || 'efectivo',
        concept: payment.concept || '',
        payment_date: payment.payment_date || '',
        reason: '',
      });
    }
  }, [payment]);

  if (!payment) return null;

  const amount = Number(payment.amount || 0);
  const baseAmount = Number(payment.base_amount || amount);
  const hasDiscount = payment.discount_value && Number(payment.discount_value) > 0;

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSaveEdit = async () => {
    const patch = {};
    const newAmount = Number(form.amount);
    if (Number.isFinite(newAmount) && newAmount >= 0 && newAmount !== amount) {
      // Editar el monto lo aplana: pasa a ser un importe corregido sin descuento.
      patch.amount = newAmount;
      patch.base_amount = newAmount;
      patch.discount_value = 0;
      patch.discount_type = null;
    }
    if (form.method !== (payment.method || 'efectivo')) patch.method = form.method;
    if (form.concept !== (payment.concept || '')) patch.concept = form.concept;
    if (form.payment_date && form.payment_date !== payment.payment_date) {
      patch.payment_date = form.payment_date;
    }

    if (Object.keys(patch).length === 0) {
      setMode('view');
      return;
    }

    try {
      setBusy(true);
      await onEdit(payment.id, patch, form.reason?.trim() || null);
    } finally {
      setBusy(false);
    }
  };

  const handleVoid = async () => {
    try {
      setBusy(true);
      await onVoid(payment.id, voidReason?.trim() || null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-md rounded-[1.5rem] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-muted/50">
          <div>
            <h2 className="text-lg font-black text-text-primary tracking-tight">Detalle del Pago</h2>
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
              {formatTxDateTime(payment.payment_date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors text-text-secondary"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Atleta */}
          <div className="flex items-center justify-between gap-3 p-4 bg-info-light rounded-2xl border border-primary/15">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md overflow-hidden shrink-0">
                {payment.athleteImage
                  ? <img src={payment.athleteImage} alt={payment.athleteName} className="w-full h-full object-cover" />
                  : payment.athleteName?.charAt(0) || 'A'
                }
              </div>
              <div className="min-w-0">
                <p className="font-black text-text-primary truncate">{payment.athleteName}</p>
                {payment.athleteEmail && (
                  <p className="text-xs text-text-secondary truncate">{payment.athleteEmail}</p>
                )}
              </div>
            </div>
            {payment.athleteId && (
              <button
                onClick={() => onNavigate(payment.athleteId)}
                className="shrink-0 text-[10px] font-black text-primary hover:text-primary/90 uppercase tracking-widest hover:underline"
              >
                Ver perfil
              </button>
            )}
          </div>

          {/* Concepto */}
          <div className="space-y-1">
            <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Concepto</p>
            <p className="text-sm font-bold text-text-secondary bg-muted px-4 py-3 rounded-xl">
              {payment.concept || 'Pago registrado'}
            </p>
          </div>

          {/* Grilla de datos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1">Método</p>
              <p className="text-sm font-bold text-text-secondary">{mapMethodLabel(payment.method)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1">Estado</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                payment.status === 'void'
                  ? 'bg-muted text-text-tertiary line-through'
                  : payment.status === 'paid'
                    ? 'bg-success-light text-success'
                    : payment.isPastDue
                      ? 'bg-error-light text-error'
                      : 'bg-warning-light text-warning'
              }`}>
                {payment.status === 'void' ? 'Anulado' : payment.status === 'paid' ? 'Pagado' : payment.isPastDue ? 'Vencido' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Montos */}
          <div className="border-t border-border pt-4 space-y-2">
            {hasDiscount && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">Monto base</span>
                  <span className="font-bold text-text-secondary">{formatCurrency(baseAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">
                    Descuento ({payment.discount_type === 'percent'
                      ? `${payment.discount_value}%`
                      : formatCurrency(payment.discount_value)})
                  </span>
                  <span className="font-bold text-success">
                    -{formatCurrency(
                      payment.discount_type === 'percent'
                        ? baseAmount * (Number(payment.discount_value) / 100)
                        : Number(payment.discount_value)
                    )}
                  </span>
                </div>
                <div className="h-px bg-border" />
              </>
            )}
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-black text-text-secondary uppercase tracking-wide">Total</span>
              <span className="text-2xl font-black text-text-primary">{formatCurrency(amount)}</span>
            </div>
          </div>

          {/* Info de anulación */}
          {payment.status === 'void' && (
            <div className="rounded-2xl border border-border bg-muted/60 p-4 space-y-1">
              <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Pago anulado</p>
              {payment.voidInfo?.reason && (
                <p className="text-sm font-bold text-text-secondary">Motivo: {payment.voidInfo.reason}</p>
              )}
              <p className="text-xs text-text-tertiary">
                {payment.voidInfo?.by ? `Por ${payment.voidInfo.by}` : 'Por administración'}
                {payment.voidInfo?.at ? ` · ${formatTxDateTime(payment.voidInfo.at)}` : ''}
              </p>
            </div>
          )}

          {/* Panel de edición (admin) */}
          {mode === 'edit' && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Editar pago</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-text-secondary space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Monto</span>
                  <input
                    type="number" min="0" step="1"
                    value={form.amount}
                    onChange={(e) => setField('amount', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-bold outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-bold text-text-secondary space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Método</span>
                  <select
                    value={form.method}
                    onChange={(e) => setField('method', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-bold outline-none focus:border-primary"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="mp">Mercado Pago</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-text-secondary space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Fecha</span>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setField('payment_date', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-bold outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-bold text-text-secondary space-y-1 col-span-2">
                  <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Concepto</span>
                  <input
                    type="text"
                    value={form.concept}
                    onChange={(e) => setField('concept', e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-bold outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-bold text-text-secondary space-y-1 col-span-2">
                  <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Motivo del ajuste (opcional)</span>
                  <input
                    type="text"
                    value={form.reason}
                    onChange={(e) => setField('reason', e.target.value)}
                    placeholder="Queda registrado en la auditoría"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-bold outline-none focus:border-primary"
                  />
                </label>
              </div>
              {hasDiscount && Number(form.amount) !== amount && (
                <p className="text-[11px] font-semibold text-warning">
                  Editar el monto elimina el descuento y lo deja como importe fijo.
                </p>
              )}
            </div>
          )}

          {/* Confirmación de anulación */}
          {showVoid && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-[10px] font-black text-error uppercase tracking-widest">Anular pago</p>
              <p className="text-xs font-semibold text-text-secondary">
                El pago queda anulado (soft-delete) y se registra en la auditoría.
                {payment.status === 'paid' && ' Al anular un pago cobrado, el ciclo de acceso del atleta en el kiosco se recalcula y podría re-bloquearlo.'}
              </p>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-bold outline-none focus:border-error"
              />
            </div>
          )}
        </div>

        {/* Footer acciones (admin) */}
        <div className="px-6 py-4 border-t border-border bg-muted/50 flex items-center justify-end gap-2">
          {mode === 'view' && !showVoid && payment.status === 'void' && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-card border border-border text-text-secondary hover:bg-muted transition-colors"
            >
              Cerrar
            </button>
          )}

          {mode === 'view' && !showVoid && payment.status !== 'void' && (
            <>
              <button
                onClick={() => setShowVoid(true)}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-error hover:bg-error-light transition-colors mr-auto"
              >
                Anular
              </button>
              {payment.status === 'paid' && onReceipt && (
                <button
                  onClick={() => onReceipt(payment)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-success-light text-success hover:bg-success-light/70 transition-colors"
                >
                  <Icon name="Receipt" size={14} /> Comprobante
                </button>
              )}
              <button
                onClick={() => setMode('edit')}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-card border border-border text-text-secondary hover:bg-muted transition-colors"
              >
                Editar
              </button>
            </>
          )}

          {mode === 'edit' && (
            <>
              <button
                disabled={busy}
                onClick={() => setMode('view')}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-text-secondary hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {busy ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}

          {showVoid && (
            <>
              <button
                disabled={busy}
                onClick={() => { setShowVoid(false); setVoidReason(''); }}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-text-secondary hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={handleVoid}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-error text-error-foreground hover:bg-error/90 transition-colors disabled:opacity-60"
              >
                {busy ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'debtors'
  const [searchTerm, setSearchTerm] = useState('');

  // Modal registro
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialAthlete, setInitialAthlete] = useState(null);

  // Modal detalle
  const [detailPayment, setDetailPayment] = useState(null);

  // Data
  const [allPayments, setAllPayments] = useState([]);
  const [paidMovements, setPaidMovements] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [voided, setVoided] = useState([]);

  // Modal comprobante
  const [receiptPayment, setReceiptPayment] = useState(null);

  // KPIs
  const [kpiMonthlyRevenue, setKpiMonthlyRevenue] = useState(0);
  const [kpiOverdueAmount, setKpiOverdueAmount] = useState(0);
  const [kpiDebtorsCount, setKpiDebtorsCount] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const resetPagination = () => setPage(1);

  const fetchPaymentData = useCallback(async () => {
    try {
      setLoading(true);

      const now = new Date();
      const today = startOfDay(now);
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [{ data: paymentsData, error }, billingMap] = await Promise.all([
        supabase
          .from('payments')
          .select(`
            id,
            amount,
            status,
            payment_date,
            method,
            concept,
            base_amount,
            discount_value,
            discount_type,
            period,
            athletes ( id, phone, profiles ( full_name, avatar_url, email ) )
          `)
          .order('payment_date', { ascending: false }),
        // Estado de deuda alineado al kiosco (fuente única de "vencido")
        fetchBillingStatus().catch((e) => {
          console.error('Error cargando estado de facturación:', e);
          return new Map();
        }),
      ]);

      if (error) throw error;

      // Auditoría de los pagos anulados (motivo/quién/cuándo)
      const voidedIds = (paymentsData || []).filter((p) => p.status === 'void').map((p) => p.id);
      const auditByPayment = new Map();
      if (voidedIds.length > 0) {
        const { data: auditRows } = await supabase
          .from('payment_audit')
          .select('payment_id, reason, actor_id, created_at')
          .eq('action', 'void')
          .in('payment_id', voidedIds)
          .order('created_at', { ascending: false });

        const actorIds = [...new Set((auditRows || []).map((a) => a.actor_id).filter(Boolean))];
        const actorNames = new Map();
        if (actorIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', actorIds);
          (profs || []).forEach((pr) => actorNames.set(pr.id, pr.full_name));
        }
        // Nos quedamos con la anulación más reciente por pago
        (auditRows || []).forEach((a) => {
          if (!auditByPayment.has(a.payment_id)) {
            auditByPayment.set(a.payment_id, {
              reason: a.reason,
              at: a.created_at,
              by: actorNames.get(a.actor_id) || null,
            });
          }
        });
      }

      const processed = (paymentsData || []).map((p) => {
        const paymentDate = p.payment_date || null;
        const athleteId = p.athletes?.id || null;
        const billing = athleteId ? billingMap.get(athleteId) : null;

        // "Vencido" = ciclo del kiosco (último paid + 30d + gracia), NO payment_date.
        // Solo aplica a cuotas pendientes; un pago 'paid' nunca está vencido.
        const isPastDue = p.status === 'pending' && billing?.state === 'overdue';
        const daysOverdue = isPastDue ? (billing?.daysLate || 0) : 0;
        const voidInfo = p.status === 'void' ? auditByPayment.get(p.id) || {} : null;

        return {
          ...p,
          payment_date: paymentDate,
          athleteName: p.athletes?.profiles?.full_name || 'Desconocido',
          athleteId: p.athletes?.id || null,
          athletePhone: p.athletes?.phone || null,
          athleteImage: p.athletes?.profiles?.avatar_url || null,
          athleteEmail: p.athletes?.profiles?.email || null,
          isPastDue,
          daysOverdue,
          voidInfo,
        };
      });

      setAllPayments(processed);

      // Movimientos: solo pagos efectivamente cobrados
      const paid = processed.filter((p) => p.status === 'paid');
      setPaidMovements(paid);

      // Deudores: pending + overdue
      const due = processed.filter((p) => p.status === 'pending' || p.status === 'overdue');
      due.sort((a, b) => (b.daysOverdue - a.daysOverdue) || (Number(b.amount) - Number(a.amount)));
      setDebtors(due);

      // Anulados (soft-delete)
      setVoided(processed.filter((p) => p.status === 'void'));

      // KPI: ingresos del mes
      const monthlyRevenue = paid.reduce((sum, p) => {
        if (!p.payment_date) return sum;
        let dt;
        if (/^\d{4}-\d{2}-\d{2}$/.test(p.payment_date)) {
          const [y, m, d] = p.payment_date.split('-').map(Number);
          dt = new Date(y, m - 1, d);
        } else {
          dt = new Date(p.payment_date);
        }
        if (!dt || Number.isNaN(dt.getTime())) return sum;
        if (dt >= startMonth) return sum + Number(p.amount || 0);
        return sum;
      }, 0);
      setKpiMonthlyRevenue(monthlyRevenue);

      // KPI: total vencido
      const overdueAmount = due
        .filter((p) => p.isPastDue)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      setKpiOverdueAmount(overdueAmount);

      // KPI: alumnos con deuda
      const uniqueDebtors = new Set(due.map((p) => p.athleteId).filter(Boolean));
      setKpiDebtorsCount(uniqueDebtors.size);

    } catch (err) {
      console.error('Error cargando pagos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentData();
  }, [fetchPaymentData]);

  // Generar periodo
  const handleGenerateInvoices = async () => {
    try {
      setIsGenerating(true);
      const result = await generateMonthlyInvoices();
      if (result?.message) toast.success(result.message);
      await fetchPaymentData();
    } catch (error) {
      console.error('Error generando cuotas:', error);
      toast.error('Hubo un error al generar las cuotas.');
    } finally {
      setIsGenerating(false);
    }
  };

  const openRegisterPayment = () => {
    setInitialAthlete(null);
    setIsModalOpen(true);
  };

  const openCollectFromDebtor = (row) => {
    if (!row?.athleteId) return;
    setInitialAthlete({
      id: row.athleteId,
      name: row.athleteName,
      avatar: row.athleteImage,
      email: row.athleteEmail,
    });
    setIsModalOpen(true);
  };

  const currentRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base =
      activeTab === 'transactions' ? paidMovements : activeTab === 'voided' ? voided : debtors;
    const filtered = !term
      ? base
      : base.filter((r) => {
          const a = String(r.athleteName || '').toLowerCase();
          const c = String(r.concept || '').toLowerCase();
          return a.includes(term) || c.includes(term);
        });
    return filtered;
  }, [activeTab, paidMovements, debtors, voided, searchTerm]);

  const totalRows = currentRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageRows = currentRows.slice(pageStart, pageEnd);

  useEffect(() => {
    resetPagination();
  }, [activeTab, searchTerm]);

  return (
    <>
      <Helmet><title>Caja y Cobros - VC Fit</title></Helmet>

      <div className="flex flex-col gap-4 lg:gap-5 lg:h-[calc(100vh-4rem)]">
        {/* HEADER compacto */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
              Caja y Cobros
            </h1>
            <p className="text-sm text-text-secondary font-medium mt-0.5">
              Gestión de ingresos, cuotas mensuales y ventas extra.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateInvoices}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 text-xs uppercase tracking-wider shadow-md transition-all ${
                isGenerating ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              <Icon
                name={isGenerating ? 'Loader' : 'RefreshCw'}
                size={16}
                className={isGenerating ? 'animate-spin' : ''}
              />
              {isGenerating ? 'Generando...' : 'Generar Periodo'}
            </button>

            <button
              onClick={openRegisterPayment}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 shadow-md hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all"
            >
              <Icon name="PlusCircle" size={16} /> Registrar Pago
            </button>
          </div>
        </div>

        {/* KPI STRIP (3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 shrink-0">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border shadow-sm p-5 h-[92px] animate-pulse">
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded w-2/3 mt-4" />
              </div>
            ))
          ) : (
            <>
              <KpiCard
                title="Ingresos del mes"
                value={formatCurrency(kpiMonthlyRevenue)}
                variant="success"
              />
              <KpiCard
                title="Total vencido (a cobrar)"
                value={formatCurrency(kpiOverdueAmount)}
                variant={kpiOverdueAmount > 0 ? 'danger' : 'neutral'}
              />
              <KpiCard
                title="Atletas con deuda"
                value={`${kpiDebtorsCount} `}
                variant={kpiDebtorsCount > 0 ? 'warning' : 'neutral'}
              />
            </>
          )}
        </div>

        {/* CARD PRINCIPAL */}
        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
          {/* Tabs + Search */}
          <div className="px-6 py-4 border-b border-border shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-colors ${
                    activeTab === 'transactions'
                      ? 'text-text-primary border-primary'
                      : 'text-text-tertiary border-transparent hover:text-text-secondary'
                  }`}
                >
                  Últimos movimientos
                </button>

                <button
                  onClick={() => setActiveTab('debtors')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'debtors'
                      ? 'text-text-primary border-primary'
                      : 'text-text-tertiary border-transparent hover:text-text-secondary'
                  }`}
                >
                  Deudores (alertas)
                  {!loading && (
                    <span className="px-2 py-0.5 rounded-full bg-error-light text-error text-[10px] font-black">
                      {debtors.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('voided')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'voided'
                      ? 'text-text-primary border-primary'
                      : 'text-text-tertiary border-transparent hover:text-text-secondary'
                  }`}
                >
                  Anulados
                  {!loading && voided.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-text-secondary text-[10px] font-black">
                      {voided.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="relative w-full lg:w-[420px]">
                <Icon
                  name="Search"
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar atleta por nombre..."
                  className="w-full pl-11 pr-4 py-3 bg-muted border border-border rounded-xl text-sm font-semibold text-text-secondary outline-none focus:border-primary focus:bg-card transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted text-[10px] font-black text-text-tertiary uppercase tracking-widest sticky top-0 z-card">
                <tr>
                  <th className="px-6 py-4 w-[140px]">Fecha</th>
                  <th className="px-6 py-4">Atleta</th>
                  <th className="px-6 py-4">Concepto</th>
                  <th className="px-6 py-4 w-[160px]">Método</th>
                  <th className="px-6 py-4 text-right w-[160px]">Monto</th>
                  {activeTab === 'debtors' && (
                    <th className="px-6 py-4 text-right w-[120px]">Acción</th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3 bg-muted rounded w-24" /></td>
                      <td className="px-6 py-4"><div className="h-3 bg-muted rounded w-40" /></td>
                      <td className="px-6 py-4"><div className="h-3 bg-muted rounded w-56" /></td>
                      <td className="px-6 py-4"><div className="h-3 bg-muted rounded w-24" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-muted rounded w-24 ml-auto" /></td>
                      {activeTab === 'debtors' && (
                        <td className="px-6 py-4 text-right"><div className="h-8 bg-muted rounded w-20 ml-auto" /></td>
                      )}
                    </tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'debtors' ? 6 : 5} className="px-6 py-8">
                      <EmptyState
                        iconName="Inbox"
                        title="Sin registros"
                        description="Probá cambiar la búsqueda o la pestaña."
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const amount = Number(row.amount || 0);
                    const isPaid = row.status === 'paid';
                    const isPastDue = row.isPastDue;

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-muted/70 transition-colors cursor-pointer"
                        onClick={() => setDetailPayment(row)}
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-text-secondary">
                          {formatTxDateTime(row.payment_date)}
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-text-primary">{row.athleteName}</p>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-info-light text-primary border border-primary/15 text-xs font-bold">
                            {row.concept || 'Pago registrado'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {activeTab === 'transactions' ? (
                            <span className="text-sm font-semibold text-text-secondary">
                              {mapMethodLabel(row.method)}
                            </span>
                          ) : activeTab === 'voided' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="w-fit px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-muted text-text-tertiary line-through">
                                Anulado
                              </span>
                              {row.voidInfo?.reason && (
                                <span className="text-[11px] font-semibold text-text-tertiary truncate max-w-[180px]" title={row.voidInfo.reason}>
                                  {row.voidInfo.reason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  isPastDue ? 'bg-error-light text-error' : 'bg-warning-light text-warning'
                                }`}
                              >
                                {isPastDue ? 'Vencido' : 'Pendiente'}
                              </span>
                              {row.daysOverdue > 0 && (
                                <span className="text-[11px] font-bold text-text-secondary">
                                  {row.daysOverdue}d
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span
                            className={`text-sm font-black ${
                              row.status === 'void'
                                ? 'text-text-tertiary line-through'
                                : isPaid
                                  ? 'text-success'
                                  : 'text-error'
                            }`}
                          >
                            {isPaid ? `+${formatCurrency(amount)}` : `${formatCurrency(amount)}`}
                          </span>
                        </td>

                        {activeTab === 'debtors' && (
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCollectFromDebtor(row);
                              }}
                              className="px-3 py-2 rounded-xl bg-success text-success-foreground text-xs font-black uppercase tracking-widest hover:bg-success/90 transition-colors"
                              title="Registrar cobro"
                            >
                              Cobrar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
            <p className="text-xs font-bold text-text-tertiary">
              Mostrando{' '}
              <span className="text-text-secondary">
                {totalRows === 0 ? 0 : pageStart + 1}
              </span>{' '}
              a{' '}
              <span className="text-text-secondary">
                {Math.min(pageEnd, totalRows)}
              </span>{' '}
              de{' '}
              <span className="text-text-secondary">{totalRows}</span>{' '}
              {activeTab === 'transactions' ? 'movimientos' : 'deudas'}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  safePage <= 1
                    ? 'bg-muted text-text-tertiary border-border cursor-not-allowed'
                    : 'bg-card text-text-secondary border-border hover:bg-muted'
                }`}
              >
                Anterior
              </button>

              <span className="px-3 py-2 rounded-xl bg-muted border border-border text-xs font-black text-text-secondary">
                {safePage}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  safePage >= totalPages
                    ? 'bg-muted text-text-tertiary border-border cursor-not-allowed'
                    : 'bg-card text-text-secondary border-border hover:bg-muted'
                }`}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Registrar / Cobrar */}
      {isModalOpen && (
        <AddPaymentModal
          initialAthlete={initialAthlete}
          onClose={() => {
            setIsModalOpen(false);
            setInitialAthlete(null);
          }}
          onSuccess={() => {
            fetchPaymentData();
            setIsModalOpen(false);
            setInitialAthlete(null);
          }}
        />
      )}

      {/* Modal: Detalle de pago */}
      {detailPayment && (
        <PaymentDetailModal
          payment={detailPayment}
          onClose={() => setDetailPayment(null)}
          onNavigate={(athleteId) => {
            setDetailPayment(null);
            navigate(`/individual-athlete-profile/${athleteId}`);
          }}
          onEdit={async (id, patch, reason) => {
            try {
              await updatePayment(id, patch, reason);
              toast.success('Pago actualizado.');
              setDetailPayment(null);
              await fetchPaymentData();
            } catch (err) {
              console.error('Error editando pago:', err);
              toast.error('No se pudo editar el pago: ' + (err?.message || 'error'));
            }
          }}
          onVoid={async (id, reason) => {
            try {
              await voidPayment(id, reason);
              toast.success('Pago anulado.');
              setDetailPayment(null);
              await fetchPaymentData();
            } catch (err) {
              console.error('Error anulando pago:', err);
              toast.error('No se pudo anular el pago: ' + (err?.message || 'error'));
            }
          }}
          onReceipt={(p) => {
            setDetailPayment(null);
            setReceiptPayment(p);
          }}
        />
      )}

      {/* Modal: Comprobante */}
      {receiptPayment && (
        <PaymentReceipt
          payment={receiptPayment}
          athletePhone={receiptPayment.athletePhone}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </>
  );
};

export default PaymentManagement;