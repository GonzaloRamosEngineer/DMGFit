import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import DashboardHeader from './components/DashboardHeader';
import KPICard from './components/KPICard';
import AttendancePerformanceChart from './components/AttendancePerformanceChart';
import AlertFeed from './components/AlertFeed';
import SessionSummaryGrid from './components/SessionSummaryGrid';
import { generateDashboardSummaryPDF } from '../../utils/pdfExport';
import { useAuth } from '../../contexts/AuthContext';

const MainDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const kpiData = [
  {
    title: "Atletas Activos",
    value: "487",
    trend: "up",
    trendValue: "+12.5%",
    icon: "Users",
    threshold: "green",
    subtitle: "De 520 totales"
  },
  {
    title: "Asistencia Diaria",
    value: "87.5%",
    trend: "up",
    trendValue: "+3.2%",
    icon: "TrendingUp",
    threshold: "green",
    subtitle: "426 de 487 atletas"
  },
  {
    title: "Pagos Pendientes",
    value: "23",
    trend: "down",
    trendValue: "-5 desde ayer",
    icon: "CreditCard",
    threshold: "yellow",
    subtitle: "€12,450 total"
  },
  {
    title: "Rendimiento Promedio",
    value: "8.2",
    trend: "up",
    trendValue: "+0.4 puntos",
    icon: "Award",
    threshold: "green",
    subtitle: "De 10 puntos"
  }];


  const chartData = [
  { period: "Lun", attendance: 85, performance: 7.8 },
  { period: "Mar", attendance: 88, performance: 8.1 },
  { period: "Mié", attendance: 90, performance: 8.3 },
  { period: "Jue", attendance: 87, performance: 8.0 },
  { period: "Vie", attendance: 92, performance: 8.5 },
  { period: "Sáb", attendance: 78, performance: 7.5 },
  { period: "Dom", attendance: 65, performance: 7.2 }];


  const alertsData = [
  {
    id: "alert-001",
    severity: "critical",
    title: "Pago Vencido - 15 días",
    description: "El atleta no ha realizado el pago mensual desde hace 15 días. Contacto requerido urgente.",
    athleteName: "Carlos Rodríguez",
    timestamp: new Date(Date.now() - 3600000),
    actionable: true,
    actionLabel: "Enviar Recordatorio"
  },
  {
    id: "alert-002",
    severity: "warning",
    title: "Caída en Asistencia",
    description: "Asistencia reducida en un 40% en las últimas 2 semanas. Posible riesgo de abandono.",
    athleteName: "María González",
    timestamp: new Date(Date.now() - 7200000),
    actionable: true,
    actionLabel: "Contactar"
  },
  {
    id: "alert-003",
    severity: "critical",
    title: "Rendimiento Bajo Crítico",
    description: "Rendimiento ha caído por debajo del 60% en las últimas 3 sesiones. Revisión necesaria.",
    athleteName: "Juan Martínez",
    timestamp: new Date(Date.now() - 10800000),
    actionable: true,
    actionLabel: "Revisar Plan"
  },
  {
    id: "alert-004",
    severity: "warning",
    title: "Pago Próximo a Vencer",
    description: "El pago mensual vence en 3 días. Enviar recordatorio preventivo.",
    athleteName: "Ana López",
    timestamp: new Date(Date.now() - 14400000),
    actionable: true,
    actionLabel: "Recordar"
  },
  {
    id: "alert-005",
    severity: "info",
    title: "Sesión Cancelada",
    description: "Sesión de entrenamiento de fuerza cancelada por el entrenador. Atletas notificados.",
    timestamp: new Date(Date.now() - 18000000),
    actionable: false
  }];


  const sessionsData = [
  {
    id: "session-001",
    time: "08:00 - 09:00",
    coachName: "Pedro Sánchez",
    coachAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_158e62332-1763301703419.png",
    coachAvatarAlt: "Retrato profesional de entrenador masculino con cabello corto negro y sonrisa amigable",
    program: "Entrenamiento de Fuerza",
    attendanceCount: 12,
    capacity: 15,
    status: "completed"
  },
  {
    id: "session-002",
    time: "09:30 - 10:30",
    coachName: "Laura Fernández",
    coachAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_13d9b8182-1763297243123.png",
    coachAvatarAlt: "Retrato profesional de entrenadora femenina con cabello rubio recogido y expresión profesional",
    program: "Cardio Intensivo",
    attendanceCount: 18,
    capacity: 20,
    status: "ongoing"
  },
  {
    id: "session-003",
    time: "11:00 - 12:00",
    coachName: "Miguel Torres",
    coachAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_158e62332-1763301703419.png",
    coachAvatarAlt: "Retrato profesional de entrenador masculino con barba corta y uniforme deportivo negro",
    program: "Yoga y Flexibilidad",
    attendanceCount: 0,
    capacity: 12,
    status: "scheduled"
  },
  {
    id: "session-004",
    time: "16:00 - 17:00",
    coachName: "Carmen Ruiz",
    coachAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_17f9ba51f-1763294104164.png",
    coachAvatarAlt: "Retrato profesional de entrenadora femenina con cabello castaño y sonrisa confiada",
    program: "CrossFit Avanzado",
    attendanceCount: 0,
    capacity: 18,
    status: "scheduled"
  },
  {
    id: "session-005",
    time: "18:00 - 19:00",
    coachName: "David Moreno",
    coachAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_198990fe5-1763296087292.png",
    coachAvatarAlt: "Retrato profesional de entrenador masculino con gafas deportivas y expresión motivadora",
    program: "Entrenamiento Funcional",
    attendanceCount: 0,
    capacity: 16,
    status: "scheduled"
  }];


  const alertBadgeData = {
    dashboard: 0,
    atletas: 3,
    rendimiento: 1,
    pagos: 23
  };

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        setLastUpdated(new Date());
        console.log('Dashboard data refreshed at:', new Date()?.toLocaleTimeString());
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const handleDateRangeChange = (range) => {
    console.log('Date range changed to:', range);
    setLastUpdated(new Date());
  };

  const handleRefreshToggle = () => {
    setAutoRefresh(!autoRefresh);
    setLastUpdated(new Date());
  };

  const handleChartDrillDown = (data) => {
    console.log('Drill down clicked for:', data);
    navigate('/performance-analytics');
  };

  const handleAlertAction = (alertId, action) => {
    console.log(`Alert action: ${action} for alert: ${alertId}`);
    if (action === 'view') {
      navigate('/athletes-management');
    }
  };

  const handleExportSummary = async () => {
    try {
      await generateDashboardSummaryPDF(
        kpiData,
        alertsData,
        chartData
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el resumen. Por favor, inténtalo de nuevo.');
    }
  };

  // Filter data based on user role
  const isAdmin = currentUser?.role === 'admin';
  const isProfesor = currentUser?.role === 'profesor';

  return (
    <div className="min-h-screen bg-background">
      <NavigationSidebar
        isCollapsed={sidebarCollapsed}
        userRole="coach"
        alertData={alertBadgeData} />

      <main className={`transition-smooth ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <BreadcrumbTrail currentPath="/main-dashboard" />

          <DashboardHeader
            onDateRangeChange={handleDateRangeChange}
            onRefreshToggle={handleRefreshToggle}
            autoRefresh={autoRefresh}
            lastUpdated={lastUpdated} />


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-4 md:mb-6">
            {kpiData?.map((kpi, index) =>
            <KPICard key={index} {...kpi} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-4 md:mb-6">
            <div className="lg:col-span-8">
              <AttendancePerformanceChart
                data={chartData}
                onDrillDown={handleChartDrillDown} />

            </div>
            <div className="lg:col-span-4">
              <AlertFeed
                alerts={alertsData}
                onActionClick={handleAlertAction} />

            </div>
          </div>

          <SessionSummaryGrid sessions={sessionsData} />
        </div>
      </main>
    </div>);

};

export default MainDashboard;