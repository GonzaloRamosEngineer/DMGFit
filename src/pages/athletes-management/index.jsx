import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import MetricsStrip from './components/MetricsStrip';
import SearchAndFilters from './components/SearchAndFilters';
import AthleteCard from './components/AthleteCard';
import AthleteSegmentation from './components/AthleteSegmentation';
import RecentActivity from './components/RecentActivity';
import BulkActionsBar from './components/BulkActionsBar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';

const AthletesManagement = () => {
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAthletes, setSelectedAthletes] = useState([]);
  const [filteredAthletes, setFilteredAthletes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const mockMetrics = {
    totalAthletes: 248,
    activeThisMonth: 215,
    avgPerformance: 82,
    retentionRate: 89
  };

  const mockSegmentation = {
    elite: 45,
    advanced: 89,
    intermediate: 78,
    beginner: 36,
    total: 248
  };

  const mockAthletes = [
  {
    id: 'ATH001',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_16be51f71-1763295001188.png",
    profileImageAlt: 'Retrato profesional de hombre hispano con cabello negro corto en traje azul marino',
    coach: 'Ana García',
    attendanceRate: 92,
    performanceScore: 88,
    performanceTrend: 5,
    paymentStatus: 'paid',
    isActive: true,
    attendanceLast30Days: [95, 88, 92, 90]
  },
  {
    id: 'ATH002',
    name: 'María Rodríguez',
    email: 'maria.rodriguez@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1de57631c-1763294258585.png",
    profileImageAlt: 'Retrato profesional de mujer hispana con cabello castaño largo en blusa blanca',
    coach: 'Carlos Martínez',
    attendanceRate: 85,
    performanceScore: 91,
    performanceTrend: 8,
    paymentStatus: 'paid',
    isActive: true,
    attendanceLast30Days: [82, 85, 88, 87]
  },
  {
    id: 'ATH003',
    name: 'Juan Pérez',
    email: 'juan.perez@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_16b9f22e3-1763295150822.png",
    profileImageAlt: 'Retrato profesional de hombre hispano con barba corta en camisa gris',
    coach: 'Luis Rodríguez',
    attendanceRate: 78,
    performanceScore: 75,
    performanceTrend: -3,
    paymentStatus: 'pending',
    isActive: true,
    attendanceLast30Days: [80, 75, 78, 77]
  },
  {
    id: 'ATH004',
    name: 'Ana Martínez',
    email: 'ana.martinez@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_134210297-1763300264821.png",
    profileImageAlt: 'Retrato profesional de mujer hispana con cabello negro recogido en chaqueta negra',
    coach: 'María López',
    attendanceRate: 65,
    performanceScore: 68,
    performanceTrend: 0,
    paymentStatus: 'overdue',
    isActive: false,
    attendanceLast30Days: [70, 65, 62, 65]
  },
  {
    id: 'ATH005',
    name: 'Luis García',
    email: 'luis.garcia@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1b37752d2-1763296920783.png",
    profileImageAlt: 'Retrato profesional de hombre hispano con gafas en polo azul',
    coach: 'Ana García',
    attendanceRate: 95,
    performanceScore: 94,
    performanceTrend: 12,
    paymentStatus: 'paid',
    isActive: true,
    attendanceLast30Days: [95, 96, 94, 95]
  },
  {
    id: 'ATH006',
    name: 'Carmen López',
    email: 'carmen.lopez@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_19ad23742-1763295892621.png",
    profileImageAlt: 'Retrato profesional de mujer hispana con cabello rubio en vestido rojo',
    coach: 'Carlos Martínez',
    attendanceRate: 88,
    performanceScore: 86,
    performanceTrend: 6,
    paymentStatus: 'paid',
    isActive: true,
    attendanceLast30Days: [85, 88, 90, 88]
  },
  {
    id: 'ATH007',
    name: 'Roberto Sánchez',
    email: 'roberto.sanchez@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1eaf91ec8-1763300403456.png",
    profileImageAlt: 'Retrato profesional de hombre hispano con cabello corto en camisa blanca',
    coach: 'Luis Rodríguez',
    attendanceRate: 72,
    performanceScore: 70,
    performanceTrend: -5,
    paymentStatus: 'pending',
    isActive: true,
    attendanceLast30Days: [75, 70, 72, 71]
  },
  {
    id: 'ATH008',
    name: 'Isabel Fernández',
    email: 'isabel.fernandez@email.com',
    profileImage: "https://img.rocket.new/generatedImages/rocket_gen_img_134210297-1763300264821.png",
    profileImageAlt: 'Retrato profesional de mujer hispana con cabello castaño ondulado en blusa azul',
    coach: 'María López',
    attendanceRate: 90,
    performanceScore: 89,
    performanceTrend: 7,
    paymentStatus: 'paid',
    isActive: true,
    attendanceLast30Days: [88, 90, 92, 90]
  }];


  const mockActivities = [
  {
    id: 'ACT001',
    athleteName: 'Carlos Mendoza',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_16be51f71-1763295001188.png",
    athleteImageAlt: 'Retrato profesional de hombre hispano con cabello negro corto en traje azul marino',
    type: 'achievement',
    description: 'alcanzó un nuevo récord personal en levantamiento',
    timestamp: new Date(Date.now() - 300000)
  },
  {
    id: 'ACT002',
    athleteName: 'María Rodríguez',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1de57631c-1763294258585.png",
    athleteImageAlt: 'Retrato profesional de mujer hispana con cabello castaño largo en blusa blanca',
    type: 'payment',
    description: 'completó el pago mensual',
    timestamp: new Date(Date.now() - 900000)
  },
  {
    id: 'ACT003',
    athleteName: 'Luis García',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1b37752d2-1763296920783.png",
    athleteImageAlt: 'Retrato profesional de hombre hispano con gafas en polo azul',
    type: 'session',
    description: 'asistió a sesión de entrenamiento intensivo',
    timestamp: new Date(Date.now() - 1800000)
  },
  {
    id: 'ACT004',
    athleteName: 'Carmen López',
    athleteImage: "https://img.rocket.new/generatedImages/rocket_gen_img_19ad23742-1763295892621.png",
    athleteImageAlt: 'Retrato profesional de mujer hispana con cabello rubio en vestido rojo',
    type: 'message',
    description: 'envió consulta sobre plan de nutrición',
    timestamp: new Date(Date.now() - 3600000)
  },
  {
    id: 'ACT005',
    athleteName: 'Nuevo Atleta',
    type: 'registration',
    description: 'se registró en el programa elite',
    timestamp: new Date(Date.now() - 7200000)
  }];


  // Role-based filtering: Admin sees all athletes, Professor sees only their athletes
  const visibleAthletes = React.useMemo(() => {
    if (currentUser?.role === 'admin') {
      return mockAthletes;
    } else if (currentUser?.role === 'profesor') {
      // Filter athletes assigned to this professor
      return mockAthletes?.filter(athlete => 
        athlete?.coach === currentUser?.name
      );
    }
    return [];
  }, [currentUser]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [searchQuery, activeFilters, sortConfig, visibleAthletes]);

  const applyFiltersAndSearch = () => {
    let filtered = [...visibleAthletes];

    if (searchQuery) {
      const query = searchQuery?.toLowerCase();
      filtered = filtered?.filter(
        (athlete) =>
        athlete?.name?.toLowerCase()?.includes(query) ||
        athlete?.email?.toLowerCase()?.includes(query) ||
        athlete?.id?.toLowerCase()?.includes(query)
      );
    }

    if (activeFilters?.coach) {
      filtered = filtered?.filter((athlete) => athlete?.coach === activeFilters?.coach);
    }

    if (activeFilters?.performanceTier) {
      filtered = filtered?.filter((athlete) => {
        const score = athlete?.performanceScore;
        switch (activeFilters?.performanceTier) {
          case 'elite':
            return score >= 90;
          case 'advanced':
            return score >= 75 && score < 90;
          case 'intermediate':
            return score >= 60 && score < 75;
          case 'beginner':
            return score < 60;
          default:
            return true;
        }
      });
    }

    if (activeFilters?.paymentStatus) {
      filtered = filtered?.filter((athlete) => athlete?.paymentStatus === activeFilters?.paymentStatus);
    }

    if (activeFilters?.attendanceRange) {
      filtered = filtered?.filter((athlete) => {
        const rate = athlete?.attendanceRate;
        switch (activeFilters?.attendanceRange) {
          case 'excellent':
            return rate > 90;
          case 'good':
            return rate >= 75 && rate <= 90;
          case 'fair':
            return rate >= 60 && rate < 75;
          case 'poor':
            return rate < 60;
          default:
            return true;
        }
      });
    }

    filtered?.sort((a, b) => {
      const aValue = a?.[sortConfig?.key];
      const bValue = b?.[sortConfig?.key];

      if (typeof aValue === 'string') {
        return sortConfig?.direction === 'asc' ?
        aValue?.localeCompare(bValue) :
        bValue?.localeCompare(aValue);
      }

      return sortConfig?.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });

    setFilteredAthletes(filtered);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (filters) => {
    setActiveFilters(filters);
  };

  const handleAthleteSelect = (athleteId) => {
    setSelectedAthletes((prev) =>
    prev?.includes(athleteId) ? prev?.filter((id) => id !== athleteId) : [...prev, athleteId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAthletes?.length === filteredAthletes?.length) {
      setSelectedAthletes([]);
    } else {
      setSelectedAthletes(filteredAthletes?.map((athlete) => athlete?.id));
    }
  };

  const handleBulkAction = (actionId) => {
    console.log(`Bulk action: ${actionId} for athletes:`, selectedAthletes);
    setSelectedAthletes([]);
  };

  const handleClearSelection = () => {
    setSelectedAthletes([]);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setLastRefresh(new Date());
      setIsLoading(false);
    }, 1000);
  };

  const alertData = {
    dashboard: 3,
    atletas: 5,
    rendimiento: 2,
    pagos: 8
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Atletas - DigitalMatch Fitness Dashboard</title>
        <meta
          name="description"
          content="Panel de gestión completo para supervisar atletas, rendimiento, asistencia y pagos en tiempo real" />

      </Helmet>
      <div className="min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          userRole="coach"
          alertData={alertData} />


        <main
          className={`transition-smooth ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'} p-4 md:p-6 lg:p-8`
          }>

          <div className="max-w-7xl mx-auto">
            <BreadcrumbTrail currentPath="/athletes-management" />

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">
                  Gestión de Atletas
                </h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  Supervisa y gestiona todos tus atletas en un solo lugar
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  loading={isLoading}
                  iconName="RefreshCw"
                  iconPosition="left">

                  Actualizar
                </Button>
                <Button variant="default" iconName="UserPlus" iconPosition="left">
                  Nuevo Atleta
                </Button>
              </div>
            </div>

            <MetricsStrip metrics={mockMetrics} />

            <SearchAndFilters
              onSearch={handleSearch}
              onFilterChange={handleFilterChange}
              onBulkAction={handleBulkAction} />


            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              <div className="lg:col-span-8">
                <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={
                        selectedAthletes?.length === filteredAthletes?.length &&
                        filteredAthletes?.length > 0
                        }
                        onChange={handleSelectAll}
                        className="w-5 h-5 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary"
                        aria-label="Seleccionar todos los atletas" />

                      <span className="text-sm text-muted-foreground">
                        {filteredAthletes?.length} atletas encontrados
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Ordenar por:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('name')}
                        iconName={
                        sortConfig?.key === 'name' ?
                        sortConfig?.direction === 'asc' ? 'ArrowUp' : 'ArrowDown' : 'ArrowUpDown'
                        }
                        iconPosition="right">

                        Nombre
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('performanceScore')}
                        iconName={
                        sortConfig?.key === 'performanceScore' ?
                        sortConfig?.direction === 'asc' ? 'ArrowUp' : 'ArrowDown' : 'ArrowUpDown'
                        }
                        iconPosition="right">

                        Rendimiento
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredAthletes?.length > 0 ?
                  filteredAthletes?.map((athlete) =>
                  <AthleteCard
                    key={athlete?.id}
                    athlete={athlete}
                    onSelect={handleAthleteSelect}
                    isSelected={selectedAthletes?.includes(athlete?.id)} />

                  ) :

                  <div className="bg-card border border-border rounded-lg p-8 md:p-12 text-center">
                      <Icon name="Users" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
                      <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                        No se encontraron atletas
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Intenta ajustar tus filtros o búsqueda
                      </p>
                    </div>
                  }
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <AthleteSegmentation segmentationData={mockSegmentation} />
                <RecentActivity activities={mockActivities} />
              </div>
            </div>

            <BulkActionsBar
              selectedCount={selectedAthletes?.length}
              onAction={handleBulkAction}
              onClearSelection={handleClearSelection} />

          </div>
        </main>
      </div>
    </>);

};

export default AthletesManagement;