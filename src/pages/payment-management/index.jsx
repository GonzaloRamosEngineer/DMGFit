import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// Componentes UI
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';

// Componentes de Pagos
import PaymentStatusFilter from './components/PaymentStatusFilter';
import DateRangeSelector from './components/DateRangeSelector';
import FinancialMetricCard from './components/FinancialMetricCard';
import RevenueChart from './components/RevenueChart';
import OverduePaymentsTable from './components/OverduePaymentsTable';
import PaymentMethodChart from './components/PaymentMethodChart';
import RecentTransactionsFeed from './components/RecentTransactionsFeed';
import AutomatedReminderControl from './components/AutomatedReminderControl';
import AddPaymentModal from './components/AddPaymentModal';

const PaymentManagement = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Estado para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados de Filtros
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedRange, setSelectedRange] = useState('thisMonth');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  // Estados de Datos
  const [financialMetrics, setFinancialMetrics] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [paymentMethodData, setPaymentMethodData] = useState([]);
  const [overduePayments, setOverduePayments] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [filterCounts, setFilterCounts] = useState({ all: 0, current: 0, overdue: 0, pending: 0 });

  const [reminderSettings, setReminderSettings] = useState({
    enabled: true, 
    frequency: 'weekly', 
    channels: ['email', 'sms']
  });

  // --- FUNCIÓN DE CARGA DE DATOS ---
  const fetchPaymentData = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      // 1. Obtener Pagos
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select(`
          id, amount, status, payment_date, method, concept,
          athletes ( id, profiles ( full_name, avatar_url ) )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      // 2. Procesar Métricas Financieras
      const currentMonthPayments = paymentsData.filter(p => p.payment_date >= startOfMonth && p.status === 'paid');
      const monthlyRevenue = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const totalDue = paymentsData.filter(p => p.status === 'pending' || p.status === 'overdue');
      const overdueAmount = totalDue.filter(p => p.status === 'overdue' || new Date(p.payment_date) < today)
                            .reduce((sum, p) => sum + Number(p.amount), 0);

      const collectionRate = paymentsData.length > 0 
        ? Math.round((paymentsData.filter(p => p.status === 'paid').length / paymentsData.length) * 100) 
        : 0;

      setFinancialMetrics([
        {
          title: 'Ingresos Mensuales',
          value: monthlyRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
          currency: '$',
          trend: 'up', 
          trendValue: '+5.0%',
          icon: 'TrendingUp', 
          iconColor: 'bg-success/20 text-success'
        },
        {
          title: 'Tasa de Cobro',
          value: `${collectionRate}%`,
          trend: collectionRate > 90 ? 'up' : 'down', 
          trendValue: collectionRate > 90 ? 'Excelente' : 'Mejorable',
          icon: 'Target', 
          iconColor: 'bg-primary/20 text-primary'
        },
        {
          title: 'Monto Vencido',
          value: overdueAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
          currency: '$',
          trend: overdueAmount > 0 ? 'down' : 'up', 
          trendValue: overdueAmount > 0 ? 'Atención' : 'Limpio',
          icon: 'AlertCircle', 
          iconColor: 'bg-error/20 text-error'
        },
        {
          title: 'Pagos Pendientes',
          value: totalDue.length,
          trend: 'neutral', 
          trendValue: 'Total',
          icon: 'Clock', 
          iconColor: 'bg-warning/20 text-warning'
        }
      ]);

      // 3. Procesar Gráficos (Métodos de Pago)
      const methodsCount = paymentsData.reduce((acc, p) => {
        const method = p.method || 'otros';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});
      
      const methodChartData = Object.keys(methodsCount).map(key => ({
        method: key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: methodsCount[key],
        percentage: Math.round((methodsCount[key] / paymentsData.length) * 100)
      }));
      setPaymentMethodData(methodChartData);

      // 4. Procesar Listas (Vencidos y Recientes)
      const overdue = paymentsData
        .filter(p => (p.status === 'overdue' || (p.status === 'pending' && new Date(p.payment_date) < today)))
        .map(p => ({
          id: p.id,
          athleteName: p.athletes?.profiles?.full_name || 'Desconocido',
          athleteId: p.athletes?.id,
          athleteImage: p.athletes?.profiles?.avatar_url,
          amountOwed: p.amount,
          daysOverdue: Math.floor((today - new Date(p.payment_date)) / (1000 * 60 * 60 * 24)),
          status: 'overdue'
        }));
      setOverduePayments(overdue);

      const recent = paymentsData.slice(0, 5).map(p => ({
        id: p.id,
        athleteName: p.athletes?.profiles?.full_name || 'Desconocido',
        athleteImage: p.athletes?.profiles?.avatar_url,
        description: p.concept || 'Pago registrado',
        amount: p.amount,
        method: p.method,
        status: p.status,
        timestamp: new Date(p.payment_date)
      }));
      setRecentTransactions(recent);

      // 5. Conteos para Filtros
      setFilterCounts({
        all: paymentsData.length,
        current: paymentsData.filter(p => p.status === 'paid').length,
        overdue: overdue.length,
        pending: paymentsData.filter(p => p.status === 'pending' && new Date(p.payment_date) >= today).length
      });

      // 6. Datos dummy para gráfico de Revenue
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

  // --- HANDLERS ---
  const handleExportReport = async () => {
    console.log("Exportando...");
  };

  const handlePaymentSuccess = () => {
    fetchPaymentData();
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Pagos - VC Fit</title>
      </Helmet>
      
      {/* REMOVED NavigationSidebar - ya está en AppLayout */}
      <div className="p-4 md:p-6 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbTrail currentPath="/payment-management" />

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
                Gestión de Pagos
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Control financiero y análisis de cobros en tiempo real
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="default" 
                onClick={handleExportReport} 
                iconName="Download" 
                iconPosition="left"
              >
                Exportar Reporte
              </Button>
              
              <Button 
                variant="default" 
                size="default" 
                iconName="Plus" 
                iconPosition="left"
                onClick={() => setIsModalOpen(true)}
              >
                Registrar Pago
              </Button>
            </div>
          </div>

          {/* Filtros y Rango */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
            <div className="lg:col-span-8 space-y-4">
              <PaymentStatusFilter
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                counts={filterCounts}
                loading={loading}
              />
            </div>
            <div className="lg:col-span-4">
              <DateRangeSelector
                selectedRange={selectedRange}
                onRangeChange={setSelectedRange}
                customDates={customDates}
                onCustomDatesChange={setCustomDates}
                loading={loading}
              />
            </div>
          </div>

          {/* Métricas Financieras */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            {loading ? (
               [1,2,3,4].map(i => <FinancialMetricCard key={i} loading={true} />)
            ) : (
               financialMetrics.map((metric, index) => <FinancialMetricCard key={index} {...metric} />)
            )}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
            <div className="lg:col-span-8">
              <RevenueChart data={revenueData} loading={loading} />
            </div>
            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <PaymentMethodChart data={paymentMethodData} loading={loading} />
              <AutomatedReminderControl
                settings={reminderSettings}
                onSettingsChange={setReminderSettings}
                loading={loading}
              />
            </div>
          </div>

          {/* Tablas Detalladas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-8">
              <OverduePaymentsTable
                payments={overduePayments}
                loading={loading}
                onSendReminder={() => {}}
              />
            </div>
            <div className="lg:col-span-4">
              <RecentTransactionsFeed 
                transactions={recentTransactions} 
                loading={loading} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE REGISTRO DE PAGO */}
      {isModalOpen && (
        <AddPaymentModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handlePaymentSuccess} 
        />
      )}
    </>
  );
};

export default PaymentManagement;