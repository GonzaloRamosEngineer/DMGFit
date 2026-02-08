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
import EnableAccountModal from "../../components/EnableAccountModal";

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

  // --- ESTADOS PARA HABILITACIÓN ---
  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [enableTarget, setEnableTarget] = useState(null);

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

  const mockActivities = [
    { id: "ACT001", athleteName: "Carlos Mendoza", type: "achievement", description: "Récord personal", timestamp: new Date(Date.now() - 300000) },
    { id: "ACT002", athleteName: "María Rodríguez", type: "payment", description: "Pago mensual completado", timestamp: new Date(Date.now() - 900000) },
    { id: "ACT005", athleteName: "Nuevo Atleta", type: "registration", description: "Registro completado", timestamp: new Date(Date.now() - 7200000) },
  ];

  // --- CARGA DE DATOS ---
  useEffect(() => {
    let isMounted = true;

    const loadAthletesData = async () => {
      setIsLoading(true);
      try {
        let query = supabase.from("athletes").select(`
            id, 
            status, 
            join_date,
            coach_id,
            profile_id,
            profiles:profile_id ( full_name, email, avatar_url ),
            coaches:coach_id ( id, profiles:profile_id ( full_name ) )
          `);

        if (currentUser?.role === "profesor" && currentUser?.coachId) {
          query = query.eq("coach_id", currentUser.coachId);
        }

        const { data: athletesData, error } = await query;
        if (error) throw error;

        const athleteIds = athletesData.map((a) => a.id);
        if (athleteIds.length === 0) {
          if (isMounted) {
            setAthletes([]);
            setIsLoading(false);
          }
          return;
        }

        const [attendanceRes, metricsRes, paymentsRes] = await Promise.all([
          supabase.from("attendance").select("athlete_id, status, date").in("athlete_id", athleteIds),
          supabase.from("metrics").select("athlete_id, value").in("athlete_id", athleteIds).order("date", { ascending: false }),
          supabase.from("payments").select("athlete_id, status, date").in("athlete_id", athleteIds),
        ]);

        const enrichedAthletes = athletesData.map((athlete) => {
          const attRecords = attendanceRes.data?.filter((r) => r.athlete_id === athlete.id) || [];
          const perfRecords = metricsRes.data?.filter((r) => r.athlete_id === athlete.id) || [];
          const payRecords = paymentsRes.data?.filter((r) => r.athlete_id === athlete.id) || [];

          const attendanceRate = attRecords.length > 0
              ? Math.round((attRecords.filter((r) => r.status === "present").length / attRecords.length) * 100)
              : 0;

          const latestMetric = perfRecords[0]?.value || 0;
          const latestPayment = payRecords.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

          const rawEmail = athlete.profiles?.email || "";
          const isInternalEmail = rawEmail.includes('@dmg.internal');

          return {
            id: athlete.id,
            profileId: athlete.profile_id,
            name: athlete.profiles?.full_name || "Sin Nombre",
            email: isInternalEmail ? "Sin acceso a App" : rawEmail,
            rawEmail: rawEmail,
            profileImage: athlete.profiles?.avatar_url,
            coach: athlete.coaches?.profiles?.full_name || "Sin Asignar",
            isActive: athlete.status === "active",
            attendanceRate,
            performanceScore: Math.round(latestMetric),
            performanceTrend: 1,
            paymentStatus: latestPayment?.status || "pending",
            attendanceLast30Days: [80, 90, 75, 85],
            needsActivation: isInternalEmail || rawEmail === "",
          };
        });

        // RE-CALCULAR SEGMENTACIÓN (Que se había perdido)
        const seg = { elite: 0, advanced: 0, intermediate: 0, beginner: 0, total: enrichedAthletes.length };
        enrichedAthletes.forEach((a) => {
          if (a.performanceScore >= 90) seg.elite++;
          else if (a.performanceScore >= 75) seg.advanced++;
          else if (a.performanceScore >= 60) seg.intermediate++;
          else seg.beginner++;
        });

        if (isMounted) {
          setAthletes(enrichedAthletes);
          setSegmentation(seg);
          setMetricsSummary({
            totalAthletes: enrichedAthletes.length,
            activeThisMonth: enrichedAthletes.filter((a) => a.isActive).length,
            avgPerformance: Math.round(enrichedAthletes.reduce((sum, a) => sum + a.performanceScore, 0) / (enrichedAthletes.length || 1)),
            retentionRate: 95,
          });
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error:", err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadAthletesData();
    return () => { isMounted = false; };
  }, [currentUser, lastRefresh]);

  // --- FILTRADO Y BÚSQUEDA (Manteniendo lógica original) ---
  const filteredAthletes = useMemo(() => {
    let result = [...athletes];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
    }
    if (activeFilters.paymentStatus) {
      result = result.filter((a) => a.paymentStatus === activeFilters.paymentStatus);
    }
    result.sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (typeof valA === "string") {
        return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortConfig.direction === "asc" ? valA - valB : valB - valA;
    });
    return result;
  }, [athletes, searchQuery, activeFilters, sortConfig]);

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
    if (selectedAthletes.length === filteredAthletes.length) setSelectedAthletes([]);
    else setSelectedAthletes(filteredAthletes.map((a) => a.id));
  };

  return (
    <>
      <Helmet><title>Gestión de Atletas - VC Fit</title></Helmet>

      <div className="p-4 md:p-6 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbTrail currentPath="/athletes-management" />

          {/* Header con props de iconos recuperadas */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-2">Gestión de Atletas</h1>
              <p className="text-sm md:text-base text-muted-foreground">Supervisa y gestiona todos tus atletas en un solo lugar</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleRefresh} loading={isLoading} iconName="RefreshCw" iconPosition="left">Actualizar</Button>
              <Button variant="default" iconName="UserPlus" iconPosition="left" onClick={() => setIsAddModalOpen(true)}>Nuevo Atleta</Button>
            </div>
          </div>

          <MetricsStrip metrics={metricsSummary} loading={isLoading} />
          <SearchAndFilters onSearch={setSearchQuery} onFilterChange={setActiveFilters} onBulkAction={() => {}} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            <div className="lg:col-span-8">
              <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-4">
                
                {/* RECUPERADO: Barra de Herramientas de Lista (Checkbox y Orden) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedAthletes.length > 0 && selectedAthletes.length === filteredAthletes.length}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground">
                      {isLoading ? "Cargando..." : `${filteredAthletes.length} atletas encontrados`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("name")} iconName="ArrowUpDown" iconPosition="right">Nombre</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("performanceScore")} iconName="ArrowUpDown" iconPosition="right">Rendimiento</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {isLoading ? (
                    [1, 2, 3].map((i) => <AthleteCard key={i} loading={true} />)
                  ) : filteredAthletes.length > 0 ? (
                    filteredAthletes.map((athlete) => (
                      <AthleteCard
                        key={athlete.id}
                        athlete={athlete}
                        isSelected={selectedAthletes.includes(athlete.id)}
                        onSelect={(id) => setSelectedAthletes(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])}
                        onEnableAccount={(target) => {
                          setEnableTarget({
                            profileId: target.profileId,
                            email: target.rawEmail?.includes("@dmg.internal") ? "" : target.rawEmail,
                            name: target.name,
                            role: "atleta",
                          });
                          setIsEnableModalOpen(true);
                        }}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Icon name="Users" size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No se encontraron atletas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <AthleteSegmentation segmentationData={segmentation} loading={isLoading} />
              <RecentActivity activities={mockActivities} loading={isLoading} />
            </div>
          </div>

          {/* Modales y Barras Finales */}
          {isAddModalOpen && (
            <AddAthleteModal onClose={() => setIsAddModalOpen(false)} onAthleteAdded={handleRefresh} />
          )}

          <EnableAccountModal
            isOpen={isEnableModalOpen}
            target={enableTarget}
            onClose={() => { setIsEnableModalOpen(false); setEnableTarget(null); }}
            onSuccess={handleRefresh}
          />

          <BulkActionsBar
            selectedCount={selectedAthletes.length}
            onAction={() => setSelectedAthletes([])}
            onClearSelection={() => setSelectedAthletes([])}
          />
        </div>
      </div>
    </>
  );
};

export default AthletesManagement;