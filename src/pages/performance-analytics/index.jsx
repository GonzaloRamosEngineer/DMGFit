import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import PerformanceKPICard from './components/PerformanceKPICard';
import PerformanceScatterChart from './components/PerformanceScatterChart';
import PerformanceEvolutionChart from './components/PerformanceEvolutionChart';
import PerformanceLeaderboard from './components/PerformanceLeaderboard';
import PerformanceFilters from './components/PerformanceFilters';
import { useAuth } from '../../contexts/AuthContext';

const PerformanceAnalytics = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [filters, setFilters] = useState({
    athleteGroup: 'all',
    metric: 'overall',
    timePeriod: 'month',
    comparison: 'athlete-to-athlete',
    coach: 'all',
    program: 'all'
  });

  const kpiData = [
  {
    title: 'Puntuación Promedio',
    value: '78.5',
    unit: '/100',
    trend: 'up',
    trendValue: '+5.2%',
    icon: 'Activity',
    iconColor: 'var(--color-primary)'
  },
  {
    title: 'Tasa de Mejora',
    value: '24.3',
    unit: '%',
    trend: 'up',
    trendValue: '+3.8%',
    icon: 'TrendingUp',
    iconColor: 'var(--color-success)'
  },
  {
    title: 'Logro de Objetivos',
    value: '87',
    unit: '%',
    trend: 'up',
    trendValue: '+12%',
    icon: 'Target',
    iconColor: 'var(--color-accent)'
  },
  {
    title: 'Distribución de Rendimiento',
    value: '68',
    unit: '%',
    trend: 'down',
    trendValue: '-2.1%',
    icon: 'BarChart3',
    iconColor: 'var(--color-warning)'
  }];


  const scatterData = [
  { id: 1, name: 'Carlos Mendoza', attendance: 92, improvement: 32, score: 88, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_146869738-1763301602669.png", avatarAlt: 'Professional headshot of Hispanic man with short dark hair in athletic wear' },
  { id: 2, name: 'Ana Rodríguez', attendance: 88, improvement: 28, score: 85, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png", avatarAlt: 'Professional headshot of Hispanic woman with long brown hair in athletic wear' },
  { id: 3, name: 'Miguel Torres', attendance: 95, improvement: 35, score: 92, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png", avatarAlt: 'Professional headshot of Hispanic man with short black hair in athletic wear' },
  { id: 4, name: 'Laura Sánchez', attendance: 78, improvement: 18, score: 72, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png", avatarAlt: 'Professional headshot of Hispanic woman with shoulder-length brown hair in athletic wear' },
  { id: 5, name: 'Diego Ramírez', attendance: 85, improvement: 25, score: 80, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_146869738-1763301602669.png", avatarAlt: 'Professional headshot of Hispanic man with short dark hair in athletic wear' },
  { id: 6, name: 'Sofia García', attendance: 90, improvement: 30, score: 86, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png", avatarAlt: 'Professional headshot of Hispanic woman with long dark hair in athletic wear' },
  { id: 7, name: 'Roberto Fernández', attendance: 72, improvement: 15, score: 68, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png", avatarAlt: 'Professional headshot of Hispanic man with short brown hair in athletic wear' },
  { id: 8, name: 'María López', attendance: 82, improvement: 22, score: 76, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png", avatarAlt: 'Professional headshot of Hispanic woman with medium-length brown hair in athletic wear' },
  { id: 9, name: 'Javier Morales', attendance: 94, improvement: 33, score: 90, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_146869738-1763301602669.png", avatarAlt: 'Professional headshot of Hispanic man with short dark hair in athletic wear' },
  { id: 10, name: 'Carmen Ruiz', attendance: 86, improvement: 26, score: 82, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png", avatarAlt: 'Professional headshot of Hispanic woman with long brown hair in athletic wear' },
  { id: 11, name: 'Pedro Jiménez', attendance: 68, improvement: 12, score: 62, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png", avatarAlt: 'Professional headshot of Hispanic man with short black hair in athletic wear' },
  { id: 12, name: 'Isabel Martín', attendance: 91, improvement: 29, score: 87, avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png", avatarAlt: 'Professional headshot of Hispanic woman with shoulder-length dark hair in athletic wear' }];


  const evolutionData = [
  { month: 'Ene', carlosMendoza: 65, anaRodriguez: 72, miguelTorres: 68, lauraSanchez: 58 },
  { month: 'Feb', carlosMendoza: 68, anaRodriguez: 74, miguelTorres: 71, lauraSanchez: 60 },
  { month: 'Mar', carlosMendoza: 72, anaRodriguez: 76, miguelTorres: 75, lauraSanchez: 63 },
  { month: 'Abr', carlosMendoza: 75, anaRodriguez: 78, miguelTorres: 78, lauraSanchez: 65 },
  { month: 'May', carlosMendoza: 80, anaRodriguez: 81, miguelTorres: 82, lauraSanchez: 68 },
  { month: 'Jun', carlosMendoza: 85, anaRodriguez: 83, miguelTorres: 86, lauraSanchez: 70 },
  { month: 'Jul', carlosMendoza: 88, anaRodriguez: 85, miguelTorres: 90, lauraSanchez: 72 }];


  const athletesForChart = [
  { id: 1, name: 'Carlos Mendoza', dataKey: 'carlosMendoza', color: '#FF4444' },
  { id: 2, name: 'Ana Rodríguez', dataKey: 'anaRodriguez', color: '#FFD700' },
  { id: 3, name: 'Miguel Torres', dataKey: 'miguelTorres', color: '#00D4FF' },
  { id: 4, name: 'Laura Sánchez', dataKey: 'lauraSanchez', color: '#30D158' }];


  const leaderboardAthletes = [
  {
    id: 1,
    name: 'Miguel Torres',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    avatarAlt: 'Professional headshot of Hispanic man with short black hair in athletic wear',
    category: 'Programa de Fuerza',
    score: 92,
    rankChange: 2,
    badge: 'top-performer'
  },
  {
    id: 2,
    name: 'Carlos Mendoza',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_146869738-1763301602669.png",
    avatarAlt: 'Professional headshot of Hispanic man with short dark hair in athletic wear',
    category: 'Programa HIIT',
    score: 88,
    rankChange: 1,
    badge: 'most-improved'
  },
  {
    id: 3,
    name: 'Isabel Martín',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png",
    avatarAlt: 'Professional headshot of Hispanic woman with shoulder-length dark hair in athletic wear',
    category: 'Programa Cardiovascular',
    score: 87,
    rankChange: -1,
    badge: null
  },
  {
    id: 4,
    name: 'Sofia García',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png",
    avatarAlt: 'Professional headshot of Hispanic woman with long dark hair in athletic wear',
    category: 'Programa de Fuerza',
    score: 86,
    rankChange: 0,
    badge: null
  },
  {
    id: 5,
    name: 'Ana Rodríguez',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png",
    avatarAlt: 'Professional headshot of Hispanic woman with long brown hair in athletic wear',
    category: 'Programa de Flexibilidad',
    score: 85,
    rankChange: 3,
    badge: 'consistent'
  },
  {
    id: 6,
    name: 'Carmen Ruiz',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png",
    avatarAlt: 'Professional headshot of Hispanic woman with long brown hair in athletic wear',
    category: 'Programa HIIT',
    score: 82,
    rankChange: -2,
    badge: null
  },
  {
    id: 7,
    name: 'Diego Ramírez',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_146869738-1763301602669.png",
    avatarAlt: 'Professional headshot of Hispanic man with short dark hair in athletic wear',
    category: 'Programa de Fuerza',
    score: 80,
    rankChange: 1,
    badge: null
  },
  {
    id: 8,
    name: 'María López',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png",
    avatarAlt: 'Professional headshot of Hispanic woman with medium-length brown hair in athletic wear',
    category: 'Programa Cardiovascular',
    score: 76,
    rankChange: 0,
    badge: null
  },
  {
    id: 9,
    name: 'Laura Sánchez',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7334929-1763296602139.png",
    avatarAlt: 'Professional headshot of Hispanic woman with shoulder-length brown hair in athletic wear',
    category: 'Programa de Flexibilidad',
    score: 72,
    rankChange: -1,
    badge: null
  },
  {
    id: 10,
    name: 'Roberto Fernández',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    avatarAlt: 'Professional headshot of Hispanic man with short brown hair in athletic wear',
    category: 'Programa HIIT',
    score: 68,
    rankChange: -3,
    badge: null
  }];


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
  };

  const handleAthleteClick = (athlete) => {
    console.log('Navigating to athlete profile:', athlete);
    navigate('/individual-athlete-profile');
  };

  const alertData = {
    dashboard: 3,
    atletas: 5,
    rendimiento: 0,
    pagos: 8
  };

  // Role-based data filtering
  const visibleAthletes = React.useMemo(() => {
    if (currentUser?.role === 'admin') {
      return scatterData;
    } else if (currentUser?.role === 'profesor') {
      // Filter athletes assigned to this professor
      const professorAthletes = ['Carlos Mendoza', 'Miguel Torres', 'Sofia García', 'Javier Morales', 'Isabel Martín'];
      return scatterData?.filter(athlete => 
        professorAthletes?.includes(athlete?.name)
      );
    }
    return [];
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-background">
      <NavigationSidebar
        isCollapsed={sidebarCollapsed}
        userRole="coach"
        alertData={alertData} />

      <main className={`transition-smooth ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <BreadcrumbTrail
            currentPath="/performance-analytics"
            entityData={{}} />


          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
              Análisis de Rendimiento
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Análisis comparativo y seguimiento de tendencias de rendimiento de atletas
            </p>
          </div>

          <PerformanceFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            onExport={handleExport} />


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            {kpiData?.map((kpi, index) =>
            <PerformanceKPICard key={index} {...kpi} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="lg:col-span-9">
              <PerformanceScatterChart
                data={visibleAthletes}
                onAthleteClick={handleAthleteClick} />

            </div>

            <div className="lg:col-span-3">
              <PerformanceLeaderboard
                athletes={leaderboardAthletes}
                onAthleteClick={handleAthleteClick} />

            </div>
          </div>

          <div className="mb-6 md:mb-8">
            <PerformanceEvolutionChart
              data={evolutionData}
              athletes={athletesForChart} />

          </div>
        </div>
      </main>
    </div>);

};

export default PerformanceAnalytics;