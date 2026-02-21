import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
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
      
      const todayDate = new Date();
      const today = todayDate.toISOString().split('T')[0];

      // Array con las fechas de los últimos 7 días (para el gráfico)
      const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - 6 + i);
        return d.toISOString().split('T')[0];
      });

      // --- 1. CONSULTAS A BASE DE DATOS (Múltiples Promesas para rapidez) ---
      const [
        { count: activeAthletes },
        { count: totalAthletes },
        { data: pendingPayments },
        { count: attendanceToday },
        { data: attendance7Days },
        { data: metrics7Days },
        { data: todaysSessions },
        { data: overduePayments }
      ] = await Promise.all([
        supabase.from('athletes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('athletes').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').neq('status', 'paid'),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'present'),
        supabase.from('attendance').select('date, session_id').in('date', last7Days).eq('status', 'present'),
        supabase.from('metrics').select('date, value').in('date', last7Days),
        supabase.from('sessions').select(`
          id, time, capacity, status, type,
          plans ( name ),
          coaches ( profiles ( full_name, avatar_url ) )
        `).eq('session_date', today).order('time', { ascending: true }),
        supabase.from('payments').select(`
          id, payment_date, amount,
          athletes ( id, profile_id, profiles ( full_name ) )
        `).neq('status', 'paid').lt('payment_date', today).limit(5)
      ]);

      // --- 2. PROCESAMIENTO DE DATOS REALES ---
      
      // A. Cálculos de Pagos
      const pendingAmount = pendingPayments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const pendingCount = pendingPayments?.length || 0;

      // B. Cálculos de Rendimiento (Promedio de los últimos 7 días)
      const avgPerformance = metrics7Days?.length > 0 
        ? (metrics7Days.reduce((sum, m) => sum + Number(m.value), 0) / metrics7Days.length).toFixed(1)
        : "0.0";

      // C. Armado de KPIs
      setKpiStats([
        {
          title: "Atletas Activos",
          value: activeAthletes || 0,
          trend: "neutral", // En el futuro puedes comparar con el mes pasado
          trendValue: "",
          icon: "Users",
          threshold: "green",
          subtitle: `De ${totalAthletes || 0} totales`
        },
        {
          title: "Asistencia Hoy",
          value: attendanceToday || 0,
          trend: "neutral",
          trendValue: "",
          icon: "TrendingUp",
          threshold: attendanceToday > 0 ? "green" : "yellow",
          subtitle: "Check-ins registrados"
        },
        {
          title: "Pagos Pendientes",
          value: pendingCount,
          trend: pendingCount > 5 ? "down" : "neutral",
          trendValue: pendingCount > 0 ? "Requiere atención" : "Al día",
          icon: "CreditCard",
          threshold: pendingCount > 10 ? "red" : pendingCount > 0 ? "yellow" : "green",
          subtitle: `$${pendingAmount.toLocaleString('es-AR')} total`
        },
        {
          title: "Rendimiento Prom.",
          value: avgPerformance,
          trend: "up",
          trendValue: "Últ. 7 días",
          icon: "Award",
          threshold: avgPerformance >= 7 ? "green" : "yellow",
          subtitle: "Puntuación global"
        }
      ]);

      // --- 3. ALERTAS (Reales) ---
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

      // --- 4. SESIONES DE HOY (Reales) ---
      const formattedSessions = todaysSessions?.map(s => {
        // Contamos cuántos check-ins reales hay para esta sesión específica hoy
        const realAttendanceCount = attendance7Days?.filter(a => a.date === today && a.session_id === s.id).length || 0;
        
        return {
          id: s.id,
          time: s.time || '00:00',
          coachName: s.coaches?.profiles?.full_name || 'Por asignar',
          coachAvatar: s.coaches?.profiles?.avatar_url,
          program: s.plans?.name || s.type || 'Entrenamiento',
          attendanceCount: realAttendanceCount, // ¡Dato real!
          capacity: s.capacity || 20,
          status: s.status || 'scheduled'
        };
      }) || [];

      setSessions(formattedSessions);

      // --- 5. GRÁFICO (Últimos 7 días reales) ---
      const realChartData = last7Days.map(dateStr => {
        // Obtenemos el nombre del día en español (ej: "Lun")
        const d = new Date(`${dateStr}T12:00:00`); // T12:00:00 evita problemas de zona horaria
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
        
        // Asistencia de ese día
        const dayAttendance = attendance7Days?.filter(a => a.date === dateStr).length || 0;
        
        // Promedio de rendimiento de ese día
        const dayMetrics = metrics7Days?.filter(m => m.date === dateStr) || [];
        const dayAvgPerf = dayMetrics.length > 0 
          ? (dayMetrics.reduce((sum, m) => sum + Number(m.value), 0) / dayMetrics.length).toFixed(1)
          : 0;

        return { 
          period: dayName.charAt(0).toUpperCase() + dayName.slice(1), // Capitaliza (lun -> Lun)
          attendance: dayAttendance, 
          performance: Number(dayAvgPerf) 
        };
      });

      setChartData(realChartData);
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
      interval = setInterval(fetchData, 30000); // Refrescar cada 30 segundos
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handlers
  const handleRefreshToggle = () => setAutoRefresh(!autoRefresh);
  
  const handleAlertAction = (alertId, action) => {
    if (action === 'view') navigate('/payment-management');
  };

  return (
    <>
      <Helmet>
        <title>Dashboard Principal - VC Fit</title>
      </Helmet>

      <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 md:p-10 pb-24">
        
        <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">
          
          {/* Header del Dashboard */}
          <div>
            <BreadcrumbTrail currentPath="/main-dashboard" />
            <DashboardHeader
              onRefreshToggle={handleRefreshToggle}
              autoRefresh={autoRefresh}
              lastUpdated={lastUpdated} 
            />
          </div>

          {/* GRID DE KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {loading 
              ? [1,2,3,4].map(i => <KPICard key={i} loading={true} />)
              : kpiStats.map((kpi, index) => <KPICard key={index} {...kpi} />)
            }
          </div>

          {/* GRÁFICO Y ALERTAS */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6 items-start">
            <div className="xl:col-span-8 w-full min-w-0">
              <AttendancePerformanceChart
                data={chartData}
                loading={loading}
                onDrillDown={() => navigate('/performance-analytics')} 
              />
            </div>
            <div className="xl:col-span-4 w-full min-w-0">
              <AlertFeed
                alerts={alerts}
                loading={loading}
                onActionClick={handleAlertAction} 
              />
            </div>
          </div>

          {/* SESIONES */}
          <div className="w-full">
            <SessionSummaryGrid 
              sessions={sessions} 
              loading={loading} 
            />
          </div>
          
        </div>
      </div>
    </>
  );
};

export default MainDashboard;