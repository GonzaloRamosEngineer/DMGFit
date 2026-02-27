import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "../../lib/supabaseClient";
import { fetchKioskRemaining } from "../../services/kiosk";
import { fetchPlanSlots } from "../../services/plans";
import { fetchAthleteAssignedSlots, reassignAthleteSlots } from "../../services/athletes";

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
import ModifyAthleteScheduleModal from "./components/ModifyAthleteScheduleModal";
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


const buildUpcomingFromAssignments = (assignments = []) => {
  const now = new Date();
  const currentDay = now.getDay();
  const sessions = (assignments || []).map((assignment) => {
    const ws = assignment.weekly_schedule || {};
    const targetDay = Number(ws.day_of_week || 0);
    const delta = (targetDay - currentDay + 7) % 7;
    const next = new Date(now);
    next.setDate(now.getDate() + delta);

    return {
      id: assignment.id,
      type: 'Horario asignado',
      session_date: next.toISOString().split('T')[0],
      time: ws.start_time,
      location: 'Plan actual',
      weekly_schedule_id: assignment.weekly_schedule_id,
      day_of_week: ws.day_of_week,
      end_time: ws.end_time,
      capacity: ws.capacity,
    };
  });

  return sessions
    .sort((a, b) => {
      const ad = new Date(`${a.session_date}T${a.time || '00:00:00'}`);
      const bd = new Date(`${b.session_date}T${b.time || '00:00:00'}`);
      return ad - bd;
    })
    .slice(0, 6);
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
  const [availablePlans, setAvailablePlans] = useState([]);
  const [availablePlanOptions, setAvailablePlanOptions] = useState([]);
  const [membershipForm, setMembershipForm] = useState({ planId: '', planOption: '' });
  const [savingMembership, setSavingMembership] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [assignedSlots, setAssignedSlots] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

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
            plan_option,
            visits_per_week,
            plan_tier_price,
            profile_id,
            plans:plan_id ( name ),
            profiles:profile_id ( full_name, email, avatar_url )
          `)
          .eq("id", athleteId)
          .single();

        if (athleteError) throw athleteError;

        // 2. Cargas Paralelas
        const [metricsRes, attendanceRes, paymentsRes, notesRes, assignedSlotsRes, accessLogsRes, kioskRemainingRes] =
          await Promise.all([
            supabase.from("metrics").select("*").eq("athlete_id", athleteId).order("date", { ascending: true }),
            supabase.from("attendance").select("*").eq("athlete_id", athleteId).order("date", { ascending: false }),
            supabase.from("payments").select("*").eq("athlete_id", athleteId).order("payment_date", { ascending: false }),
            supabase.from("notes").select("*").eq("athlete_id", athleteId).order("date", { ascending: false }),
            fetchAthleteAssignedSlots(athleteId).catch(() => []),
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

        const activeAssignments = assignedSlotsRes || [];
        const upcoming = buildUpcomingFromAssignments(activeAssignments);

        setAssignedSlots(activeAssignments);
        const planSlots = athlete.plan_id ? await fetchPlanSlots(athlete.plan_id).catch(() => []) : [];
        setAvailableSlots(planSlots || []);

        setProfileData({
          athlete: {
            ...athlete,
            name: athlete.profiles?.full_name || 'Atleta Sin Nombre',
            email: athlete.profiles?.email,
            photo: athlete.profiles?.avatar_url,
            dni: athlete.dni,
            profile_id: athlete.profile_id,
            planName: athlete.plans?.name || 'Sin Plan',
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

  useEffect(() => {
    if (!profileData.athlete) return;

    setMembershipForm({
      planId: profileData.athlete.plan_id || '',
      planOption: profileData.athlete.plan_option || '',
    });
  }, [profileData.athlete]);

  const canManageMembership = currentUser?.role && currentUser.role !== 'atleta';

  useEffect(() => {
    const fetchPlans = async () => {
      if (!canManageMembership) return;

      const { data, error } = await supabase
        .from('plans')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error cargando planes para edición:', error);
        return;
      }

      setAvailablePlans(data || []);
    };

    fetchPlans();
  }, [canManageMembership]);

  useEffect(() => {
    const fetchOptions = async () => {
      if (!membershipForm.planId) {
        setAvailablePlanOptions([]);
        return;
      }

      const { data, error } = await supabase
        .from('plan_features')
        .select('feature')
        .eq('plan_id', membershipForm.planId);

      if (error) {
        console.error('Error cargando opciones de plan para edición:', error);
        setAvailablePlanOptions([]);
        return;
      }

      const normalized = Array.from(
        new Set(
          (data || [])
            .map((item) => (typeof item.feature === 'string' ? item.feature.trim() : ''))
            .filter(Boolean)
        )
      );
      setAvailablePlanOptions(normalized);

      if (membershipForm.planOption && !normalized.includes(membershipForm.planOption)) {
        setMembershipForm((prev) => ({ ...prev, planOption: '' }));
      }
    };

    fetchOptions();
  }, [membershipForm.planId]);

  const handleMembershipChange = (event) => {
    const { name, value } = event.target;

    if (name === 'planId') {
      setMembershipForm((prev) => ({ ...prev, planId: value, planOption: '' }));
      return;
    }

    setMembershipForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveMembership = async () => {
    if (!profileData.athlete?.id || !membershipForm.planId) {
      alert('Selecciona un plan válido antes de guardar.');
      return;
    }

    if (membershipForm.planOption && !availablePlanOptions.includes(membershipForm.planOption)) {
      alert('La opción seleccionada no pertenece al plan elegido.');
      return;
    }

    setSavingMembership(true);
    try {
      const { error } = await supabase
        .from('athletes')
        .update({
          plan_id: membershipForm.planId,
          plan_option: membershipForm.planOption || null,
        })
        .eq('id', profileData.athlete.id);

      if (error) throw error;
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error actualizando plan del atleta:', error);
      alert(error.message || 'No se pudo actualizar el plan del atleta.');
    } finally {
      setSavingMembership(false);
    }
  };


  const canModifySchedule = canManageMembership && Number(profileData.athlete?.visits_per_week || 0) > 0 && !!profileData.athlete?.plan_id;

  const handleSaveSchedule = async (selectedWeeklyScheduleIds) => {
    if (!profileData.athlete?.id) return;

    setSavingSchedule(true);
    const result = await reassignAthleteSlots({
      athleteId: profileData.athlete.id,
      planId: profileData.athlete.plan_id,
      visitsPerWeek: profileData.athlete.visits_per_week,
      selectedWeeklyScheduleIds,
      fetchPlanSlots,
    });

    if (!result.success) {
      alert(result.error || 'No se pudieron reasignar los horarios.');
      setSavingSchedule(false);
      return;
    }

    setIsScheduleModalOpen(false);
    setSavingSchedule(false);
    setRefreshKey((prev) => prev + 1);
  };

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

          {canManageMembership && profileData.athlete && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Plan y Opción / Variante</h3>
                  <p className="text-xs text-slate-500">Gestiona la asignación actual del atleta.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(true)}
                    disabled={!canModifySchedule}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${canModifySchedule ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                  >
                    Modificar horarios
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMembership}
                    disabled={savingMembership}
                    className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors ${savingMembership ? 'bg-slate-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {savingMembership ? 'Guardando...' : 'Guardar asignación'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan</label>
                  <select
                    name="planId"
                    value={membershipForm.planId}
                    onChange={handleMembershipChange}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Opción / Variante</label>
                  <select
                    name="planOption"
                    value={membershipForm.planOption}
                    onChange={handleMembershipChange}
                    disabled={!membershipForm.planId || availablePlanOptions.length === 0}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm disabled:opacity-60"
                  >
                    <option value="">{membershipForm.planId ? 'Sin opción' : 'Selecciona un plan primero'}</option>
                    {availablePlanOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Asignación actual</label>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{profileData.athlete.planName || 'Sin Plan'}</p>
                  <p className="text-xs text-slate-500">{profileData.athlete.planOption || '—'}</p>
                  <p className="text-xs text-slate-500 mt-1">Horarios activos: {assignedSlots.length}</p>
                </div>
              </div>
            </div>
          )}

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


        {isScheduleModalOpen && profileData.athlete && (
          <ModifyAthleteScheduleModal
            athlete={profileData.athlete}
            assignedSlots={assignedSlots}
            availableSlots={availableSlots}
            loading={savingSchedule}
            onClose={() => setIsScheduleModalOpen(false)}
            onSave={handleSaveSchedule}
          />
        )}

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
