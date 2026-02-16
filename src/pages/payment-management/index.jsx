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
  const [allPayments, setAllPayments] = useState([]); // NUEVO: Copia maestra de datos
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
      
      // 1. AJUSTE DE FECHA: Normalizamos 'hoy' a las 00:00:00
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      // 2. Obtener Pagos desde Supabase
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select(`
          id, amount, status, payment_date, method, concept,
          athletes ( id, profiles ( full_name, avatar_url ) )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      // 3. Guardamos la copia maestra para filtros locales
      // Mapeamos un poco los datos para facilitar su uso en la tabla
      const processedPayments = paymentsData.map(p => ({
        ...p,
        athleteName: p.athletes?.profiles?.full_name || 'Desconocido',
        athleteId: p.athletes?.id,
        athleteImage: p.athletes?.profiles?.avatar_url,
        amountOwed: p.amount, // Para compatibilidad con la tabla de vencidos
        daysOverdue: p.status === 'overdue' || (p.status === 'pending' && new Date(p.payment_date) < today)
          ? Math.floor((today - new Date(p.payment_date)) / (1000 * 60 * 60 * 24))
          : 0
      }));

      setAllPayments(processedPayments);

      // 4. Procesar Métricas Financieras
      const currentMonthPayments = paymentsData.filter(p => p.payment_date >= startOfMonth && p.status === 'paid');
      const monthlyRevenue = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const totalDue = paymentsData.filter(p => p.status === 'pending' || p.status === 'overdue');
      
      // Cálculo preciso de monto vencido usando la fecha normalizada
      const overdueAmount = totalDue
        .filter(p => p.status === 'overdue' || new Date(p.payment_date) < today)
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
          trendValue: '+5.0%', // Esto idealmente vendría de comparar con mes anterior
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

      // 5. Procesar Gráficos (Métodos de Pago)
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

      // 6. Procesar Listas Específicas
      // Lista explícita de vencidos para cuando el filtro es 'overdue'
      const overdueList = processedPayments
        .filter(p => (p.status === 'overdue' || (p.status === 'pending' && new Date(p.payment_date) < today)));
      
      setOverduePayments(overdueList);

      const recent = processedPayments.slice(0, 5).map(p => ({
        id: p.id,
        athleteName: p.athleteName,
        athleteImage: p.athleteImage,
        description: p.concept || 'Pago registrado',
        amount: p.amount,
        method: p.method,
        status: p.status,
        timestamp: new Date(p.payment_date)
      }));
      setRecentTransactions(recent);

      // 7. Conteos para Filtros (Usando lógica consistente con las fechas)
      setFilterCounts({
        all: paymentsData.length,
        current: paymentsData.filter(p => p.status === 'paid').length,
        overdue: overdueList.length,
        pending: paymentsData.filter(p => p.status === 'pending' && new Date(p.payment_date) >= today).length
      });

      // 8. Datos dummy para gráfico de Revenue (Pendiente de conectar a real si deseas)
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

  // --- LÓGICA DE FILTRADO PARA LA TABLA PRINCIPAL ---
  const getFilteredPaymentsDisplay = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Si el filtro es 'overdue', usamos la lista ya procesada que incluye cálculos de días
    if (activeFilter === 'overdue') return overduePayments;

    // Para los otros filtros, filtramos sobre la copia maestra 'allPayments'
    return allPayments.filter(p => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'current') return p.status === 'paid';
      if (activeFilter === 'pending') return p.status === 'pending' && new Date(p.payment_date) >= today;
      return true;
    });
  };

  const paymentsToDisplay = getFilteredPaymentsDisplay();

  // --- HANDLERS ---
  const handleExportReport = async () => {
    console.log("Exportando...");
    // Aquí podrías implementar la lógica real de exportación
  };

  const handlePaymentSuccess = () => {
    fetchPaymentData();
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Pagos - VC Fit</title>
      </Helmet>
      
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
              {/* TABLA UNIFICADA E INTELIGENTE */}
              {/* Reutilizamos OverduePaymentsTable para mostrar todo, cambiando el 'mode' */}
              <OverduePaymentsTable
                // Si el filtro es Vencidos, activamos modo 'overdue' (columnas de días, acciones masivas)
                // Si es otro filtro, usamos modo 'all' (columnas estándar de historial)
                mode={activeFilter === 'overdue' ? 'overdue' : 'all'}
                payments={paymentsToDisplay}
                loading={loading}
                onSendReminder={() => console.log("Recordatorio enviado")} // Conectar con lógica real si existe
              />
            </div>
            <div className="lg:col-span-4">
              {/* <RecentTransactionsFeed 
                transactions={recentTransactions} 
                loading={loading} 
              /> */}
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