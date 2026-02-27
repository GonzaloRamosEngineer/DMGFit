import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
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

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
  }).format(amount);
};

const normalizeRelation = (value) => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const isAssignmentCurrentlyActive = (assignment, todayStr) => {
  if (!assignment?.is_active) return false;
  if (assignment.starts_on && assignment.starts_on > todayStr) return false;
  if (assignment.ends_on && assignment.ends_on < todayStr) return false;
  return true;
};

const getNextDateForDayOfWeek = (targetDay) => {
  const now = new Date();
  const today = now.getDay(); // 0 domingo ... 6 sábado
  const diff = (Number(targetDay) - today + 7) % 7;
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(now.getDate() + diff);
  return next;
};

const buildUpcomingFromAssignments = (assignedSlots = []) => {
  return assignedSlots
    .map((assignment) => {
      const schedule = normalizeRelation(assignment.weekly_schedule);
      if (!schedule) return null;

      const nextDate = getNextDateForDayOfWeek(Number(schedule.day_of_week));
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
      const dd = String(nextDate.getDate()).padStart(2, "0");
      const sessionDate = `${yyyy}-${mm}-${dd}`;

      return {
        id: assignment.id,
        session_date: sessionDate,
        time: String(schedule.start_time || "").slice(0, 5),
        type: `${DAYS[Number(schedule.day_of_week)] || "Día"} · ${String(
          schedule.start_time || ""
        ).slice(0, 5)}-${String(schedule.end_time || "").slice(0, 5)}`,
        location: "Horario asignado",
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateCompare = new Date(a.session_date) - new Date(b.session_date);
      if (dateCompare !== 0) return dateCompare;
      return String(a.time).localeCompare(String(b.time));
    })
    .slice(0, 6);
};

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
          logs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="flex justify-between items-center p-3 bg-card hover:bg-muted/30 transition-colors text-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    log.access_granted ? "bg-success" : "bg-error"
                  }`}
                />
                <span className="font-medium">
                  {new Date(log.check_in_time).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground font-mono text-xs">
                  {new Date(log.check_in_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={`text-xs font-bold ${
                    log.access_granted ? "text-success" : "text-error"
                  }`}
                >
                  {log.access_granted ? "OK" : "DENEGADO"}
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
          <button className="text-xs text-primary hover:underline">
            Ver historial completo
          </button>
        </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENTE INTERNO: MEMBRESÍA ESTRUCTURAL ---
const StructuralMembershipCard = ({ athlete, assignedSlots = [], loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
        <div className="h-24 bg-slate-100 rounded-lg"></div>
      </div>
    );
  }

  if (!athlete) return null;

  const groupedByDay = DAYS.map((day, index) => ({
    day,
    slots: assignedSlots.filter(
      (assignment) =>
        Number(normalizeRelation(assignment.weekly_schedule)?.day_of_week) === index
    ),
  })).filter((group) => group.slots.length > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-800">Membresía Estructural</h3>
          <p className="text-xs text-slate-500">
            Resumen real del plan contratado, frecuencia y horarios asignados.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Estado
          </p>
          <p
            className={`text-xs font-black ${
              athlete.status === "active" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {athlete.status === "active" ? "Activa" : "Inactiva"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Plan
          </p>
          <p className="mt-1 text-sm font-black text-slate-800">
            {athlete.planName || "Sin Plan"}
          </p>
          <p className="text-xs text-slate-500">{athlete.planOption || "Sin opción"}</p>
        </div>

        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Frecuencia
          </p>
          <p className="mt-1 text-sm font-black text-slate-800">
            {athlete.visits_per_week ? `${athlete.visits_per_week}x / semana` : "—"}
          </p>
          <p className="text-xs text-slate-500">Visitas contratadas</p>
        </div>

        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Precio acordado
          </p>
          <p className="mt-1 text-sm font-black text-slate-800">
            {athlete.plan_tier_price ? formatCurrency(athlete.plan_tier_price) : "—"}
          </p>
          <p className="text-xs text-slate-500">Tier real del atleta</p>
        </div>

        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Slots activos
          </p>
          <p className="mt-1 text-sm font-black text-slate-800">
            {assignedSlots.length}
          </p>
          <p className="text-xs text-slate-500">Asignaciones vigentes</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="CalendarDays" size={16} className="text-blue-600" />
          <h4 className="text-sm font-black text-slate-800">Horarios asignados</h4>
        </div>

        {groupedByDay.length === 0 ? (
          <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-4 bg-slate-50">
            El atleta no tiene slots semanales activos asignados.
          </div>
        ) : (
          <div className="space-y-3">
            {groupedByDay.map((group) => (
              <div key={group.day}>
                <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                  {group.day}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.slots
                    .map((assignment) => normalizeRelation(assignment.weekly_schedule))
                    .filter(Boolean)
                    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
                    .map((schedule) => (
                      <span
                        key={schedule.id}
                        className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold"
                      >
                        {String(schedule.start_time).slice(0, 5)} -{" "}
                        {String(schedule.end_time).slice(0, 5)}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        La reasignación de plan/frecuencia/slots debe hacerse desde el flujo de gestión
        estructural para evitar inconsistencias entre cupos, pricing, kiosk y pagos.
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const IndividualAthleteProfile = () => {
  const { id: athleteId } = useParams();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState("performance");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [enableTarget, setEnableTarget] = useState(null);

  const [profileData, setProfileData] = useState({
    athlete: null,
    metrics: [],
    latestMetrics: {},
    attendance: [],
    accessLogs: [],
    payments: [],
    notes: [],
    sessions: [],
    assignedSlots: [],
    kioskRemaining: null,
  });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!athleteId) return;
      setLoading(true);

      try {
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
            plan_option,
            profile_id,
            visits_per_week,
            plan_tier_price,
            plans:plan_id ( name, price ),
            profiles:profile_id ( full_name, email, avatar_url )
          `)
          .eq("id", athleteId)
          .single();

        if (athleteError) throw athleteError;

        const todayStr = new Date().toISOString().split("T")[0];

        const [
          metricsRes,
          attendanceRes,
          paymentsRes,
          notesRes,
          accessLogsRes,
          kioskRemainingRes,
          assignedSlotsRes,
        ] = await Promise.all([
          supabase
            .from("metrics")
            .select("*")
            .eq("athlete_id", athleteId)
            .order("date", { ascending: true }),

          supabase
            .from("attendance")
            .select("*")
            .eq("athlete_id", athleteId)
            .order("date", { ascending: false }),

          supabase
            .from("payments")
            .select("*")
            .eq("athlete_id", athleteId)
            .order("payment_date", { ascending: false }),

          supabase
            .from("notes")
            .select("*")
            .eq("athlete_id", athleteId)
            .order("date", { ascending: false }),

          supabase
            .from("access_logs")
            .select("*")
            .eq("athlete_id", athleteId)
            .order("check_in_time", { ascending: false })
            .limit(20),

          fetchKioskRemaining({ athleteId }).catch(() => null),

          supabase
            .from("athlete_slot_assignments")
            .select(`
              id,
              athlete_id,
              weekly_schedule_id,
              starts_on,
              ends_on,
              is_active,
              weekly_schedule:weekly_schedule_id (
                id,
                day_of_week,
                start_time,
                end_time,
                capacity
              )
            `)
            .eq("athlete_id", athleteId)
            .eq("is_active", true),
        ]);

        const metricsList = metricsRes.data || [];
        const latestValues = {};

        ["Peso Corporal", "Altura", "Grasa Corporal"].forEach((key) => {
          const found = [...metricsList].reverse().find((m) => m.name === key);
          if (found) latestValues[key] = found;
        });

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

        const activeAssignedSlots = (assignedSlotsRes.data || [])
          .filter((assignment) => isAssignmentCurrentlyActive(assignment, todayStr))
          .sort((a, b) => {
            const scheduleA = normalizeRelation(a.weekly_schedule);
            const scheduleB = normalizeRelation(b.weekly_schedule);
            const dayA = Number(scheduleA?.day_of_week ?? 99);
            const dayB = Number(scheduleB?.day_of_week ?? 99);
            if (dayA !== dayB) return dayA - dayB;
            return String(scheduleA?.start_time || "").localeCompare(
              String(scheduleB?.start_time || "")
            );
          });

        const upcoming = buildUpcomingFromAssignments(activeAssignedSlots);

        const planData = normalizeRelation(athlete.plans);
        const profileInfo = normalizeRelation(athlete.profiles);

        setProfileData({
          athlete: {
            ...athlete,
            name: profileInfo?.full_name || "Atleta Sin Nombre",
            email: profileInfo?.email,
            photo: profileInfo?.avatar_url,
            dni: athlete.dni,
            profile_id: athlete.profile_id,
            planName: planData?.name || "Sin Plan",
            planBasePrice: planData?.price || null,
            planOption: athlete.plan_option || null,
            visits_per_week: athlete.visits_per_week || null,
            plan_tier_price: athlete.plan_tier_price || null,
          },
          metrics: metricsList,
          latestMetrics: latestValues,
          attendance: attendanceRes.data || [],
          accessLogs: accessLogsRes.data || [],
          payments: paymentsRes.data || [],
          notes: notesRes.data || [],
          sessions: upcoming,
          assignedSlots: activeAssignedSlots,
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
    const totalAccess = profileData.accessLogs.filter((l) => l.access_granted).length;

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
          content,
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

          <AthleteHeader
            athlete={profileData.athlete}
            loading={loading}
            onExport={handleExportPDF}
            canEnable={currentUser?.role === "admin"}
            onEnableAccess={handleEnableAccess}
          />

          <StructuralMembershipCard
            athlete={profileData.athlete}
            assignedSlots={profileData.assignedSlots}
            loading={loading}
          />

          {/* KPI STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-card border border-border rounded-xl animate-pulse"
                  ></div>
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