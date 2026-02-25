import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "../../lib/supabaseClient";
import { fetchKioskRemaining } from "../../services/kiosk";

// Context
import { useAuth } from "../../contexts/AuthContext";

// UI Components
import BreadcrumbTrail from "../../components/ui/BreadcrumbTrail";
import Icon from "../../components/AppIcon";

// Profile Components
import AthleteHeader from "./components/AthleteHeader";
import MetricCard from "./components/MetricCard";
import PerformanceChart from "./components/PerformanceChart";
import AttendanceCalendar from "./components/AttendanceCalendar";
import PaymentHistory from "./components/PaymentHistory";
import CoachNotes from "./components/CoachNotes";
import UpcomingSessions from "./components/UpcomingSessions";
import HealthMetrics from "./components/HealthMetrics";
import { generateAthletePDF } from "../../utils/pdfExport";
import EnableAccountModal from "../../components/EnableAccountModal";

// --- SUB-COMPONENTE INTERNO: HISTORIAL DE ACCESOS (MOLINETE) ---
const AthleteAccessLog = ({ logs }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Icon name="CreditCard" size={20} className="text-primary" />
          Historial de Ingresos (DNI)
        </h3>
        <span className="text-xs text-muted-foreground">{logs.length} registros</span>
      </div>
      
      <div className="space-y-0 divide-y divide-border border border-border rounded-lg overflow-hidden">
        {logs.length > 0 ? (
          logs.slice(0, 5).map(log => (
            <div key={log.id} className="flex justify-between items-center p-3 bg-card hover:bg-muted/30 transition-colors text-sm">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${log.access_granted ? 'bg-success' : 'bg-error'}`} />
                <span className="font-medium">
                  {new Date(log.check_in_time).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground font-mono text-xs">
                  {new Date(log.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
                <span className={`text-xs font-bold ${log.access_granted ? 'text-success' : 'text-error'}`}>
                  {log.access_granted ? 'OK' : 'DENEGADO'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Sin ingresos registrados aún.
          </div>
        )}
      </div>
      {logs.length > 5 && (
        <div className="pt-3 text-center">
          <button className="text-xs text-primary hover:underline">Ver historial completo</button>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const IndividualAthleteProfile = () => {
  const { id: athleteId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("performance");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [enableTarget, setEnableTarget] = useState(null);

  // Estado unificado de datos
  const [profileData, setProfileData] = useState({
    athlete: null,
    metrics: [],
    latestMetrics: {},
    attendance: [],
    accessLogs: [],
    payments: [],
    notes: [],
    sessions: [],
    kioskRemaining: null,
  });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!athleteId) return;
      setLoading(true);

      try {
        // 1. Datos del Atleta - Ajuste: Se añaden dni y profile_id
        const { data: athlete, error: athleteError } = await supabase
          .from("athletes")
          .select(`
            id, 
            dni, 
            join_date, 
            status, 
            membership_type, 
            phone, 
            plan_id,
            profile_id,
            profiles:profile_id ( full_name, email, avatar_url )
          `)
          .eq("id", athleteId)
          .single();

        if (athleteError) throw athleteError;

        // 2. Cargas Paralelas
        const [metricsRes, attendanceRes, paymentsRes, notesRes, sessionsRes, accessLogsRes, kioskRemainingRes] =
          await Promise.all([
            // Métricas
            supabase.from("metrics").select("*").eq("athlete_id", athleteId).order("date", { ascending: true }),
            // Asistencia (Clases)
            supabase.from("attendance").select("*").eq("athlete_id", athleteId).order("date", { ascending: false }),
            // Pagos
            supabase.from("payments").select("*").eq("athlete_id", athleteId).order("payment_date", { ascending: false }),
            // Notas
            supabase.from("notes").select("*").eq("athlete_id", athleteId).order("date", { ascending: false }),
            // Próximas Sesiones
            supabase.from("session_attendees")
              .select(`session:session_id (id, session_date, time, type, location)`)
              .eq("athlete_id", athleteId),
            // Access Logs (Molinete)
            supabase.from("access_logs")
              .select("*")
              .eq("athlete_id", athleteId)
              .order("check_in_time", { ascending: false })
              .limit(20),
            fetchKioskRemaining({ athleteId }).catch(() => null)
          ]);

        // 3. Procesar Métricas de Salud
        const metricsList = metricsRes.data || [];
        const latestValues = {};
        ["Peso Corporal", "Altura", "Grasa Corporal"].forEach((key) => {
          const found = [...metricsList].reverse().find((m) => m.name === key);
          if (found) latestValues[key] = found;
        });

        // Calcular IMC
        if (latestValues["Peso Corporal"] && latestValues["Altura"]) {
          const weight = Number(latestValues["Peso Corporal"].value);
          const heightM = Number(latestValues["Altura"].value) / 100;
          if (heightM > 0) {
            latestValues["IMC"] = {
              value: (weight / (heightM * heightM)).toFixed(1),
              unit: "kg/m²",
              date: latestValues["Peso Corporal"].date,
            };
          }
        }

        // 4. Formatear Sesiones
        const today = new Date().toISOString().split("T")[0];
        const upcoming = (sessionsRes.data || [])
          .map((item) => item.session)
          .filter((s) => s && s.session_date >= today)
          .sort((a, b) => new Date(a.session_date) - new Date(b.session_date))
          .slice(0, 3);

        setProfileData({
          athlete: {
            ...athlete,
            name: athlete.profiles?.full_name || 'Atleta Sin Nombre',
            email: athlete.profiles?.email,
            photo: athlete.profiles?.avatar_url,
            dni: athlete.dni,
            profile_id: athlete.profile_id
          },
          metrics: metricsList,
          latestMetrics: latestValues,
          attendance: attendanceRes.data || [],
          accessLogs: accessLogsRes.data || [],
          payments: paymentsRes.data || [],
          notes: notesRes.data || [],
          sessions: upcoming,
          kioskRemaining: kioskRemainingRes,
        });
      } catch (error) {
        console.error("Error cargando perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [athleteId, refreshKey]);

  // --- KPIs CALCULADOS ---
  const kpiStats = useMemo(() => {
    const totalAtt = profileData.attendance.length;
    const totalAccess = profileData.accessLogs.filter(l => l.access_granted).length;
    
    // Tasa Asistencia (Clases)
    const present = profileData.attendance.filter((a) => a.status === "present").length;
    const rate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;

    return [
      {
        title: "Tasa de Asistencia (Clases)",
        value: `${rate}`,
        unit: "%",
        change: "Global",
        changeType: rate >= 80 ? "positive" : "warning",
        icon: "Calendar",
        iconColor: "var(--color-primary)",
      },
      {
        title: "Visitas Totales (Molinete)",
        value: `${totalAccess}`,
        unit: "ingresos",
        change: "Histórico",
        changeType: "neutral",
        icon: "LogIn",
        iconColor: "var(--color-success)",
      },
      {
        title: "Saldo Sesiones (Actual)",
        value: profileData.kioskRemaining?.remaining ?? "—",
        unit: "ses.",
        change: profileData.kioskRemaining?.period_end || "Sin período",
        changeType: "neutral",
        icon: "Wallet",
        iconColor: "var(--color-accent)",
      },
    ];
  }, [profileData.attendance, profileData.accessLogs, profileData.kioskRemaining]);

  const isInternalEmail = (email = "") =>
    email.includes("@dmg.internal") || email.includes("@vcfit.internal");

  const handleEnableAccess = (target) => {
    if (!target?.profile_id) return;

    setEnableTarget({
      profileId: target.profile_id,
      email: isInternalEmail(target.email) ? "" : target.email,
      name: target.name,
      role: "atleta",
    });
    setIsEnableModalOpen(true);
  };

  // --- HANDLERS ---
  const handleAddNote = async (content) => {
    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          athlete_id: athleteId,
          content: content,
          date: new Date().toISOString().split("T")[0],
          type: "general",
          coach_id: currentUser?.coachId || null,
        })
        .select()
        .single();

      if (error) throw error;
      setProfileData((prev) => ({ ...prev, notes: [data, ...prev.notes] }));
    } catch (err) {
      console.error("Error guardando nota:", err);
      alert("No se pudo guardar la nota.");
    }
  };

  const handleExportPDF = async () => {
    if (!profileData.athlete) return;
    await generateAthletePDF(
      profileData.athlete,
      profileData.metrics,
      profileData.attendance,
      profileData.payments,
      profileData.notes
    );
  };

  return (
    <>
      <Helmet>
        <title>
          {profileData.athlete ? `${profileData.athlete.name} - Perfil` : "Cargando..."} - VC Fit
        </title>
      </Helmet>

      <div className="p-4 md:p-6 lg:p-8 w-full">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbTrail
            items={[
              { label: "Gestión de Atletas", path: "/athletes-management" },
              { label: profileData.athlete?.name || "Perfil", path: "#", active: true },
            ]}
          />

          {/* HEADER */}
          <AthleteHeader
            athlete={profileData.athlete}
            loading={loading}
            onExport={handleExportPDF}
            canEnable={currentUser?.role === "admin"}
            onEnableAccess={handleEnableAccess}
          />

          {/* KPI STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse"></div>
                ))
              : kpiStats.map((stat, i) => <MetricCard key={i} {...stat} />)}
          </div>

          {/* MAIN CONTENT GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* TABS DE NAVEGACIÓN */}
              <div className="bg-card border border-border rounded-xl p-1 overflow-x-auto">
                <div className="flex space-x-1 min-w-max">
                  {["performance", "attendance", "payments"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONTENIDO DE TABS */}
              <div className="min-h-[400px]">
                {activeTab === "performance" && (
                  <PerformanceChart data={profileData.metrics} loading={loading} />
                )}
                {activeTab === "attendance" && (
                  <AttendanceCalendar data={profileData.attendance} loading={loading} />
                )}
                {activeTab === "payments" && (
                  <PaymentHistory payments={profileData.payments} loading={loading} />
                )}
              </div>
            </div>

            <div className="space-y-6">
              <HealthMetrics metrics={profileData.latestMetrics} loading={loading} />
              
              <AthleteAccessLog logs={profileData.accessLogs} />

              <UpcomingSessions sessions={profileData.sessions} loading={loading} />
              
              <CoachNotes
                notes={profileData.notes}
                onAddNote={handleAddNote}
                loading={loading}
              />
            </div>
          </div>
        </div>

        <EnableAccountModal
          isOpen={isEnableModalOpen}
          target={enableTarget}
          onClose={() => {
            setIsEnableModalOpen(false);
            setEnableTarget(null);
          }}
          onSuccess={() => setRefreshKey((prev) => prev + 1)}
        />
      </div>
    </>
  );
};

export default IndividualAthleteProfile;
