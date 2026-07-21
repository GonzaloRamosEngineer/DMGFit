import React, { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import BreadcrumbTrail from "../../components/ui/BreadcrumbTrail";
import MetricsStrip from "./components/MetricsStrip";
import SearchAndFilters from "./components/SearchAndFilters";
import AthleteCard from "./components/AthleteCard";
import AthleteSegmentation from "./components/AthleteSegmentation";
import RecentActivity from "./components/RecentActivity";
import Icon from "../../components/AppIcon";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { hoyLocal } from "../../utils/formatters";
import AddAthleteModal from "./components/AddAthleteModal";
import EnableAccountModal from "../../components/EnableAccountModal";
import AddPaymentModal from "../payment-management/components/AddPaymentModal";

const AthletesManagement = () => {
  const { currentUser } = useAuth();
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
    newThisMonth: 0,
    upToDateCount: 0,
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

    const formatThousands = (value) =>
      new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(value || 0));

    const loadAthletesData = async () => {
      setIsLoading(true);
      try {
        let query = supabase.from("athletes").select(`
            id, 
            status, 
            join_date,
            coach_id,
            profile_id,
            plan_tier_price,
            visits_per_week,
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
            .select("athlete_id, status, date, payment_date")
            .in("athlete_id", athleteIds)
            .neq("status", "void"),
        ]);

        const enrichedAthletes = athletesData.map((athlete) => {
          const attRecords =
            attendanceRes.data?.filter((r) => r.athlete_id === athlete.id) || [];
          const perfRecords =
            metricsRes.data?.filter((r) => r.athlete_id === athlete.id) || [];
          const payRecords =
            paymentsRes.data?.filter((r) => r.athlete_id === athlete.id) || [];

          const attendanceRate =
            attRecords.length > 0
              ? Math.round(
                  (attRecords.filter((r) => r.status === "present").length /
                    attRecords.length) *
                    100,
                )
              : 0;

          const latestMetric = perfRecords[0]?.value || 0;

          const latestPayment = payRecords
            .slice()
            .sort(
              (a, b) =>
                new Date(b.date || b.payment_date) -
                new Date(a.date || a.payment_date),
            )[0];

          const rawEmail = athlete.profiles?.email || "";
          const isInternalEmail =
            rawEmail.includes("@dmg.internal") || rawEmail.includes("@vcfit.internal");

          const planData = Array.isArray(athlete.plans) ? athlete.plans[0] : athlete.plans;

          const hasTierPrice =
            athlete.plan_tier_price !== null &&
            athlete.plan_tier_price !== undefined &&
            athlete.plan_tier_price !== "";

          const resolvedPlanPriceValue = hasTierPrice
            ? Number(athlete.plan_tier_price)
            : Number(planData?.price ?? 0);

          const resolvedPlanPriceDisplay = formatThousands(resolvedPlanPriceValue);

          return {
            id: athlete.id,
            profileId: athlete.profile_id,
            name: athlete.profiles?.full_name || "Sin Nombre",
            email: isInternalEmail ? "Sin acceso a App" : rawEmail,
            rawEmail: rawEmail,
            profileImage: athlete.profiles?.avatar_url,
            avatar: athlete.profiles?.avatar_url,

            planName: planData?.name || "Sin Plan",
            planPrice: resolvedPlanPriceDisplay,
            planPriceValue: resolvedPlanPriceValue,
            planTierPrice: hasTierPrice ? Number(athlete.plan_tier_price) : null,
            visitsPerWeek:
              athlete.visits_per_week !== null &&
              athlete.visits_per_week !== undefined &&
              athlete.visits_per_week !== ""
                ? Number(athlete.visits_per_week)
                : null,

            planOption: athlete.plan_option || null,
            coach: athlete.coaches?.profiles?.full_name || "Sin Asignar",
            status: athlete.status || "active",
            isActive: athlete.status === "active",

            attendanceRate,
            performanceScore: Math.round(latestMetric),
            performanceTrend: 1,

            paymentStatus: latestPayment?.status || "pending",

            attendanceLast30Days: [80, 90, 75, 85],
            needsActivation: isInternalEmail || rawEmail === "",
          };
        });

        const seg = {
          elite: 0,
          advanced: 0,
          intermediate: 0,
          beginner: 0,
          total: enrichedAthletes.length,
        };

        enrichedAthletes.forEach((a) => {
          if (a.performanceScore >= 90) seg.elite++;
          else if (a.performanceScore >= 75) seg.advanced++;
          else if (a.performanceScore >= 60) seg.intermediate++;
          else seg.beginner++;
        });

        const allActivities = [];

        athletesData.forEach((a) => {
          if (a.join_date) {
            allActivities.push({
              id: `reg-${a.id}`,
              athleteName: a.profiles?.full_name || "Desconocido",
              athleteImage: a.profiles?.avatar_url,
              type: "registration",
              description: "se unió al gimnasio",
              timestamp: new Date(a.join_date).getTime(),
            });
          }
        });

        paymentsRes.data?.forEach((p) => {
          const ts = p.date || p.payment_date;
          if (p.status === "paid" && ts) {
            const athlete = athletesData.find((a) => a.id === p.athlete_id);
            allActivities.push({
              id: `pay-${p.id || Math.random()}`,
              athleteName: athlete?.profiles?.full_name || "Desconocido",
              athleteImage: athlete?.profiles?.avatar_url,
              type: "payment",
              description: "registró un pago",
              timestamp: new Date(ts).getTime(),
            });
          }
        });

        attendanceRes.data?.forEach((att) => {
          if (att.status === "present" && att.date) {
            const athlete = athletesData.find((a) => a.id === att.athlete_id);
            allActivities.push({
              id: `att-${att.athlete_id}-${att.date}`,
              athleteName: athlete?.profiles?.full_name || "Desconocido",
              athleteImage: athlete?.profiles?.avatar_url,
              type: "session",
              description: "asistió a clase",
              timestamp: new Date(att.date).getTime(),
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
          // "YYYY-MM" del mes actual en hora local (join_date es fecha sin hora).
          const currentMonthPrefix = hoyLocal().slice(0, 7);
          setMetricsSummary({
            totalAthletes: enrichedAthletes.length,
            activeThisMonth: enrichedAthletes.filter((a) => a.isActive).length,
            newThisMonth: athletesData.filter(
              (a) => a.join_date && String(a.join_date).slice(0, 7) === currentMonthPrefix,
            ).length,
            upToDateCount: enrichedAthletes.filter(
              (a) => a.paymentStatus === "paid",
            ).length,
          });
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error:", err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadAthletesData();
    return () => {
      isMounted = false;
    };
  }, [currentUser, lastRefresh]);

  const filteredAthletes = useMemo(() => {
    let result = [...athletes];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
      );
    }
    if (activeFilters.paymentStatus) {
      result = result.filter((a) => a.paymentStatus === activeFilters.paymentStatus);
    }
    if (activeFilters.status && activeFilters.status !== "all") {
      result = result.filter((a) => a.status === activeFilters.status);
    }
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

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key)
      return <Icon name="ArrowUpDown" size={12} className="opacity-30" />;
    return (
      <Icon
        name={sortConfig.direction === "asc" ? "ArrowUp" : "ArrowDown"}
        size={12}
        className="text-primary"
      />
    );
  };

  return (
    <>
      <Helmet>
        <title>Gestión de Atletas - VC Fit</title>
      </Helmet>

      <div className="flex flex-col gap-4 lg:gap-5 xl:h-[calc(100vh-4rem)]">

        {/* Header compacto */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
              Gestión de Atletas
            </h1>
            <p className="text-sm text-text-secondary font-medium mt-0.5">
              Supervisa y gestiona todos tus atletas en un solo lugar
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={`flex items-center gap-2 px-5 py-2.5 bg-card text-text-secondary border border-border font-bold rounded-xl hover:bg-muted text-xs uppercase tracking-wider shadow-sm transition-all ${
                isLoading ? "opacity-70 cursor-wait" : ""
              }`}
            >
              <Icon
                name={isLoading ? "Loader" : "RefreshCw"}
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              {isLoading ? "Actualizando..." : "Actualizar"}
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 shadow-md hover:-translate-y-0.5 text-xs uppercase tracking-widest transition-all"
            >
              <Icon name="UserPlus" size={16} /> Nuevo Atleta
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="shrink-0">
          <MetricsStrip metrics={metricsSummary} loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5 xl:flex-1 xl:min-h-0">
          {/* COLUMNA IZQUIERDA */}
          <div className="xl:col-span-8 flex flex-col gap-4 w-full min-w-0 xl:min-h-0">
            <div className="shrink-0">
              <SearchAndFilters
                onSearch={setSearchQuery}
                onFilterChange={setActiveFilters}
                onBulkAction={() => {}}
              />
            </div>

            <Card padding="none" className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <h3 className="text-lg font-black text-text-primary flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-info-light text-primary flex items-center justify-center">
                      <Icon name="Users" size={20} />
                    </div>
                    Directorio de Atletas
                  </h3>
                  <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mt-2 sm:ml-14">
                    {isLoading ? "Cargando..." : `${filteredAthletes.length} Atletas registrados`}
                  </p>
                </div>
              </div>

              <div className="@container flex-1 min-h-0 overflow-auto custom-scrollbar">
                <div className="w-full">
                  {/* Encabezados: solo en vista tabla (contenedor ancho). En angosto se usan tarjetas. */}
                  <div className="hidden @2xl:grid grid-cols-[minmax(150px,3fr)_minmax(110px,1.5fr)_minmax(100px,1.5fr)_90px_72px] gap-3 px-5 py-3 bg-muted border-b border-border text-[10px] font-black text-text-secondary uppercase tracking-widest items-center sticky top-0 z-card">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1.5 hover:text-text-primary transition-colors text-left group"
                    >
                      ATLETA {renderSortIcon("name")}
                    </button>

                    <button
                      onClick={() => handleSort("planName")}
                      className="flex items-center gap-1.5 hover:text-text-primary transition-colors text-left group"
                    >
                      MEMBRESÍA {renderSortIcon("planName")}
                    </button>

                    <button
                      onClick={() => handleSort("performanceScore")}
                      className="flex items-center gap-1.5 hover:text-text-primary transition-colors text-left group"
                    >
                      MÉTRICAS {renderSortIcon("performanceScore")}
                    </button>

                    <button
                      onClick={() => handleSort("paymentStatus")}
                      className="flex items-center gap-1.5 hover:text-text-primary transition-colors text-left group"
                    >
                      ESTADO {renderSortIcon("paymentStatus")}
                    </button>

                    <div className="text-center">ACCIONES</div>
                  </div>

                  <div className="flex flex-col divide-y divide-border pb-4">
                    {isLoading ? (
                      [1, 2, 3].map((i) => <AthleteCard key={i} loading={true} layout="table" />)
                    ) : filteredAthletes.length > 0 ? (
                      filteredAthletes.map((athlete) => (
                        <AthleteCard
                          key={athlete.id}
                          athlete={athlete}
                          layout="table"
                          canEnable={currentUser?.role === "admin"}
                          onQuickPay={(target) => {
                            setPayTarget(target);
                            setIsPayModalOpen(true);
                          }}
                          onEnableAccount={(target) => {
                            setEnableTarget({
                              profileId: target.profileId,
                              email:
                                target.rawEmail?.includes("@dmg.internal") ||
                                target.rawEmail?.includes("@vcfit.internal")
                                  ? ""
                                  : target.rawEmail,
                              name: target.name,
                              role: "atleta",
                            });
                            setIsEnableModalOpen(true);
                          }}
                        />
                      ))
                    ) : (
                      <EmptyState
                        iconName="Users"
                        title="No se encontraron atletas."
                        description="Intenta cambiar los filtros de búsqueda."
                        className="py-20"
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="xl:col-span-4 flex flex-col gap-4 w-full min-w-0 xl:min-h-0 xl:overflow-y-auto custom-scrollbar">
            <div className="shrink-0">
              <AthleteSegmentation segmentationData={segmentation} loading={isLoading} />
            </div>
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
        onClose={() => {
          setIsEnableModalOpen(false);
          setEnableTarget(null);
        }}
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
            planPrice:
              payTarget.planPriceValue !== undefined && payTarget.planPriceValue !== null
                ? payTarget.planPriceValue
                : 0,
            planTierPrice:
              payTarget.planTierPrice !== undefined && payTarget.planTierPrice !== null
                ? payTarget.planTierPrice
                : null,
            visitsPerWeek:
              payTarget.visitsPerWeek !== undefined && payTarget.visitsPerWeek !== null
                ? payTarget.visitsPerWeek
                : null,
          }}
          onClose={() => {
            setIsPayModalOpen(false);
            setPayTarget(null);
          }}
          onSuccess={() => {
            handleRefresh();
          }}
        />
      )}

    </>
  );
};

export default AthletesManagement;
