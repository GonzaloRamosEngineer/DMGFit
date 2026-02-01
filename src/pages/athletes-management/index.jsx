import React, { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import BreadcrumbTrail from "../../components/ui/BreadcrumbTrail";
import MetricsStrip from "./components/MetricsStrip";
import SearchAndFilters from "./components/SearchAndFilters";
import AthleteCard from "./components/AthleteCard";
import AthleteSegmentation from "./components/AthleteSegmentation";
import RecentActivity from "./components/RecentActivity";
import BulkActionsBar from "./components/BulkActionsBar";
import Icon from "../../components/AppIcon";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import AddAthleteModal from "./components/AddAthleteModal";

const AthletesManagement = () => {
  const { currentUser } = useAuth();
  const [selectedAthletes, setSelectedAthletes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Datos reales
  const [athletes, setAthletes] = useState([]);
  const [metricsSummary, setMetricsSummary] = useState({
    totalAthletes: 0,
    activeThisMonth: 0,
    avgPerformance: 0,
    retentionRate: 0,
  });
  const [segmentation, setSegmentation] = useState({
    elite: 0,
    advanced: 0,
    intermediate: 0,
    beginner: 0,
    total: 0,
  });

  // Datos mock para actividad reciente (hasta que tengamos tabla de actividad)
  const mockActivities = [
    {
      id: "ACT001",
      athleteName: "Carlos Mendoza",
      type: "achievement",
      description: "Récord personal",
      timestamp: new Date(Date.now() - 300000),
    },
    {
      id: "ACT002",
      athleteName: "María Rodríguez",
      type: "payment",
      description: "Pago mensual completado",
      timestamp: new Date(Date.now() - 900000),
    },
    {
      id: "ACT005",
      athleteName: "Nuevo Atleta",
      type: "registration",
      description: "Registro completado",
      timestamp: new Date(Date.now() - 7200000),
    },
  ];

  // --- CARGA DE DATOS ---
  useEffect(() => {
    let isMounted = true;

    const loadAthletesData = async () => {
      setIsLoading(true);
      try {
        // 1. Consulta Base de Atletas
        let query = supabase.from("athletes").select(`
            id, 
            status, 
            join_date,
            coach_id,
            profiles:profile_id ( full_name, email, avatar_url ),
            coaches:coach_id ( id, profiles:profile_id ( full_name ) )
          `);

        // Filtro por rol (Profesor solo ve sus atletas)
        if (currentUser?.role === "profesor" && currentUser?.coachId) {
          query = query.eq("coach_id", currentUser.coachId);
        }

        const { data: athletesData, error } = await query;
        if (error) throw error;

        // 2. Obtener IDs para consultas masivas
        const athleteIds = athletesData.map((a) => a.id);

        if (athleteIds.length === 0) {
          if (isMounted) {
            setAthletes([]);
            setIsLoading(false);
          }
          return;
        }

        // 3. Consultas Paralelas de Datos Relacionados
        const [attendanceRes, metricsRes, paymentsRes] = await Promise.all([
          supabase
            .from("attendance")
            .select("athlete_id, status, date")
            .in("athlete_id", athleteIds),
          supabase
            .from("metrics")
            .select("athlete_id, value")
            .in("athlete_id", athleteIds)
            .order("date", { ascending: false }),
          supabase
            .from("payments")
            .select("athlete_id, status, date")
            .in("athlete_id", athleteIds),
        ]);

        // 4. Procesamiento de Datos (Enriquecimiento)
        const enrichedAthletes = athletesData.map((athlete) => {
          // Filtrar datos relacionados para este atleta
          const attRecords =
            attendanceRes.data?.filter((r) => r.athlete_id === athlete.id) ||
            [];
          const perfRecords =
            metricsRes.data?.filter((r) => r.athlete_id === athlete.id) || [];
          const payRecords =
            paymentsRes.data?.filter((r) => r.athlete_id === athlete.id) || [];

          // Calcular Métricas Individuales
          const attendanceRate =
            attRecords.length > 0
              ? Math.round(
                  (attRecords.filter((r) => r.status === "present").length /
                    attRecords.length) *
                    100
                )
              : 0;

          const latestMetric = perfRecords[0]?.value || 0;

          // Buscar último pago
          const latestPayment = payRecords.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          )[0];

          return {
            id: athlete.id,
            name: athlete.profiles?.full_name || "Sin Nombre",
            email: athlete.profiles?.email || "",
            profileImage: athlete.profiles?.avatar_url,
            coach: athlete.coaches?.profiles?.full_name || "Sin Asignar",
            isActive: athlete.status === "active",
            attendanceRate,
            performanceScore: Math.round(latestMetric),
            performanceTrend: 1, // Simulado por ahora
            paymentStatus: latestPayment?.status || "pending",
            attendanceLast30Days: [80, 90, 75, 85], // Datos dummy para el sparkline
          };
        });

        // 5. Calcular Resúmenes Globales
        const totalAthletes = enrichedAthletes.length;
        const avgPerf = Math.round(
          enrichedAthletes.reduce((sum, a) => sum + a.performanceScore, 0) /
            (totalAthletes || 1)
        );
        const activeCount = enrichedAthletes.filter((a) => a.isActive).length;

        // Segmentación
        const seg = {
          elite: 0,
          advanced: 0,
          intermediate: 0,
          beginner: 0,
          total: totalAthletes,
        };
        enrichedAthletes.forEach((a) => {
          if (a.performanceScore >= 90) seg.elite++;
          else if (a.performanceScore >= 75) seg.advanced++;
          else if (a.performanceScore >= 60) seg.intermediate++;
          else seg.beginner++;
        });

        if (isMounted) {
          setAthletes(enrichedAthletes);
          setMetricsSummary({
            totalAthletes,
            activeThisMonth: activeCount,
            avgPerformance: avgPerf,
            retentionRate: 95,
          });
          setSegmentation(seg);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error cargando atletas:", err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadAthletesData();
    return () => {
      isMounted = false;
    };
  }, [currentUser, lastRefresh]);

  // --- FILTRADO Y BÚSQUEDA ---
  const filteredAthletes = useMemo(() => {
    let result = [...athletes];

    // Búsqueda
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
      );
    }

    // Filtros
    if (activeFilters.paymentStatus) {
      result = result.filter(
        (a) => a.paymentStatus === activeFilters.paymentStatus
      );
    }

    // Ordenamiento
    result.sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];

      if (typeof valA === "string") {
        return sortConfig.direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortConfig.direction === "asc" ? valA - valB : valB - valA;
    });

    return result;
  }, [athletes, searchQuery, activeFilters, sortConfig]);

  // --- HANDLERS ---
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setLastRefresh(new Date());
  };

  const handleSelectAll = () => {
    if (selectedAthletes.length === filteredAthletes.length)
      setSelectedAthletes([]);
    else setSelectedAthletes(filteredAthletes.map((a) => a.id));
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Atletas - DigitalMatch</title>
      </Helmet>

      {/* REMOVED NavigationSidebar - ya está en AppLayout */}
      <div className="p-4 md:p-6 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbTrail currentPath="/athletes-management" />

          {/* Header */}
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
                iconPosition="left"
              >
                Actualizar
              </Button>
              <Button
                variant="default"
                iconName="UserPlus"
                iconPosition="left"
                onClick={() => setIsAddModalOpen(true)}
              >
                Nuevo Atleta
              </Button>
            </div>
          </div>

          {/* Métricas */}
          <MetricsStrip metrics={metricsSummary} loading={isLoading} />

          {/* Búsqueda y Filtros */}
          <SearchAndFilters
            onSearch={setSearchQuery}
            onFilterChange={setActiveFilters}
            onBulkAction={() => {}}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            {/* Lista Principal */}
            <div className="lg:col-span-8">
              <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-4">
                {/* Barra de Herramientas de Lista */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedAthletes.length > 0 &&
                        selectedAthletes.length === filteredAthletes.length
                      }
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground">
                      {isLoading
                        ? "Cargando..."
                        : `${filteredAthletes.length} atletas encontrados`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("name")}
                      iconName="ArrowUpDown"
                      iconPosition="right"
                    >
                      Nombre
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("performanceScore")}
                      iconName="ArrowUpDown"
                      iconPosition="right"
                    >
                      Rendimiento
                    </Button>
                  </div>
                </div>

                {/* Renderizado de Lista */}
                <div className="space-y-4">
                  {isLoading ? (
                    // Skeleton Loading
                    [1, 2, 3].map((i) => (
                      <AthleteCard key={i} loading={true} />
                    ))
                  ) : filteredAthletes.length > 0 ? (
                    filteredAthletes.map((athlete) => (
                      <AthleteCard
                        key={athlete.id}
                        athlete={athlete}
                        onSelect={(id) =>
                          setSelectedAthletes((prev) =>
                            prev.includes(id)
                              ? prev.filter((p) => p !== id)
                              : [...prev, id]
                          )
                        }
                        isSelected={selectedAthletes.includes(athlete.id)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Icon
                        name="Users"
                        size={48}
                        className="mx-auto mb-4 opacity-50"
                      />
                      <p>No se encontraron atletas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Derecha (Segmentación y Actividad) */}
            <div className="lg:col-span-4 space-y-6">
              <AthleteSegmentation
                segmentationData={segmentation}
                loading={isLoading}
              />
              <RecentActivity
                activities={mockActivities}
                loading={isLoading}
              />
            </div>
          </div>

          {/* Acciones Masivas */}
          <BulkActionsBar
            selectedCount={selectedAthletes.length}
            onAction={() => setSelectedAthletes([])}
            onClearSelection={() => setSelectedAthletes([])}
          />

          {/* Modal de Nuevo Atleta */}
          {isAddModalOpen && (
            <AddAthleteModal 
              onClose={() => setIsAddModalOpen(false)}
              onAthleteAdded={() => {
                handleRefresh();
                setIsAddModalOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default AthletesManagement;