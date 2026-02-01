import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { generateDashboardSummaryPDF } from '../../utils/pdfExport';

// Componentes UI
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';

// Componentes del Dashboard
import DashboardHeader from './components/DashboardHeader';
import KPICard from './components/KPICard';
import AttendancePerformanceChart from './components/AttendancePerformanceChart';
import AlertFeed from './components/AlertFeed';
import SessionSummaryGrid from './components/SessionSummaryGrid';

const MainDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Estados de UI
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Estados de Datos
  const [kpiStats, setKpiStats] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [alertBadgeCount, setAlertBadgeCount] = useState({
    dashboard: 0,
    atletas: 0,
    rendimiento: 0,
    pagos: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // --- 1. CARGA DE KPIs ---
      // A. Total Atletas Activos
      const { count: activeAthletes } = await supabase
        .from('athletes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // B. Total de Atletas (para el porcentaje)
      const { count: totalAthletes } = await supabase
        .from('athletes')
        .select('*', { count: 'exact', head: true });

      // C. Pagos Pendientes (Monto estimado y cantidad)
      const { data: pendingPayments } = await supabase
        .from('payments')
        .select('amount')
        .neq('status', 'paid');
      
      const pendingAmount = pendingPayments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const pendingCount = pendingPayments?.length || 0;

      // D. Asistencia de Hoy (Estimada basándonos en check-ins de hoy)
      const { count: attendanceToday } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'present');

      // Construimos el Array de KPIs
      setKpiStats([
        {
          title: "Atletas Activos",
          value: activeAthletes || 0,
          trend: "up",
          trendValue: "+1.2%",
          icon: "Users",
          threshold: "green",
          subtitle: `De ${totalAthletes || 0} totales`
        },
        {
          title: "Asistencia Hoy",
          value: attendanceToday || 0,
          trend: "neutral",
          trendValue: "0%",
          icon: "TrendingUp",
          threshold: attendanceToday > 0 ? "green" : "yellow",
          subtitle: "Check-ins registrados"
        },
        {
          title: "Pagos Pendientes",
          value: pendingCount,
          trend: pendingCount > 5 ? "down" : "up",
          trendValue: pendingCount > 0 ? "Atención requerida" : "Al día",
          icon: "CreditCard",
          threshold: pendingCount > 10 ? "red" : pendingCount > 0 ? "yellow" : "green",
          subtitle: `$${pendingAmount.toLocaleString()} total`
        },
        {
          title: "Rendimiento Prom.",
          value: "8.4",
          trend: "up",
          trendValue: "+0.2",
          icon: "Award",
          threshold: "green",
          subtitle: "Puntos de métrica"
        }
      ]);

      // --- 2. ALERTAS (Basadas en Pagos) ---
      const { data: overduePayments } = await supabase
        .from('payments')
        .select(`
          id, payment_date, amount,
          athletes ( id, profile_id, profiles ( full_name ) )
        `)
        .neq('status', 'paid')
        .lt('payment_date', today)
        .limit(5);

      const generatedAlerts = overduePayments?.map(p => ({
        id: `pay-${p.id}`,
        severity: 'critical',
        title: 'Pago Vencido',
        description: `El pago de $${p.amount} venció el ${p.payment_date}.`,
        athleteName: p.athletes?.profiles?.full_name || 'Atleta Desconocido',
        timestamp: new Date(p.payment_date),
        actionable: true,
        actionLabel: 'Verificar'
      })) || [];

      if (generatedAlerts.length === 0) {
        generatedAlerts.push({
          id: 'sys-ok',
          severity: 'info',
          title: 'Sistema al día',
          description: 'No hay alertas críticas pendientes en este momento.',
          timestamp: new Date(),
          actionable: false
        });
      }
      setAlerts(generatedAlerts);
      setAlertBadgeCount(prev => ({ ...prev, pagos: pendingCount }));

      // --- 3. SESIONES DE HOY ---
      const { data: todaysSessions } = await supabase
        .from('sessions')
        .select(`
          id, time, capacity, status, type,
          plans ( name ),
          coaches ( 
            profiles ( full_name, avatar_url ) 
          )
        `)
        .eq('session_date', today)
        .order('time', { ascending: true });

      const formattedSessions = todaysSessions?.map(s => ({
        id: s.id,
        time: s.time || '00:00',
        coachName: s.coaches?.profiles?.full_name || 'Por asignar',
        coachAvatar: s.coaches?.profiles?.avatar_url,
        program: s.plans?.name || s.type || 'Entrenamiento',
        attendanceCount: Math.floor(Math.random() * (s.capacity || 10)),
        capacity: s.capacity || 20,
        status: s.status || 'scheduled'
      })) || [];

      setSessions(formattedSessions);

      // --- 4. GRÁFICO ---
      setChartData([
        { period: "Lun", attendance: 82, performance: 7.5 },
        { period: "Mar", attendance: 88, performance: 7.9 },
        { period: "Mié", attendance: 75, performance: 8.1 },
        { period: "Jue", attendance: 90, performance: 8.4 },
        { period: "Vie", attendance: 85, performance: 8.0 },
        { period: "Sáb", attendance: 60, performance: 7.2 },
        { period: "Dom", attendance: 40, performance: 7.0 }
      ]);

      setLastUpdated(new Date());

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handlers
  const handleRefreshToggle = () => setAutoRefresh(!autoRefresh);
  
  const handleAlertAction = (alertId, action) => {
    if (action === 'view') navigate('/payment-management');
    console.log(`Alert action: ${action} on ${alertId}`);
  };

  const handleExportSummary = async () => {
    await generateDashboardSummaryPDF(kpiStats, alerts, chartData);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full">
      <BreadcrumbTrail currentPath="/main-dashboard" />

      <DashboardHeader
        onRefreshToggle={handleRefreshToggle}
        autoRefresh={autoRefresh}
        lastUpdated={lastUpdated} 
      />

      {/* GRID DE KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-4 md:mb-6">
        {loading 
          ? [1,2,3,4].map(i => <KPICard key={i} loading={true} />)
          : kpiStats.map((kpi, index) => <KPICard key={index} {...kpi} />)
        }
      </div>

      {/* GRÁFICO Y ALERTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="lg:col-span-8">
          <AttendancePerformanceChart
            data={chartData}
            loading={loading}
            onDrillDown={() => navigate('/performance-analytics')} 
          />
        </div>
        <div className="lg:col-span-4">
          <AlertFeed
            alerts={alerts}
            loading={loading}
            onActionClick={handleAlertAction} 
          />
        </div>
      </div>

      {/* SESIONES */}
      <SessionSummaryGrid 
        sessions={sessions} 
        loading={loading} 
      />
    </div>
  );
};

export default MainDashboard;