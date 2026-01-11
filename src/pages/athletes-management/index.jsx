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
import { supabase } from '../../lib/supabaseClient';

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
  const [athletes, setAthletes] = useState([]);
  const [metricsSummary, setMetricsSummary] = useState({
    totalAthletes: 0,
    activeThisMonth: 0,
    avgPerformance: 0,
    retentionRate: 0
  });
  const [segmentation, setSegmentation] = useState({
    elite: 0,
    advanced: 0,
    intermediate: 0,
    beginner: 0,
    total: 0
  });


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

  const coachId = currentUser?.coach_id || currentUser?.coachId || currentUser?.id;

  const calculateAttendanceRate = (records = []) => {
    if (!records?.length) {
      return 0;
    }
    const presentCount = records?.filter((record) => record?.status === 'present')?.length || 0;
    return Math.round((presentCount / records.length) * 100);
  };

  const buildWeeklyAttendance = (records = []) => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 28);

    return Array.from({ length: 4 }).map((_, index) => {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + index * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const weekRecords = records?.filter((record) => {
        const recordDate = new Date(record?.date);
        return recordDate >= weekStart && recordDate < weekEnd;
      });

      return calculateAttendanceRate(weekRecords);
    });
  };

  const buildPerformanceMetrics = (records = []) => {
    if (!records?.length) {
      return { score: 0, trend: 0 };
    }

    const sorted = [...records].sort((a, b) => new Date(a?.date) - new Date(b?.date));
    const latest = sorted?.[sorted.length - 1];
    const previous = sorted?.[sorted.length - 2];
    const score = Math.round(latest?.value ?? 0);
    const trend = previous ? score - Math.round(previous?.value ?? 0) : 0;

    return { score, trend };
  };

  useEffect(() => {
    let isMounted = true;

    const loadAthletesData = async () => {
      setIsLoading(true);
      try {
        let athleteQuery = supabase.from('athletes').select('*');

        if (currentUser?.role === 'profesor' && coachId) {
          athleteQuery = athleteQuery.eq('coach_id', coachId);
        }

        const { data: athletesData, error: athletesError } = await athleteQuery;

        if (athletesError) {
          throw athletesError;
        }

        const athleteList = athletesData ?? [];
        const athleteIds = athleteList?.map((athlete) => athlete?.id).filter(Boolean);

        let attendanceData = [];
        let metricsData = [];
        let paymentsData = [];

        if (athleteIds?.length > 0) {
          const [
            { data: attendance, error: attendanceError },
            { data: metrics, error: metricsError },
            { data: payments, error: paymentsError }
          ] = await Promise.all([
            supabase.from('attendance').select('*').in('athlete_id', athleteIds),
            supabase.from('metrics').select('*').in('athlete_id', athleteIds),
            supabase.from('payments').select('*').in('athlete_id', athleteIds)
          ]);

          if (attendanceError) {
            throw attendanceError;
          }
          if (metricsError) {
            throw metricsError;
          }
          if (paymentsError) {
            throw paymentsError;
          }

          attendanceData = attendance ?? [];
          metricsData = metrics ?? [];
          paymentsData = payments ?? [];
        }

        const attendanceByAthlete = attendanceData.reduce((acc, record) => {
          const athleteId = record?.athlete_id;
          if (!athleteId) {
            return acc;
          }
          acc[athleteId] = acc[athleteId] || [];
          acc[athleteId].push(record);
          return acc;
        }, {});

        const metricsByAthlete = metricsData.reduce((acc, record) => {
          const athleteId = record?.athlete_id;
          if (!athleteId) {
            return acc;
          }
          acc[athleteId] = acc[athleteId] || [];
          acc[athleteId].push(record);
          return acc;
        }, {});

        const paymentsByAthlete = paymentsData.reduce((acc, record) => {
          const athleteId = record?.athlete_id;
          if (!athleteId) {
            return acc;
          }
          acc[athleteId] = acc[athleteId] || [];
          acc[athleteId].push(record);
          return acc;
        }, {});

        const enrichedAthletes = athleteList.map((athlete) => {
          const athleteId = athlete?.id;
          const attendanceRecords = attendanceByAthlete?.[athleteId] ?? [];
          const performanceRecords = metricsByAthlete?.[athleteId] ?? [];
          const paymentRecords = paymentsByAthlete?.[athleteId] ?? [];
          const performance = buildPerformanceMetrics(performanceRecords);
          const attendanceRate = calculateAttendanceRate(attendanceRecords);
          const latestPayment = paymentRecords
            ?.slice()
            ?.sort((a, b) => new Date(b?.date) - new Date(a?.date))?.[0];
          const name = athlete?.name || athlete?.full_name || athlete?.display_name || 'Atleta';

          return {
            id: athleteId,
            name,
            email: athlete?.email || 'Sin correo',
            profileImage: athlete?.profile_image || athlete?.avatar_url,
            profileImageAlt: athlete?.profile_image_alt || `Foto de ${name}`,
            coach: athlete?.coach_name || athlete?.coach || currentUser?.name || 'Sin asignar',
            attendanceRate,
            performanceScore: performance?.score,
            performanceTrend: performance?.trend,
            paymentStatus: latestPayment?.status || 'pending',
            isActive: athlete?.is_active ?? athlete?.active ?? true,
            attendanceLast30Days: buildWeeklyAttendance(attendanceRecords)
          };
        });

        const performanceScores = enrichedAthletes.map((athlete) => athlete?.performanceScore || 0);
        const avgPerformance = performanceScores?.length
          ? Math.round(performanceScores.reduce((sum, value) => sum + value, 0) / performanceScores.length)
          : 0;

        const recentActiveAthletes = new Set(
          attendanceData
            ?.filter((record) => {
              const recordDate = new Date(record?.date);
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return recordDate >= thirtyDaysAgo;
            })
            ?.map((record) => record?.athlete_id)
        );

        const totalAthletes = enrichedAthletes?.length;
        const activeThisMonth = recentActiveAthletes?.size || 0;
        const retentionRate = totalAthletes
          ? Math.round((activeThisMonth / totalAthletes) * 100)
          : 0;

        const segmentationCounts = enrichedAthletes.reduce(
          (acc, athlete) => {
            const score = athlete?.performanceScore ?? 0;
            if (score >= 90) {
              acc.elite += 1;
            } else if (score >= 75) {
              acc.advanced += 1;
            } else if (score >= 60) {
              acc.intermediate += 1;
            } else {
              acc.beginner += 1;
            }
            return acc;
          },
          {
            elite: 0,
            advanced: 0,
            intermediate: 0,
            beginner: 0
          }
        );

        if (!isMounted) {
          return;
        }

        setAthletes(enrichedAthletes);
        setMetricsSummary({
          totalAthletes,
          activeThisMonth,
          avgPerformance,
          retentionRate
        });
        setSegmentation({
          ...segmentationCounts,
          total: totalAthletes
        });
      } catch (error) {
        console.error('Error loading athletes management data', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAthletesData();

    return () => {
      isMounted = false;
    };
  }, [coachId, currentUser?.role, currentUser?.name, lastRefresh]);

  // Role-based filtering: Admin sees all athletes, Professor sees only their athletes
  const visibleAthletes = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return athletes;
    } else if (currentUser?.role === 'profesor') {
      // Filter athletes assigned to this professor
      return athletes?.filter((athlete) => athlete?.coach === currentUser?.name);
    }
    return [];
  }, [athletes, currentUser]);

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

            <MetricsStrip metrics={metricsSummary} />

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
                <AthleteSegmentation segmentationData={segmentation} />
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
