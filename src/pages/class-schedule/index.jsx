import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Helmet } from "react-helmet";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";

import { supabase } from "../../lib/supabaseClient";
import { fetchPlanGridAvailability } from "../../services/plans";
import { useAuth } from "../../contexts/AuthContext";
import BreadcrumbTrail from "../../components/ui/BreadcrumbTrail";
import Icon from "../../components/AppIcon";

import ClassSlotModal from "./components/ClassSlotModal";
import ActivityManagerModal from "./components/ActivityManagerModal";

const DAY_LABELS = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

const normalizeTime = (t) => String(t || "").slice(0, 5);
const jsDowToDb = (jsDow) => (jsDow === 0 ? 7 : jsDow);

const TIME_START = 7;
const TIME_END = 22;

const buildHours = () =>
  Array.from(
    { length: TIME_END - TIME_START + 1 },
    (_, i) => `${String(i + TIME_START).padStart(2, "0")}:00`,
  );

const computeDurationMinutes = (startTime, endTime) => {
  const [sh, sm] = String(startTime).split(":").map(Number);
  const [eh, em] = String(endTime).split(":").map(Number);
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  return Math.max(0, end - start);
};

const Segmented = ({ value, onChange, options = [] }) => (
  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
    {options.map((o) => {
      const active = value === o.value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            active
              ? "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// ─── CUPOS: chip sutil según lugares libres ──────────────────────────────────
const getRemainingStyle = (remaining) => {
  const r = Number(remaining ?? -1);
  if (r < 0)  return null; // sin datos
  if (r === 0) return { chip: "bg-rose-100 text-rose-700 border-rose-200",   dot: "bg-rose-500",   label: "Completo" };
  if (r <= 7)  return { chip: "bg-rose-50 text-rose-600 border-rose-200",    dot: "bg-rose-400",   label: `${r} lugar${r === 1 ? "" : "es"}` };
  if (r <= 14) return { chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400",  label: `${r} lugares` };
               return { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: `${r} lugares` };
};

// ─── CARD ────────────────────────────────────────────────────────────────────
const PlanSlotCard = ({ slot, onClick }) => {
  const planName = slot.planName || "Plan";
  const timeLabel = `${normalizeTime(slot.startTime)} – ${normalizeTime(slot.endTime)}`;

  const activityName = slot.activityName || "Sin actividad";
  const activityColor = slot.activityColor || "#94a3b8";
  const hasActivity = Boolean(slot.activityId);

  const coaches = slot.coaches || [];
  const coachCount = coaches.length;

  const needsConfig = !hasActivity || coachCount === 0;

  // Cupos
  const remaining = slot.remaining ?? null;
  const capacity  = slot.capacity  ?? null;
  const remStyle  = getRemainingStyle(remaining);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(slot);
      }}
      className="group w-full text-left bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{ borderLeft: `3px solid ${activityColor}` }}
    >
      {/* Top section */}
      <div className="px-3 pt-3 pb-2">
        {/* Plan badge + config status */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full leading-tight truncate max-w-[70%]">
            {planName}
          </span>

          {needsConfig ? (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              <Icon name="AlertTriangle" size={9} />
              Pendiente
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              <Icon name="CheckCircle2" size={9} />
              OK
            </span>
          )}
        </div>

        {/* Activity name */}
        <p
          className="font-black text-sm leading-tight mb-0.5 truncate"
          style={{ color: hasActivity ? activityColor : "#94a3b8" }}
        >
          {activityName}
        </p>

        {/* Detail */}
        {slot.activityDetail ? (
          <p className="text-[10px] text-slate-400 truncate leading-tight">
            {slot.activityDetail}
          </p>
        ) : (
          <p className="text-[10px] text-slate-300 italic leading-tight">Sin detalle</p>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-slate-100" />

      {/* Bottom: time + cupo chip + arrow */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-lg whitespace-nowrap">
            <Icon name="Clock" size={9} />
            {timeLabel}
          </span>

          {/* Chip de cupos restantes */}
          {remStyle ? (
            <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-lg border whitespace-nowrap ${remStyle.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${remStyle.dot}`} />
              {remStyle.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-lg whitespace-nowrap">
              <Icon name="Users" size={9} />
              {capacity ?? "–"}
            </span>
          )}
        </div>

        <Icon
          name="ChevronRight"
          size={14}
          className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"
        />
      </div>

      {/* Coaches row */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {coaches.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="w-5 h-5 rounded-full ring-1 ring-white bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-[8px] font-black text-slate-600"
                title={c.name}
              >
                {c.avatar ? (
                  <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  (c.name || "P").charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {coachCount === 0 && (
              <div className="w-5 h-5 rounded-full ring-1 ring-white bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Icon name="UserX" size={10} className="text-rose-400" />
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-500 truncate">
            {coachCount > 0
              ? `${coachCount} profe${coachCount > 1 ? "s" : ""}`
              : "Sin profesor"}
          </span>
        </div>
      </div>
    </button>
  );
};

// ────────────────────────────────────────────────────────────────────────────

const ClassSchedule = () => {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [allCoaches, setAllCoaches] = useState([]);
  const [allActivities, setAllActivities] = useState([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [mobileDayView, setMobileDayView] = useState(
    jsDowToDb(new Date().getDay()),
  );

  const [filterPlan, setFilterPlan] = useState("all");
  const [filterCoach, setFilterCoach] = useState("all");
  const [filterActivity, setFilterActivity] = useState("all");

  const [isStaff, setIsStaff] = useState(false);
  const [currentCoachId, setCurrentCoachId] = useState(null);

  const [viewMode, setViewMode] = useState("global");
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showActivityManager, setShowActivityManager] = useState(false);

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [teamWeek, setTeamWeek] = useState({
    hours: 0,
    slots: 0,
    topName: "—",
    topHours: 0,
  });
  const [teamMonth, setTeamMonth] = useState({
    hours: 0,
    slots: 0,
    topName: "—",
    topHours: 0,
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const hours = useMemo(() => buildHours(), []);

  const fetchIdentity = useCallback(async () => {
    try {
      // Usamos el rol del perfil directamente (ya disponible en AuthContext)
      // en lugar de is_staff que devuelve true tanto para 'admin' como 'profesor'
      const isAdmin = currentUser?.role === "admin";
      setIsStaff(isAdmin);

      // Solo buscamos coachId si es profesor (para el caso admin+profe no aplica)
      const coachRes = await supabase.rpc("current_coach_id");
      setCurrentCoachId(coachRes?.data || null);

      if (!isAdmin) setViewMode("coach");
    } catch (e) {
      setIsStaff(false);
      setViewMode("coach");
      setCurrentCoachId(null);
    }
  }, [currentUser?.role]);

  const fetchMeta = useCallback(async () => {
    const [plansRes, coachesRes, activitiesRes] = await Promise.all([
      supabase.from("plans").select("id, name").order("name"),
      supabase
        .from("coaches")
        .select("id, profiles:profile_id(full_name, avatar_url)")
        .order("id"),
      supabase.from("class_types").select("id, name, color").order("name"),
    ]);

    if (!plansRes.error) setAllPlans(plansRes.data || []);
    if (!activitiesRes.error) setAllActivities(activitiesRes.data || []);

    if (!coachesRes.error) {
      setAllCoaches(
        (coachesRes.data || []).map((c) => ({
          id: c.id,
          name: c.profiles?.full_name || "Sin nombre",
          avatar: c.profiles?.avatar_url || null,
        })),
      );
    }
  }, []);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      // ── 1. Slots base con coaches y actividad ────────────────────────────
      const { data, error } = await supabase.from("plan_schedule_slots")
        .select(`
        id,
        plan_id,
        weekly_schedule_id,
        class_type_id,
        activity_detail,
        updated_at,
        plans:plan_id ( id, name ),
        weekly_schedule:weekly_schedule_id ( id, day_of_week, start_time, end_time, capacity ),
        class_types:class_type_id ( id, name, color ),
        plan_schedule_slot_coaches (
          coach_id,
          coaches:coach_id ( id, profiles:profile_id(full_name, avatar_url) )
        )
      `);

      if (error) throw error;

      // ── 2. Ocupación real usando el mismo servicio que PlanAvailabilityGridModal
      // La RPC plan_grid_availability devuelve los conteos POR plan (plan_assignments_count
      // = inscriptos de ESE plan en ese slot). Construimos un mapa keyed por
      // "planId|weeklyScheduleId" para mantener la ocupación separada por plan.
      let occupancyMap = new Map(); // key: `${planId}|${weeklyScheduleId}`
      try {
        const planIds = [...new Set((data || []).map((r) => r.plan_id).filter(Boolean))];

        const gridResults = await Promise.allSettled(
          planIds.map(async (pid) => {
            const rows = await fetchPlanGridAvailability(pid);
            return { pid, rows };
          })
        );

        gridResults.forEach((result) => {
          if (result.status !== "fulfilled") return;
          const { pid, rows } = result.value;
          if (!Array.isArray(rows)) return;
          rows.forEach((slot) => {
            if (!slot.weekly_schedule_id) return;
            const key = `${pid}|${slot.weekly_schedule_id}`;
            const capacity  = Math.max(0, Number(slot.capacity || 0));
            const occupied  = Math.max(0, Number(slot.plan_assignments_count ?? 0));
            const remaining = Math.max(0, Number(slot.remaining_total ?? (capacity - occupied)));
            occupancyMap.set(key, { occupied, remaining });
          });
        });
      } catch (occErr) {
        console.warn("No se pudo cargar ocupacion:", occErr);
      }

      const normalized = (data || [])
        .map((row) => {
          const ws = row.weekly_schedule || {};
          const plan = row.plans || {};
          const ct = row.class_types || null;

          const coaches = (row.plan_schedule_slot_coaches || [])
            .map((r) => ({
              id: r.coach_id,
              name: r.coaches?.profiles?.full_name || "Sin nombre",
              avatar: r.coaches?.profiles?.avatar_url || null,
            }))
            .filter((c) => Boolean(c.id));

          const capacity  = Number(ws?.capacity || 0);
          const occKey    = `${row.plan_id}|${row.weekly_schedule_id}`;
          const occ       = occupancyMap.get(occKey) ?? null;
          const occupied  = occ !== null ? occ.occupied  : null;
          const remaining = occ !== null ? occ.remaining : null;

          return {
            planScheduleSlotId: row.id,
            planId: row.plan_id,
            planName: plan?.name || "Plan",
            weeklyScheduleId: row.weekly_schedule_id,

            // Normalizar: si la DB guarda domingo como 0 (JS), convertir a 7 (convención grilla)
            dayOfWeek: Number(ws?.day_of_week) === 0 ? 7 : Number(ws?.day_of_week),
            startTime: ws?.start_time,
            endTime: ws?.end_time,
            capacity,

            activityId: row.class_type_id || null,
            activityName: ct?.name || null,
            activityColor: ct?.color || null,
            activityDetail: row.activity_detail || "",

            coaches,
            updatedAt: row.updated_at,

            // ── Ocupación ──────────────────────────────────────────────────
            occupied,    // null si no disponible
            remaining,   // null si no disponible
          };
        })
        .filter(
          // dayOfWeek puede ser 0 (domingo en convención JS) → no usar &&
          (s) => s.weeklyScheduleId && s.dayOfWeek != null && s.startTime && s.endTime,
        );

      normalized.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        if (normalizeTime(a.startTime) !== normalizeTime(b.startTime))
          return normalizeTime(a.startTime).localeCompare(
            normalizeTime(b.startTime),
          );
        return String(a.planName).localeCompare(String(b.planName));
      });

      setSlots(normalized);
    } catch (err) {
      console.error("Error cargando plan slots:", err);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await fetchIdentity();
    await fetchMeta();
    await fetchSlots();
  }, [fetchIdentity, fetchMeta, fetchSlots]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Re-evaluar identidad cuando el rol del usuario carga desde AuthContext
  // (el perfil puede llegar en background después del primer render)
  useEffect(() => {
    if (currentUser?.role) fetchIdentity();
  }, [currentUser?.role, fetchIdentity]);

  const filteredSlots = useMemo(() => {
    return (slots || []).filter((s) => {
      if (filterPlan !== "all" && String(s.planId) !== String(filterPlan))
        return false;

      if (
        filterActivity !== "all" &&
        String(s.activityId) !== String(filterActivity)
      )
        return false;

      if (filterCoach !== "all") {
        const has = (s.coaches || []).some(
          (c) => String(c.id) === String(filterCoach),
        );
        if (!has) return false;
      }

      if (viewMode === "coach") {
        if (!currentCoachId) return false;
        const hasSelf = (s.coaches || []).some(
          (c) => String(c.id) === String(currentCoachId),
        );
        if (!hasSelf) return false;
      }

      return true;
    });
  }, [
    slots,
    filterPlan,
    filterActivity,
    filterCoach,
    viewMode,
    currentCoachId,
  ]);

  const visiblePlanSlotsCount = filteredSlots.length;
  const distinctWeeklySlots = useMemo(() => {
    const set = new Set(filteredSlots.map((s) => s.weeklyScheduleId));
    return set.size;
  }, [filteredSlots]);

  const distinctWeeklyHours = useMemo(() => {
    const map = new Map();
    filteredSlots.forEach((s) => {
      if (!map.has(s.weeklyScheduleId)) {
        map.set(
          s.weeklyScheduleId,
          computeDurationMinutes(s.startTime, s.endTime),
        );
      }
    });
    const totalMinutes = Array.from(map.values()).reduce(
      (acc, m) => acc + (m || 0),
      0,
    );
    return Math.round((totalMinutes / 60) * 100) / 100;
  }, [filteredSlots]);

  const getSlotsForCell = useCallback(
    (dbDay, hourStr) => {
      const hourPrefix = hourStr.split(":")[0];
      return filteredSlots.filter(
        (s) =>
          Number(s.dayOfWeek) === Number(dbDay) &&
          String(s.startTime).startsWith(hourPrefix),
      );
    },
    [filteredSlots],
  );

  const handleOpenSlot = (slot) => setSelectedSlot(slot);

  const handleHowItWorks = () => {
    window.alert(
      [
        "Cómo funciona la planificación:",
        "",
        "• Esta grilla muestra los horarios habilitados por cada plan.",
        "• El Admin asigna profesores y (opcionalmente) define actividad + detalle.",
        "• Regla: un profesor no puede estar asignado a dos planes en el mismo horario.",
        "",
        "Tip: si ves muchos 'Pendiente', empeza por asignar profes (es lo mas critico).",
      ].join("\n"),
    );
  };

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const wEnd = addDays(wStart, 6);
      const mStart = startOfMonth(currentDate);
      const mEnd = endOfMonth(currentDate);

      const weekRes = await supabase.rpc("coach_planned_hours", {
        p_start: wStart.toISOString().slice(0, 10),
        p_end: wEnd.toISOString().slice(0, 10),
        p_grain: "week",
        p_coach_id: viewMode === "coach" ? currentCoachId : null,
      });

      const monthRes = await supabase.rpc("coach_planned_hours", {
        p_start: mStart.toISOString().slice(0, 10),
        p_end: mEnd.toISOString().slice(0, 10),
        p_grain: "month",
        p_coach_id: viewMode === "coach" ? currentCoachId : null,
      });

      const coachNameById = new Map(
        allCoaches.map((c) => [String(c.id), c.name]),
      );

      const summarize = (rows) => {
        const r = Array.isArray(rows) ? rows : [];
        const totalHours = r.reduce(
          (acc, x) => acc + Number(x.total_hours || 0),
          0,
        );
        const totalSlots = r.reduce(
          (acc, x) => acc + Number(x.slot_occurrences || 0),
          0,
        );

        let top = { name: "—", hours: 0 };
        r.forEach((x) => {
          const h = Number(x.total_hours || 0);
          if (h > top.hours) {
            top = {
              name: coachNameById.get(String(x.coach_id)) || "Coach",
              hours: h,
            };
          }
        });

        return {
          hours: Math.round(totalHours * 100) / 100,
          slots: totalSlots,
          topName: top.name,
          topHours: Math.round(top.hours * 100) / 100,
        };
      };

      setTeamWeek(summarize(weekRes.data));
      setTeamMonth(summarize(monthRes.data));
    } catch (e) {
      console.error("Error analytics:", e);
      setTeamWeek({ hours: 0, slots: 0, topName: "—", topHours: 0 });
      setTeamMonth({ hours: 0, slots: 0, topName: "—", topHours: 0 });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [currentDate, viewMode, currentCoachId, allCoaches]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const canToggleViewMode = isStaff && Boolean(currentCoachId);

  return (
    <>
      <Helmet>
        <title>Planificación - VC Fit</title>
      </Helmet>

      <div className="flex flex-col h-screen bg-[#F8FAFC] w-full overflow-hidden">
        {/* Header fijo */}
        <div className="bg-white border-b border-slate-200 z-30 flex-shrink-0 shadow-sm">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">

            {/* ── HEADER CARD (mismo patrón que payment-management) ── */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm px-6 py-4 mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <div className="hidden md:block scale-90 origin-left opacity-80 mb-1">
                  <BreadcrumbTrail
                    items={[
                      { label: "Gestión", path: "#" },
                      { label: "Planificación", active: true },
                    ]}
                  />
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                  Planificación
                </h1>
                <p className="text-[11px] md:text-xs text-slate-500 font-bold uppercase tracking-widest mt-1.5">
                  Asignación por plan y horario
                </p>
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto">
                {isStaff && (
                  <button
                    onClick={() => setShowActivityManager(true)}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-xs uppercase tracking-wider"
                  >
                    <Icon name="Settings" size={16} />
                    Actividades
                  </button>
                )}

                <button
                  onClick={handleHowItWorks}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all text-xs uppercase tracking-wider"
                >
                  <Icon name="Info" size={16} />
                  Cómo funciona
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="mt-4 bg-slate-50 p-2 rounded-2xl border border-slate-100 flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
              {/* Semana */}
              <div className="flex items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-full xl:w-auto justify-between">
                  <button
                    onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                    title="Semana anterior"
                  >
                    <Icon name="ChevronLeft" size={18} />
                  </button>

                  <div className="px-4 font-black text-xs min-w-[140px] text-center uppercase tracking-widest text-slate-700">
                    {format(weekStart, "MMM yyyy", { locale: es })}
                  </div>

                  <button
                    onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                    title="Semana siguiente"
                  >
                    <Icon name="ChevronRight" size={18} />
                  </button>
                </div>

                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-3 py-2 rounded-xl border border-blue-100"
                >
                  Hoy
                </button>

                <div className="hidden lg:flex items-center gap-3 pl-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl">
                    {visiblePlanSlotsCount} slots visibles
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl">
                    {distinctWeeklySlots} bloques · {distinctWeeklyHours}h
                  </span>
                </div>
              </div>

              {/* View mode + filtros */}
              <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto items-stretch sm:items-center">
                {/* Control de modo: solo para staff que además es profe */}
                {canToggleViewMode && (
                  <Segmented
                    value={viewMode}
                    onChange={(v) => {
                      setViewMode(v);
                      if (v === "coach") {
                        setFilterPlan("all");
                        setFilterCoach("all");
                      }
                    }}
                    options={[
                      { value: "global", label: "Global" },
                      { value: "coach", label: "Ver como profe" },
                    ]}
                  />
                )}

                {/* Filtros: solo visibles en modo global */}
                {viewMode === "global" && (
                  <>
                    <select
                      className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                      value={filterPlan}
                      onChange={(e) => setFilterPlan(e.target.value)}
                    >
                      <option value="all">Todos los planes</option>
                      {allPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                      value={filterActivity}
                      onChange={(e) => setFilterActivity(e.target.value)}
                    >
                      <option value="all">Todas las actividades</option>
                      {allActivities.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                      value={filterCoach}
                      onChange={(e) => setFilterCoach(e.target.value)}
                    >
                      <option value="all">Todos los profes</option>
                      {allCoaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setAnalyticsOpen((v) => !v)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest text-slate-700"
                    >
                      <Icon
                        name={analyticsOpen ? "ChevronUp" : "BarChart3"}
                        size={16}
                      />
                      Analítica
                    </button>
                  </>
                )}

                {/* Vista profe: solo filtro de actividad, sin filtro de profes ni analítica */}
                {viewMode === "coach" && (
                  <select
                    className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                    value={filterActivity}
                    onChange={(e) => setFilterActivity(e.target.value)}
                  >
                    <option value="all">Todas las actividades</option>
                    {allActivities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Analítica colapsable */}
            {analyticsOpen && (
              <div className="mt-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-black text-slate-900">
                      Horas planificadas
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      Semana {format(weekStart, "d MMM", { locale: es })} –{" "}
                      {format(addDays(weekStart, 6), "d MMM", { locale: es })} ·
                      Mes {format(currentDate, "MMMM yyyy", { locale: es })}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fetchAnalytics}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-xs font-black uppercase tracking-widest text-slate-700"
                    disabled={analyticsLoading}
                  >
                    <Icon
                      name={analyticsLoading ? "Loader" : "RefreshCcw"}
                      size={14}
                      className={analyticsLoading ? "animate-spin" : ""}
                    />
                    Actualizar
                  </button>
                </div>

                <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Semana
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
                      {teamWeek.hours.toFixed(2)}h
                    </p>
                    <p className="mt-1 text-xs text-slate-600 font-bold">
                      Slots: {teamWeek.slots}
                    </p>

                    {viewMode === "global" && (
                      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Top semana
                        </span>
                        <span className="text-xs font-black text-slate-800">
                          {teamWeek.topName} · {teamWeek.topHours.toFixed(2)}h
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Mes
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
                      {teamMonth.hours.toFixed(2)}h
                    </p>
                    <p className="mt-1 text-xs text-slate-600 font-bold">
                      Slots: {teamMonth.slots}
                    </p>

                    {viewMode === "global" && (
                      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Top mes
                        </span>
                        <span className="text-xs font-black text-slate-800">
                          {teamMonth.topName} · {teamMonth.topHours.toFixed(2)}h
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selector días mobile */}
          <div className="md:hidden bg-white border-t border-slate-100 p-2 overflow-x-auto no-scrollbar gap-1 shadow-sm relative z-20 flex">
            {weekDays.map((day, idx) => {
              const dbDay = idx + 1;
              const active = mobileDayView === dbDay;
              const today = isToday(day);

              return (
                <button
                  key={idx}
                  onClick={() => setMobileDayView(dbDay)}
                  className={`flex-1 py-2 px-1 flex flex-col items-center min-w-[55px] rounded-xl transition-all ${
                    active
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : today
                        ? "bg-blue-50 text-blue-600"
                        : "bg-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-blue-100" : ""}`}
                  >
                    {format(day, "EEE", { locale: es })}
                  </span>
                  <span className="text-lg font-black leading-tight">
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar scrollable */}
        <div className="flex-1 overflow-auto bg-white relative custom-scrollbar">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-full relative">
            {/* Línea AHORA */}
            {isSameDay(currentDate, new Date()) && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{
                  top: `${(getHours(new Date()) - TIME_START) * 120 + getMinutes(new Date()) * 2}px`,
                }}
              >
                <div className="w-16 flex justify-end pr-2">
                  <div className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                    {format(new Date(), "HH:mm")}
                  </div>
                </div>
                <div className="flex-1 border-t-2 border-rose-500 border-dashed opacity-50 relative">
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_0_4px_rgba(244,63,94,0.2)] animate-pulse"></div>
                </div>
              </div>
            )}

            {/* Header días desktop */}
            <div className="hidden md:grid sticky top-0 z-30 grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
              <div className="h-14 border-r border-slate-100 flex items-center justify-center">
                <Icon name="Clock" size={16} className="text-slate-400" />
              </div>

              {weekDays.map((day, i) => {
                const today = isToday(day);
                return (
                  <div
                    key={i}
                    className={`h-14 border-r border-slate-100 last:border-r-0 flex flex-col items-center justify-center ${
                      today ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${today ? "text-blue-600" : "text-slate-400"}`}
                    >
                      {format(day, "EEEE", { locale: es })}
                    </span>
                    <span
                      className={`text-base font-black leading-none mt-0.5 ${today ? "text-blue-700" : "text-slate-800"}`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div className="relative pb-10">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[64px_1fr] md:grid-cols-[64px_repeat(7,minmax(0,1fr))] min-h-[120px]"
                >
                  {/* Col hora */}
                  <div className="sticky left-0 z-20 bg-white border-r border-b border-dashed border-slate-100 flex justify-center items-start pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {hour}
                    </span>
                  </div>

                  {/* Celdas */}
                  {weekDays.map((day, dayIndex) => {
                    const dbDay = dayIndex + 1;
                    const isVisible = mobileDayView === dbDay;
                    const today = isToday(day);

                    const cellSlots = getSlotsForCell(dbDay, hour);

                    return (
                      <div
                        key={`${dbDay}-${hour}`}
                        className={`relative border-r border-b border-slate-100 border-dashed p-1.5 flex flex-col gap-1.5 ${
                          !isVisible ? "hidden md:flex" : "flex"
                        } ${today ? "bg-blue-50/10" : ""}`}
                      >
                        {/* Empty state */}
                        {!loading && cellSlots.length === 0 && (
                          <div className="flex-1 rounded-xl border border-dashed border-slate-100 flex items-center justify-center min-h-[100px]">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-200">
                              —
                            </span>
                          </div>
                        )}

                        {cellSlots.map((slot) => (
                          <PlanSlotCard
                            key={slot.planScheduleSlotId}
                            slot={slot}
                            onClick={handleOpenSlot}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal slot */}
      {selectedSlot && (
        <ClassSlotModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSuccess={async () => {
            await fetchSlots();
            await fetchAnalytics();
            setSelectedSlot(null);
          }}
          isStaff={isStaff}
          classTypes={allActivities}
          coaches={allCoaches}
        />
      )}

      {/* Modal actividades */}
      {showActivityManager && (
        <ActivityManagerModal onClose={() => setShowActivityManager(false)} />
      )}
    </>
  );
};

export default ClassSchedule;