import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// UI Components
import Icon from '../../components/AppIcon';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';

// Payment Components
import AddPaymentModal from './components/AddPaymentModal';
import FinancialMetricCard from './components/FinancialMetricCard';
import RevenueChart from './components/RevenueChart';
import PaymentMethodChart from './components/PaymentMethodChart';
import RecentTransactionsFeed from './components/RecentTransactionsFeed'; 
import OverduePaymentsTable from './components/OverduePaymentsTable';     
import PaymentStatusFilter from './components/PaymentStatusFilter';
import DateRangeSelector from './components/DateRangeSelector';
import AutomatedReminderControl from './components/AutomatedReminderControl';

// Servicio de Generación de Cuotas (Fase 2)
import { generateMonthlyInvoices } from '../../services/payments'; 

const PaymentManagement = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // Estado para el botón mágico
  
  // Filtros
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedRange, setSelectedRange] = useState('thisMonth');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  // Datos
  const [allPayments, setAllPayments] = useState([]);
  const [financialMetrics, setFinancialMetrics] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [paymentMethodData, setPaymentMethodData] = useState([]);
  const [overduePayments, setOverduePayments] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [filterCounts, setFilterCounts] = useState({ all: 0, current: 0, overdue: 0, pending: 0 });

  const [reminderSettings, setReminderSettings] = useState({
    enabled: true, frequency: 'weekly', channels: ['email', 'sms']
  });

  const fetchPaymentData = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select(`
          id, amount, status, payment_date, method, concept,
          athletes ( id, profiles ( full_name, avatar_url ) )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      // --- PROCESAMIENTO DE DATOS ---
      const processedPayments = paymentsData.map(p => ({
        ...p,
        athleteName: p.athletes?.profiles?.full_name || 'Desconocido',
        athleteId: p.athletes?.id,
        athleteImage: p.athletes?.profiles?.avatar_url,
        amountOwed: p.amount,
        daysOverdue: p.status === 'overdue' || (p.status === 'pending' && new Date(p.payment_date) < today)
          ? Math.floor((today - new Date(p.payment_date)) / (1000 * 60 * 60 * 24))
          : 0
      }));

      setAllPayments(processedPayments);

      // Métricas
      const currentMonthPayments = paymentsData.filter(p => p.payment_date >= startOfMonth && p.status === 'paid');
      const monthlyRevenue = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalDue = paymentsData.filter(p => p.status === 'pending' || p.status === 'overdue');
      const overdueAmount = totalDue
        .filter(p => p.status === 'overdue' || new Date(p.payment_date) < today)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const collectionRate = paymentsData.length > 0 
        ? Math.round((paymentsData.filter(p => p.status === 'paid').length / paymentsData.length) * 100) 
        : 0;

      setFinancialMetrics([
        {
          title: 'Ingresos Mensuales', value: monthlyRevenue, currency: '$',
          trend: 'up', trendValue: '+5.0%', icon: 'TrendingUp', color: 'emerald'
        },
        {
          title: 'Tasa de Cobro', value: `${collectionRate}%`,
          trend: collectionRate > 90 ? 'up' : 'down', trendValue: collectionRate > 90 ? 'Excelente' : 'Mejorable',
          icon: 'Activity', color: 'blue'
        },
        {
          title: 'Monto Vencido', value: overdueAmount, currency: '$',
          trend: overdueAmount > 0 ? 'down' : 'up', trendValue: overdueAmount > 0 ? 'Atención' : 'Limpio',
          icon: 'AlertTriangle', color: 'rose', isAlert: overdueAmount > 0
        },
        {
          title: 'Pagos Pendientes', value: totalDue.length,
          trend: 'neutral', trendValue: 'Total', icon: 'Clock', color: 'amber'
        }
      ]);

      // Gráficos
      const methodsCount = paymentsData.reduce((acc, p) => {
        const method = p.method || 'otros';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});
      
      const methodChartData = Object.keys(methodsCount).map(key => ({
        method: key, name: key.charAt(0).toUpperCase() + key.slice(1),
        value: methodsCount[key], percentage: Math.round((methodsCount[key] / paymentsData.length) * 100)
      }));
      setPaymentMethodData(methodChartData);

      const overdueList = processedPayments.filter(p => (p.status === 'overdue' || (p.status === 'pending' && new Date(p.payment_date) < today)));
      setOverduePayments(overdueList);

      const recent = processedPayments.slice(0, 5).map(p => ({
        id: p.id, athleteName: p.athleteName, athleteImage: p.athleteImage,
        description: p.concept || 'Pago registrado', amount: p.amount,
        method: p.method, status: p.status, timestamp: new Date(p.payment_date)
      }));
      setRecentTransactions(recent);

      setFilterCounts({
        all: paymentsData.length,
        current: paymentsData.filter(p => p.status === 'paid').length,
        overdue: overdueList.length,
        pending: paymentsData.filter(p => p.status === 'pending' && new Date(p.payment_date) >= today).length
      });

      // Dummy Data para gráfico temporal (FIXME: Conectar a datos reales de backend)
      setRevenueData([
        { month: 'Ene', efectivo: 12000, tarjeta: 15000, transferencia: 5000 },
        { month: 'Feb', efectivo: 11000, tarjeta: 16000, transferencia: 6000 },
        { month: 'Mar', efectivo: 13000, tarjeta: 18000, transferencia: 7000 },
      ]); 

    } catch (error) {
      console.error("Error cargando pagos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentData();
  }, [fetchPaymentData]);

  // Manejador del Botón "Generar Periodo" (Fase 2)
  const handleGenerateInvoices = async () => {
    try {
      setIsGenerating(true);
      // Asumimos que la función generateMonthlyInvoices devuelve { created: number, message: string }
      const result = await generateMonthlyInvoices(); 
      
      // Mostrar feedback simple (podrías usar un toast aquí)
      if(result?.message) alert(result.message);
      
      // Recargar datos para ver los nuevos pendientes
      await fetchPaymentData();
    } catch (error) {
      console.error("Error generando cuotas:", error);
      alert("Hubo un error al generar las cuotas.");
    } finally {
      setIsGenerating(false);
    }
  };

  const paymentsToDisplay = activeFilter === 'overdue' ? overduePayments : allPayments.filter(p => {
    const today = new Date(); today.setHours(0,0,0,0);
    if (activeFilter === 'all') return true;
    if (activeFilter === 'current') return p.status === 'paid';
    if (activeFilter === 'pending') return p.status === 'pending' && new Date(p.payment_date) >= today;
    return true;
  });

  return (
    <>
      <Helmet><title>Gestión de Pagos - VC Fit</title></Helmet>
      
      <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 pb-24">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
             <BreadcrumbTrail items={[{ label: 'Administración', path: '/admin' }, { label: 'Pagos', active: true }]} />
             <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2">
               Gestión Financiera
             </h1>
             <p className="text-slate-500 font-medium mt-1">Control de flujo de caja y suscripciones</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
             <button 
               onClick={handleGenerateInvoices}
               disabled={isGenerating}
               className={`flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-xs uppercase tracking-wider shadow-lg transition-all ${isGenerating ? 'opacity-70 cursor-wait' : ''}`}
             >
                <Icon name={isGenerating ? "Loader" : "RefreshCw"} size={16} className={isGenerating ? "animate-spin" : ""} /> 
                {isGenerating ? 'Generando...' : 'Generar Periodo'}
             </button>

             <button 
               onClick={() => setIsModalOpen(true)}
               className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all"
             >
                <Icon name="PlusCircle" size={16} /> Registrar Pago
             </button>
          </div>
        </div>

        {/* KPI STRIP */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
           {loading ? (
             [1,2,3,4].map(i => <FinancialMetricCard key={i} loading={true} />)
           ) : (
             financialMetrics.map((metric, index) => <FinancialMetricCard key={index} {...metric} />)
           )}
        </div>

        {/* --- GRID MAESTRO ASIMÉTRICO (12 COLUMNAS) --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA (Principal - 8/12) */}
          <div className="xl:col-span-8 space-y-8 w-full min-w-0">
             
             {/* Filtros */}
             <div className="bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-20">
                <PaymentStatusFilter 
                  activeFilter={activeFilter} 
                  onFilterChange={setActiveFilter} 
                  counts={filterCounts} 
                  loading={loading}
                />
                <div className="w-full md:w-auto">
                   <DateRangeSelector 
                     selectedRange={selectedRange} 
                     onRangeChange={setSelectedRange} 
                     customDates={customDates}
                     onCustomDatesChange={setCustomDates}
                     loading={loading}
                   />
                </div>
             </div>

             {/* Alerta de Deudores */}
             {activeFilter === 'all' && filterCounts.overdue > 0 && (
               <div className="bg-rose-50 rounded-[2rem] border border-rose-100 p-6 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-3 mb-4 text-rose-800">
                     <div className="p-2 bg-rose-100 rounded-lg"><Icon name="AlertCircle" size={20} /></div>
                     <h3 className="font-bold text-lg">Atención Requerida</h3>
                  </div>
                  <OverduePaymentsTable payments={overduePayments} loading={loading} mode="compact" />
               </div>
             )}

             {/* Tabla Principal */}
             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                   <div>
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                          <Icon name="List" className="text-blue-500" />
                          {activeFilter === 'overdue' ? 'Gestión de Morosidad' : 'Registro de Transacciones'}
                      </h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 ml-8">
                        {paymentsToDisplay.length} Movimientos encontrados
                      </p>
                   </div>
                </div>
                
                <div className="flex-1 p-2">
                  {activeFilter === 'overdue' ? (
                     <OverduePaymentsTable payments={paymentsToDisplay} loading={loading} mode="full" />
                  ) : (
                     <RecentTransactionsFeed transactions={paymentsToDisplay} loading={loading} mode="table" /> 
                  )}
                </div>
             </div>
          </div>

          {/* COLUMNA DERECHA (Analítica - 4/12) */}
          <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-6 w-full min-w-0">
             
             {/* Gráfico Ingresos */}
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
                <div className="flex justify-between items-center mb-6 relative z-10">
                   <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                      <Icon name="BarChart2" className="text-emerald-500" /> Ingresos
                   </h3>
                </div>
                {/* Forzamos altura para evitar colapso */}
                <div className="h-64 w-full relative z-10">
                   <RevenueChart data={revenueData} loading={loading} />
                </div>
                {/* Decoración de fondo */}
                <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-emerald-50/50 to-transparent pointer-events-none"></div>
             </div>

             {/* Gráfico Métodos */}
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="mb-2">
                   <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                      <Icon name="PieChart" className="text-blue-500" /> Métodos de Pago
                   </h3>
                </div>
                <div className="h-[340px] w-full">
                   <PaymentMethodChart data={paymentMethodData} loading={loading} />
                </div>
             </div>

             {/* Automatización */}
             <div className="bg-[#0F172A] text-white p-6 rounded-[2.5rem] shadow-2xl shadow-slate-900/20 relative overflow-hidden">
                {/* Efecto de luz */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10"></div>
                
                <div className="relative z-10">
                   <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md text-yellow-400">
                         <Icon name="Zap" size={20} />
                      </div>
                      <div>
                         <h3 className="font-black text-sm uppercase tracking-widest text-white">Piloto Automático</h3>
                         <p className="text-[10px] text-slate-400 font-bold">Gestión de Cobranzas AI</p>
                      </div>
                   </div>
                   <AutomatedReminderControl 
                     settings={reminderSettings} 
                     onSettingsChange={setReminderSettings} 
                     loading={loading} 
                   />
                </div>
             </div>

          </div>

        </div>
      </div>

      {isModalOpen && (
        <AddPaymentModal 
           onClose={() => setIsModalOpen(false)} 
           onSuccess={() => {
              fetchPaymentData();
              setIsModalOpen(false);
           }} 
        />
      )}
    </>
  );
};

export default PaymentManagement;