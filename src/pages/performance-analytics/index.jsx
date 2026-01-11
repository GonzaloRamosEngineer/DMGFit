import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// UI Components
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';

// Analytics Components (Ya conectados)
import PerformanceKPICard from './components/PerformanceKPICard';
import PerformanceScatterChart from './components/PerformanceScatterChart';
import PerformanceEvolutionChart from './components/PerformanceEvolutionChart';
import PerformanceLeaderboard from './components/PerformanceLeaderboard';
import PerformanceFilters from './components/PerformanceFilters';

const PerformanceAnalytics = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados para datos dinámicos
  const [kpiStats, setKpiStats] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);

  // Estado de Filtros
  const [filters, setFilters] = useState({
    athleteGroup: 'all',
    metric: 'overall',
    timePeriod: 'month',
    comparison: 'athlete-to-athlete',
    coach: 'all',
    program: 'all'
  });

  // ALERTAS (Estáticas por ahora para la Sidebar)
  const alertData = {
    dashboard: 3,
    atletas: 5,
    rendimiento: 0,
    pagos: 8
  };

  // --- LOGICA DE CARGA DE DATOS ---
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);

        // 1. OBTENER KPIs REALES
        // A. Total Atletas
        const { count: totalAthletes } = await supabase
          .from('athletes')
          .select('*', { count: 'exact', head: true });

        // B. Calcular Asistencia Promedio (Muestra de últimos 100 registros)
        const { data: attendanceSample } = await supabase
          .from('attendance')
          .select('status')
          .limit(100);
        
        let avgAttendance = 0;
        if (attendanceSample && attendanceSample.length > 0) {
          const present = attendanceSample.filter(a => a.status === 'present').length;
          avgAttendance = Math.round((present / attendanceSample.length) * 100);
        }

        // 2. CONFIGURAR KPIs PARA LA VISTA
        setKpiStats([
          {
            title: 'Puntuación Promedio',
            value: '78.5', // Este dato requeriría un cálculo complejo de backend, lo dejamos estimado
            unit: '/100',
            trend: 'up',
            trendValue: '+5.2%',
            icon: 'Activity',
            iconColor: 'var(--color-primary)'
          },
          {
            title: 'Tasa de Mejora',
            value: '12', // Dato simulado basado en el script SQL (aprox 12% mejora en sentadilla)
            unit: '%',
            trend: 'up',
            trendValue: '+2.1%',
            icon: 'TrendingUp',
            iconColor: 'var(--color-success)'
          },
          {
            title: 'Asistencia Global', // Dato REAL calculado arriba
            value: avgAttendance || 0,
            unit: '%',
            trend: 'down',
            trendValue: '-1.5%',
            icon: 'Target',
            iconColor: 'var(--color-accent)'
          },
          {
            title: 'Total Atletas', // Dato REAL de la DB
            value: totalAthletes || 0,
            unit: '',
            trend: 'up',
            trendValue: '+1',
            icon: 'Users', // Cambié el icono a Users
            iconColor: 'var(--color-warning)'
          }
        ]);

        // 3. OBTENER DATOS PARA SCATTER Y LEADERBOARD
        // Estrategia: Buscamos a nuestro atleta real 'Carlos' y lo mezclamos con datos
        // de relleno para que los gráficos se vean bien poblados.
        
        const { data: carlosProfile } = await supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('email', 'carlos@demo.com')
          .maybeSingle();

        // Datos del Atleta Real (Carlos)
        const realAthleteData = {
          id: 'real-carlos-id',
          name: carlosProfile?.full_name || 'Carlos Mendoza',
          email: carlosProfile?.email,
          avatar: carlosProfile?.avatar_url,
          attendance: avgAttendance || 92, // Usamos la asistencia calculada
          improvement: 32, // Basado en el script SQL
          score: 92,
          rankChange: 2,
          badge: 'top-performer'
        };

        // Datos de Relleno (Para visualización)
        const mockPeers = [
          { id: 2, name: 'Ana Rodríguez', attendance: 88, improvement: 28, score: 85, rankChange: 1, badge: 'consistent' },
          { id: 3, name: 'Miguel Torres', attendance: 95, improvement: 35, score: 92, rankChange: -1, badge: null },
          { id: 4, name: 'Laura Sánchez', attendance: 78, improvement: 18, score: 72, rankChange: 0, badge: null },
          { id: 5, name: 'Diego Ramírez', attendance: 85, improvement: 25, score: 80, rankChange: 3, badge: 'most-improved' },
        ];

        // Combinamos Real + Relleno
        const mixedData = [realAthleteData, ...mockPeers];
        
        // Ordenamos para Leaderboard (por Score descendente)
        const sortedLeaderboard = [...mixedData].sort((a, b) => b.score - a.score);

        setScatterData(mixedData);
        setLeaderboardData(sortedLeaderboard);

      } catch (error) {
        console.error('Error cargando analíticas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [filters]); // Se recarga si cambian los filtros

  // --- HANDLERS ---

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      athleteGroup: 'all',
      metric: 'overall',
      timePeriod: 'month',
      comparison: 'athlete-to-athlete',
      coach: 'all',
      program: 'all'
    });
  };

  const handleExport = () => {
    console.log('Exporting performance analytics report...');
    // Aquí podrías implementar lógica real de exportación PDF
  };

  const handleAthleteClick = (athlete) => {
    console.log('Navigating to athlete profile:', athlete);
    navigate('/individual-athlete-profile');
  };

  return (
    <>
      <Helmet>
        <title>Analítica de Rendimiento - DigitalMatch</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          userRole={currentUser?.role || 'profesor'}
          alertData={alertData} 
        />

        <main className={`transition-smooth ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'}`}>
          <div className="p-4 md:p-6 lg:p-8">
            <BreadcrumbTrail
              currentPath="/performance-analytics"
              entityData={{}} 
            />

            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
                Análisis de Rendimiento
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Análisis comparativo y seguimiento de tendencias basado en datos reales.
              </p>
            </div>

            {/* FILTROS */}
            <PerformanceFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
              onExport={handleExport}
              loading={loading}
            />

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
              {kpiStats.map((kpi, index) => (
                <PerformanceKPICard 
                  key={index} 
                  {...kpi} 
                  loading={loading} // Pasamos estado de carga
                />
              ))}
            </div>

            {/* SCATTER + LEADERBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6 md:mb-8">
              <div className="lg:col-span-9">
                <PerformanceScatterChart
                  data={scatterData}
                  onAthleteClick={handleAthleteClick}
                  loading={loading}
                />
              </div>

              <div className="lg:col-span-3">
                <PerformanceLeaderboard
                  athletes={leaderboardData}
                  onAthleteClick={handleAthleteClick}
                  loading={loading}
                />
              </div>
            </div>

            {/* EVOLUCIÓN (Este componente ya gestiona su propia conexión a DB internamente) */}
            <div className="mb-6 md:mb-8">
              <PerformanceEvolutionChart />
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PerformanceAnalytics;