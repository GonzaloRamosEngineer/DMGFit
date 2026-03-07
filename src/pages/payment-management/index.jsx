import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// UI
import Icon from '../../components/AppIcon';

// Modal
import AddPaymentModal from './components/AddPaymentModal';

// Servicio de Generación de Cuotas
import { generateMonthlyInvoices } from '../../services/payments';

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

const formatTxDateTime = (dateLike) => {
  if (!dateLike) return '—';
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return '—';

  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const dtDay = startOfDay(dt);

  // Suprimir hora si es 00:00 (típico de campos DATE sin tiempo)
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
      ? 'border-l-4 border-emerald-500'
      : variant === 'danger'
        ? 'border-l-4 border-rose-500'
        : variant === 'warning'
          ? 'border-l-4 border-amber-500'
          : 'border-l-4 border-slate-200';

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${border}`}>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
        {title}
      </p>
      <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
        {value}
      </div>
    </div>
  );
};

const PaymentManagement = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'debtors'
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialAthlete, setInitialAthlete] = useState(null);

  // Data
  const [allPayments, setAllPayments] = useState([]);
  const [paidMovements, setPaidMovements] = useState([]);
  const [debtors, setDebtors] = useState([]);

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

      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          status,
          payment_date,
          method,
          concept,
          athletes ( id, profiles ( full_name, avatar_url, email ) )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const processed = (paymentsData || []).map((p) => {
        const paymentDate = p.payment_date || null;
        const dt = paymentDate ? new Date(paymentDate) : null;
        const isPastDue = (p.status === 'overdue') || (p.status === 'pending' && dt && dt < today);

        const daysOverdue =
          isPastDue && dt
            ? Math.floor((today.getTime() - startOfDay(dt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        return {
          ...p,
          payment_date: paymentDate,
          athleteName: p.athletes?.profiles?.full_name || 'Desconocido',
          athleteId: p.athletes?.id || null,
          athleteImage: p.athletes?.profiles?.avatar_url || null,
          athleteEmail: p.athletes?.profiles?.email || null,
          isPastDue,
          daysOverdue,
        };
      });

      setAllPayments(processed);

      // Movimientos: solo pagos efectivamente cobrados
      const paid = processed.filter((p) => p.status === 'paid');
      setPaidMovements(paid);

      // Deudores: pending + overdue (independiente de si ya se venció o no)
      const due = processed.filter((p) => p.status === 'pending' || p.status === 'overdue');
      // Orden: más atrasados primero, luego monto desc
      due.sort((a, b) => (b.daysOverdue - a.daysOverdue) || (Number(b.amount) - Number(a.amount)));
      setDebtors(due);

      // KPI: ingresos del mes (paid desde inicio de mes)
      const monthlyRevenue = paid.reduce((sum, p) => {
        const dt = p.payment_date ? new Date(p.payment_date) : null;
        if (!dt || Number.isNaN(dt.getTime())) return sum;
        if (dt >= startMonth) return sum + Number(p.amount || 0);
        return sum;
      }, 0);
      setKpiMonthlyRevenue(monthlyRevenue);

      // KPI: total vencido (a cobrar) => sólo deudas con fecha pasada o status overdue
      const overdueAmount = due
        .filter((p) => p.isPastDue)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      setKpiOverdueAmount(overdueAmount);

      // KPI: alumnos con deuda (unique athleteId) sobre pending+overdue
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
      if (result?.message) alert(result.message);
      await fetchPaymentData();
    } catch (error) {
      console.error('Error generando cuotas:', error);
      alert('Hubo un error al generar las cuotas.');
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

    const base = activeTab === 'transactions' ? paidMovements : debtors;

    const filtered = !term
      ? base
      : base.filter((r) => {
          const a = String(r.athleteName || '').toLowerCase();
          const c = String(r.concept || '').toLowerCase();
          return a.includes(term) || c.includes(term);
        });

    return filtered;
  }, [activeTab, paidMovements, debtors, searchTerm]);

  const totalRows = currentRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageRows = currentRows.slice(pageStart, pageEnd);

  useEffect(() => {
    // Cuando cambia tab o búsqueda, volvemos a página 1
    resetPagination();
  }, [activeTab, searchTerm]);

  return (
    <>
      <Helmet><title>Caja y Cobros - VC Fit</title></Helmet>

      <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 md:p-8 pb-24">
        {/* HEADER */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-7 mb-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Caja y Cobros
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Gestión de ingresos, cuotas mensuales y ventas extra.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateInvoices}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-xs uppercase tracking-wider shadow-lg transition-all ${
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
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all"
            >
              <Icon name="PlusCircle" size={16} /> Registrar Pago
            </button>
          </div>
        </div>

        {/* KPI STRIP (3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-[92px] animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-200 rounded w-2/3 mt-4" />
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
                title="Alumnos con deuda"
                value={`${kpiDebtorsCount} `}
                variant={kpiDebtorsCount > 0 ? 'warning' : 'neutral'}
              />
            </>
          )}
        </div>

        {/* CARD PRINCIPAL: Tabs + Search + Table + Pagination */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          {/* Tabs + Search */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-colors ${
                    activeTab === 'transactions'
                      ? 'text-slate-900 border-slate-900'
                      : 'text-slate-400 border-transparent hover:text-slate-700'
                  }`}
                >
                  Últimos movimientos
                </button>

                <button
                  onClick={() => setActiveTab('debtors')}
                  className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'debtors'
                      ? 'text-slate-900 border-slate-900'
                      : 'text-slate-400 border-transparent hover:text-slate-700'
                  }`}
                >
                  Deudores (alertas)
                  {!loading && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
                      {debtors.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="relative w-full lg:w-[420px]">
                <Icon
                  name="Search"
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar alumno por nombre..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4 w-[140px]">Fecha</th>
                  <th className="px-6 py-4">Cliente / Alumno</th>
                  <th className="px-6 py-4">Concepto</th>
                  <th className="px-6 py-4 w-[160px]">Método</th>
                  <th className="px-6 py-4 text-right w-[160px]">Monto</th>
                  {activeTab === 'debtors' && (
                    <th className="px-6 py-4 text-right w-[120px]">Acción</th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                      <td className="px-6 py-4"><div className="h-3 bg-slate-100 rounded w-40" /></td>
                      <td className="px-6 py-4"><div className="h-3 bg-slate-100 rounded w-56" /></td>
                      <td className="px-6 py-4"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-3 bg-slate-100 rounded w-24 ml-auto" /></td>
                      {activeTab === 'debtors' && (
                        <td className="px-6 py-4 text-right"><div className="h-8 bg-slate-100 rounded w-20 ml-auto" /></td>
                      )}
                    </tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'debtors' ? 6 : 5} className="px-6 py-16 text-center text-slate-400">
                      <Icon name="Inbox" size={34} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-black uppercase tracking-widest">Sin registros</p>
                      <p className="text-sm font-medium mt-1">Probá cambiar la búsqueda o la pestaña.</p>
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
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => {
                          if (row.athleteId) navigate(`/individual-athlete-profile/${row.athleteId}`);
                        }}
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                          {formatTxDateTime(row.payment_date)}
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-slate-900">{row.athleteName}</p>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold">
                            {row.concept || 'Pago registrado'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {activeTab === 'transactions' ? (
                            <span className="text-sm font-semibold text-slate-700">
                              {mapMethodLabel(row.method)}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  isPastDue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {isPastDue ? 'Vencido' : 'Pendiente'}
                              </span>
                              {row.daysOverdue > 0 && (
                                <span className="text-[11px] font-bold text-slate-500">
                                  {row.daysOverdue}d
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span
                            className={`text-sm font-black ${
                              isPaid ? 'text-emerald-600' : 'text-rose-600'
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
                              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors"
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
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-xs font-bold text-slate-400">
              Mostrando{' '}
              <span className="text-slate-700">
                {totalRows === 0 ? 0 : pageStart + 1}
              </span>{' '}
              a{' '}
              <span className="text-slate-700">
                {Math.min(pageEnd, totalRows)}
              </span>{' '}
              de{' '}
              <span className="text-slate-700">{totalRows}</span>{' '}
              {activeTab === 'transactions' ? 'movimientos' : 'deudas'}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  safePage <= 1
                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Anterior
              </button>

              <span className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-black text-slate-700">
                {safePage}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  safePage >= totalPages
                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </>
  );
};

export default PaymentManagement;