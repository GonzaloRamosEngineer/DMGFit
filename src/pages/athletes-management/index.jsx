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
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import AddAthleteModal from "./components/AddAthleteModal";
import EnableAccountModal from "../../components/EnableAccountModal";
import AddPaymentModal from "../payment-management/components/AddPaymentModal";

const AthletesManagement = () => {
  const { currentUser } = useAuth();
  const [selectedAthletes, setSelectedAthletes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState({ status: "active" });
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [enableTarget, setEnableTarget] = useState(null);
  
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

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

  const [recentActivities, setRecentActivities] = useState([]);

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
            coaches:coach_id ( id, profiles:profile_id ( full_name ) ),
            plan_option,
            plans ( name, price )
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
            setRecentActivities([]);
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
          const isInternalEmail = rawEmail.includes('@dmg.internal') || rawEmail.includes('@vcfit.internal');

          const planData = Array.isArray(athlete.plans) ? athlete.plans[0] : athlete.plans;

          return {
            id: athlete.id,
            profileId: athlete.profile_id,
            name: athlete.profiles?.full_name || "Sin Nombre",
            email: isInternalEmail ? "Sin acceso a App" : rawEmail,
            rawEmail: rawEmail,
            profileImage: athlete.profiles?.avatar_url,
            avatar: athlete.profiles?.avatar_url,
            planName: planData?.name || "Sin Plan",
            planPrice: planData?.price || 0,
            planOption: athlete.plan_option || null,
            coach: athlete.coaches?.profiles?.full_name || "Sin Asignar",
            status: athlete.status || 'active',
            isActive: athlete.status === "active",
            attendanceRate,
            performanceScore: Math.round(latestMetric),
            performanceTrend: 1,
            paymentStatus: latestPayment?.status || "pending",
            attendanceLast30Days: [80, 90, 75, 85],
            needsActivation: isInternalEmail || rawEmail === "",
          };
        });

        const seg = { elite: 0, advanced: 0, intermediate: 0, beginner: 0, total: enrichedAthletes.length };
        enrichedAthletes.forEach((a) => {
          if (a.performanceScore >= 90) seg.elite++;
          else if (a.performanceScore >= 75) seg.advanced++;
          else if (a.performanceScore >= 60) seg.intermediate++;
          else seg.beginner++;
        });

        const allActivities = [];

        athletesData.forEach(a => {
          if (a.join_date) {
            allActivities.push({
              id: `reg-${a.id}`,
              athleteName: a.profiles?.full_name || "Desconocido",
              athleteImage: a.profiles?.avatar_url,
              type: "registration",
              description: "se unió al gimnasio",
              timestamp: new Date(a.join_date).getTime()
            });
          }
        });

        paymentsRes.data?.forEach(p => {
          if (p.status === 'paid' && (p.date || p.payment_date)) {
            const athlete = athletesData.find(a => a.id === p.athlete_id);
            allActivities.push({
              id: `pay-${p.id || Math.random()}`,
              athleteName: athlete?.profiles?.full_name || "Desconocido",
              athleteImage: athlete?.profiles?.avatar_url,
              type: "payment",
              description: "registró un pago",
              timestamp: new Date(p.date || p.payment_date).getTime()
            });
          }
        });

        attendanceRes.data?.forEach(att => {
          if (att.status === 'present' && att.date) {
            const athlete = athletesData.find(a => a.id === att.athlete_id);
            allActivities.push({
              id: `att-${att.athlete_id}-${att.date}`,
              athleteName: athlete?.profiles?.full_name || "Desconocido",
              athleteImage: athlete?.profiles?.avatar_url,
              type: "session",
              description: "asistió a clase",
              timestamp: new Date(att.date).getTime()
            });
          }
        });

        const topRecentActivities = allActivities
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 5);

        if (isMounted) {
          setAthletes(enrichedAthletes);
          setSegmentation(seg);
          setRecentActivities(topRecentActivities);
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

  const filteredAthletes = useMemo(() => {
    let result = [...athletes];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
    }
    if (activeFilters.paymentStatus) {
      result = result.filter((a) => a.paymentStatus === activeFilters.paymentStatus);
    }
    if (activeFilters.status && activeFilters.status !== 'all') {
      result = result.filter((a) => a.status === activeFilters.status);
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

  // Función auxiliar para renderizar el ícono de ordenamiento
  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <Icon name="ArrowUpDown" size={12} className="opacity-30" />;
    return <Icon name={sortConfig.direction === "asc" ? "ArrowUp" : "ArrowDown"} size={12} className="text-blue-600" />;
  };

  return (
    <>
      <Helmet><title>Gestión de Atletas - VC Fit</title></Helmet>

      <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 pb-24">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <BreadcrumbTrail currentPath="/athletes-management" />
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mt-2">
              Gestión de Atletas
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Supervisa y gestiona todos tus atletas en un solo lugar
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleRefresh}
              disabled={isLoading}
              className={`flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-xs uppercase tracking-wider shadow-lg transition-all ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
            >
              <Icon name={isLoading ? "Loader" : "RefreshCw"} size={16} className={isLoading ? "animate-spin" : ""} /> 
              {isLoading ? 'Actualizando...' : 'Actualizar'}
            </button>

            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all"
            >
              <Icon name="UserPlus" size={16} /> Nuevo Atleta
            </button>
          </div>
        </div>

        <div className="mb-8">
          <MetricsStrip metrics={metricsSummary} loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA (Principal - 8/12) */}
          <div className="xl:col-span-8 space-y-8 w-full min-w-0">
            
            <div className="sticky top-4 z-20">
              <SearchAndFilters onSearch={setSearchQuery} onFilterChange={setActiveFilters} onBulkAction={() => {}} />
            </div>

            {/* TABLA PRINCIPAL MODIFICADA */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[600px] overflow-hidden">
              
              {/* Cabecera de la Tarjeta */}
              <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon name="Users" size={20} />
                    </div>
                    Directorio de Atletas
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 sm:ml-14">
                    {isLoading ? "Cargando..." : `${filteredAthletes.length} Atletas registrados`}
                  </p>
                </div>
              </div>

              {/* Contenedor Ajustado (Sin scroll horizontal forzado) */}
              <div className="flex-1 w-full">
                <div className="w-full"> 
                  
                  {/* ENCABEZADOS DE LA TABLA COMPACTOS */}
                  <div className="grid grid-cols-[32px_minmax(150px,3fr)_minmax(110px,1.5fr)_minmax(100px,1.5fr)_90px_72px] gap-3 px-5 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest items-center">
                      
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={selectedAthletes.length > 0 && selectedAthletes.length === filteredAthletes.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                    
                    <button onClick={() => handleSort("name")} className="flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left group">
                      ATLETA {renderSortIcon("name")}
                    </button>
                    
                    <button onClick={() => handleSort("planName")} className="flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left group">
                      MEMBRESÍA {renderSortIcon("planName")}
                    </button>
                    
                    <button onClick={() => handleSort("performanceScore")} className="flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left group">
                      MÉTRICAS {renderSortIcon("performanceScore")}
                    </button>
                    
                    <button onClick={() => handleSort("paymentStatus")} className="flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left group">
                      ESTADO {renderSortIcon("paymentStatus")}
                    </button>
                    
                    <div className="text-center">ACCIONES</div>
                  </div>

                  {/* CUERPO DE LA TABLA (Filas divididas por línea) */}
                  <div className="flex flex-col divide-y divide-slate-100 pb-4">
                    {isLoading ? (
                      [1, 2, 3].map((i) => <AthleteCard key={i} loading={true} layout="table" />)
                    ) : filteredAthletes.length > 0 ? (
                      filteredAthletes.map((athlete) => (
                        <AthleteCard
                          key={athlete.id}
                          athlete={athlete}
                          layout="table" // <-- Le pasamos este prop para que la tarjeta se adapte
                          isSelected={selectedAthletes.includes(athlete.id)}
                          canEnable={currentUser?.role === "admin"}
                          onSelect={(id) => setSelectedAthletes(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])}
                          onQuickPay={(target) => {
                            setPayTarget(target);
                            setIsPayModalOpen(true);
                          }}
                          onEnableAccount={(target) => {
                            setEnableTarget({
                              profileId: target.profileId,
                              email: target.rawEmail?.includes("@dmg.internal") || target.rawEmail?.includes("@vcfit.internal") ? "" : target.rawEmail,
                              name: target.name,
                              role: "atleta",
                            });
                            setIsEnableModalOpen(true);
                          }}
                        />
                      ))
                    ) : (
                      <div className="text-center py-20 px-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                          <Icon name="Users" size={28} className="text-slate-300" />
                        </div>
                        <p className="font-black text-slate-600 mb-1">No se encontraron atletas.</p>
                        <p className="text-sm font-medium text-slate-400">Intenta cambiar los filtros de búsqueda.</p>
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-6 w-full min-w-0">
            <AthleteSegmentation segmentationData={segmentation} loading={isLoading} />
            <RecentActivity activities={recentActivities} loading={isLoading} />
          </div>
          
        </div>
      </div>

      {/* Modales */}
      {isAddModalOpen && (
        <AddAthleteModal onClose={() => setIsAddModalOpen(false)} onAthleteAdded={handleRefresh} />
      )}

      <EnableAccountModal
        isOpen={isEnableModalOpen}
        target={enableTarget}
        onClose={() => { setIsEnableModalOpen(false); setEnableTarget(null); }}
        onSuccess={handleRefresh}
      />

      {isPayModalOpen && payTarget && (
        <AddPaymentModal 
          initialAthlete={{
            id: payTarget.id,
            name: payTarget.name,
            avatar: payTarget.profileImage, 
            email: payTarget.email,
            planName: payTarget.planName,
            planPrice: payTarget.planPrice
          }}
          onClose={() => { setIsPayModalOpen(false); setPayTarget(null); }}
          onSuccess={() => {
            handleRefresh(); 
          }}
        />
      )}

      <BulkActionsBar
        selectedCount={selectedAthletes.length}
        onAction={() => setSelectedAthletes([])}
        onClearSelection={() => setSelectedAthletes([])}
      />
    </>
  );
};

export default AthletesManagement;