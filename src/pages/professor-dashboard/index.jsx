import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { hoyLocal, formatearFecha } from '../../utils/formatters';

// UI Components
import Icon from '../../components/AppIcon';

// Sub-Sections (Widgets)
import MyAthletesSection from './components/MyAthletesSection';
import AttendanceTracker from './components/AttendanceTracker';
import QuickStats from './components/QuickStats';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const ProfessorDashboard = () => {
  const { currentUser } = useAuth();

  // UI State
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(hoyLocal());

  // Data State
  const [coachProfile, setCoachProfile] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [followedIds, setFollowedIds] = useState(new Set()); // atletas que este profe sigue
  const [dashboardData, setDashboardData] = useState({
    athletes: [],
    sessions: [],
    notes: [],
    myAttendance: { monthCount: 0, lastDate: null },
    stats: {
      totalAthletes: 0,
      todaySessions: 0,
      myCheckinsMonth: 0,
    },
  });

  // --- DATA FETCHING ---
  useEffect(() => {
    let isMounted = true;

    const loadCoachData = async () => {
      try {
        setLoading(true);
        if (!currentUser) return;

        // 1. IDENTIDAD
        const { data: coachData, error: coachError } = await supabase
          .from('coaches')
          .select('id, bio, specialization, profiles (full_name, avatar_url)')
          .eq('profile_id', currentUser.id)
          .single();

        if (coachError || !coachData) {
          console.error('Coach no encontrado:', coachError);
          setLoading(false);
          return;
        }

        if (isMounted) setCoachProfile(coachData);
        const realCoachId = coachData.id;
        const monthPrefix = hoyLocal().slice(0, 7); // YYYY-MM

        // 2. PARALLEL FETCH
        const [athletesRes, sessionsRes, notesRes, turnosRes, myLogsRes, followsRes] = await Promise.all([
          // A) ATLETAS — el profesor ve a TODOS los atletas activos del gimnasio.
          supabase
            .from('athletes')
            .select(`
              id, status, phone,
              profiles (full_name, email, avatar_url),
              plans (name)
            `)
            .eq('status', 'active'),

          // B) Sesiones (para "Gestión de Clases")
          supabase
            .from('sessions')
            .select(`
              id, session_date, time, status, type, location, capacity,
              attendees:session_attendees(count)
            `)
            .eq('coach_id', realCoachId)
            .order('session_date', { ascending: false })
            .limit(20),

          // C) Notas propias
          supabase
            .from('notes')
            .select('*')
            .eq('coach_id', realCoachId)
            .order('date', { ascending: false })
            .limit(5),

          // D) Mis turnos asignados (agenda semanal)
          supabase
            .from('plan_schedule_slot_coaches')
            .select('day_of_week, start_time, end_time, weekly_schedule:weekly_schedule_id ( capacity ), slot:plan_schedule_slot_id ( plans ( name ) )')
            .eq('coach_id', realCoachId),

          // E) Mi asistencia (mis fichajes en el kiosco)
          supabase
            .from('access_logs')
            .select('local_checkin_date')
            .eq('coach_id', realCoachId)
            .eq('access_granted', true)
            .order('local_checkin_date', { ascending: false })
            .limit(200),

          // F) Atletas que este profe sigue
          supabase
            .from('coach_athlete_follows')
            .select('athlete_id')
            .eq('coach_id', realCoachId),
        ]);

        // 3. PROCESAMIENTO
        const rawAthletes = athletesRes.data || [];
        const rawSessions = sessionsRes.data || [];
        const rawNotes = notesRes.data || [];
        const rawTurnos = (turnosRes.data || [])
          .map((t) => ({
            day_of_week: Number(t.day_of_week),
            start_time: String(t.start_time || '').slice(0, 5),
            end_time: String(t.end_time || '').slice(0, 5),
            capacity: t.weekly_schedule?.capacity ?? null,
            planName: t.slot?.plans?.name || 'Plan',
          }))
          .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

        // Mi asistencia (fichajes propios)
        const myLogs = myLogsRes.data || [];
        const myMonthCount = myLogs.filter((l) => String(l.local_checkin_date || '').startsWith(monthPrefix)).length;
        const myLastDate = myLogs[0]?.local_checkin_date || null;

        // Stats
        const todayStr = hoyLocal();
        const sessionsToday = rawSessions.filter((s) => s.session_date === todayStr);

        if (isMounted) {
          setDashboardData({
            athletes: rawAthletes.map((a) => {
              const profileObj = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
              const planObj = Array.isArray(a.plans) ? a.plans[0] : a.plans;
              return {
                id: a.id,
                name: profileObj?.full_name || 'Sin Nombre',
                email: profileObj?.email,
                avatar: profileObj?.avatar_url,
                planName: planObj?.name || 'Sin Plan',
                status: a.status,
                phone: a.phone,
              };
            }),
            sessions: rawSessions,
            notes: rawNotes,
            myAttendance: { monthCount: myMonthCount, lastDate: myLastDate },
            stats: {
              totalAthletes: rawAthletes.length,
              todaySessions: sessionsToday.length,
              myCheckinsMonth: myMonthCount,
            },
          });
          setTurnos(rawTurnos);
          setFollowedIds(new Set((followsRes.data || []).map((f) => f.athlete_id)));
        }
      } catch (err) {
        console.error('Error dashboard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCoachData();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Render Helpers
  const todaySessionsList = useMemo(
    () => dashboardData.sessions.filter((s) => s.session_date === selectedDate),
    [dashboardData.sessions, selectedDate]
  );

  const turnosByDay = useMemo(() => {
    const groups = {};
    turnos.forEach((t) => {
      (groups[t.day_of_week] = groups[t.day_of_week] || []).push(t);
    });
    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((d) => ({ day: DAY_NAMES[d], items: groups[d] }));
  }, [turnos]);

  const firstName = coachProfile?.profiles?.full_name?.split(' ')[0] || 'Coach';

  // Seguir / dejar de seguir un atleta (update optimista, persiste en coach_athlete_follows)
  const handleToggleFollow = async (athleteId, shouldFollow) => {
    const coachId = coachProfile?.id;
    if (!coachId) return;

    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (shouldFollow) next.add(athleteId);
      else next.delete(athleteId);
      return next;
    });

    try {
      if (shouldFollow) {
        const { error } = await supabase
          .from('coach_athlete_follows')
          .insert({ coach_id: coachId, athlete_id: athleteId });
        if (error && error.code !== '23505') throw error; // 23505 = ya lo seguía
      } else {
        const { error } = await supabase
          .from('coach_athlete_follows')
          .delete()
          .eq('coach_id', coachId)
          .eq('athlete_id', athleteId);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Error al actualizar seguimiento:', e);
      // Revertir en caso de error
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (shouldFollow) next.delete(athleteId);
        else next.add(athleteId);
        return next;
      });
    }
  };

  return (
    <>
      <Helmet><title>Panel del Entrenador | VC Fit</title></Helmet>

      <div className="flex flex-col lg:h-[calc(100vh-4rem)]">
        {/* HEADER compacto (una fila) */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {coachProfile?.profiles?.avatar_url ? (
              <img src={coachProfile.profiles.avatar_url} alt="Profile" className="w-11 h-11 rounded-full border-2 border-card shadow-sm object-cover flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-lg flex-shrink-0">
                {firstName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-text-primary tracking-tight truncate">Hola, {firstName}</h1>
              <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest truncate">
                {coachProfile?.specialization || 'Entrenador de Staff'}
              </p>
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <Icon name="Calendar" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-3 py-2 bg-card border border-border rounded-xl text-sm font-bold text-text-secondary shadow-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded-2xl"></div>)}
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            <div className="flex-shrink-0">
              <QuickStats stats={dashboardData.stats} />
            </div>

            {/* MAIN: en desktop ocupa el alto restante y cada columna scrollea por dentro */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
              {/* IZQUIERDA (8/12) — Mis Atletas, ocupa el alto y scrollea internamente */}
              <div className="lg:col-span-8 min-h-0 flex flex-col">
                <MyAthletesSection
                  athletes={dashboardData.athletes}
                  followedIds={followedIds}
                  onToggleFollow={handleToggleFollow}
                />
              </div>

              {/* DERECHA (4/12) — rail con scroll interno */}
              <div className="lg:col-span-4 min-h-0 flex flex-col">
                <div className="flex-1 lg:overflow-y-auto custom-scrollbar space-y-4 lg:pr-1">
                  {/* MI ASISTENCIA */}
                  <div className="bg-card rounded-3xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="UserCheck" className="text-primary" size={20} />
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Mi Asistencia</h3>
                    </div>
                    <div className="flex items-end gap-2">
                      <p className="text-4xl font-black text-text-primary tracking-tighter leading-none">
                        {dashboardData.myAttendance.monthCount}
                      </p>
                      <p className="text-[11px] font-bold text-text-tertiary uppercase mb-1">fichajes<br />este mes</p>
                    </div>
                    <p className="text-xs text-text-tertiary mt-3">
                      {dashboardData.myAttendance.lastDate
                        ? `Última vez: ${formatearFecha(dashboardData.myAttendance.lastDate)}`
                        : 'Todavía no fichaste. Ingresá tu DNI en el kiosco al llegar.'}
                    </p>
                  </div>

                  {/* MIS TURNOS */}
                  <div className="bg-card rounded-3xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Icon name="CalendarClock" className="text-primary" size={20} />
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Mis Turnos</h3>
                    </div>
                    {turnos.length === 0 ? (
                      <p className="text-sm text-text-tertiary">
                        Todavía no tenés turnos asignados. El administrador los asigna desde Planificación.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {turnosByDay.map((g) => (
                          <div key={g.day} className="rounded-2xl border border-border bg-muted/60 p-3">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-text-secondary mb-2">{g.day}</h4>
                            <div className="space-y-2">
                              {g.items.map((t, i) => (
                                <div key={i} className="flex items-center justify-between bg-card rounded-xl border border-border px-3 py-2">
                                  <div>
                                    <p className="text-sm font-bold text-text-primary">{t.start_time} - {t.end_time}</p>
                                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wide">{t.planName}</p>
                                  </div>
                                  {t.capacity != null && (
                                    <span className="text-[10px] font-black text-success bg-success-light px-2 py-1 rounded-lg uppercase">Cupo {t.capacity}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* GESTIÓN DE CLASES */}
                  <div className="bg-card rounded-3xl border border-border shadow-sm p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                        <Icon name="CheckSquare" className="text-primary" size={20} />
                        Gestión de Clases
                      </h3>
                      <span className="text-[10px] font-bold bg-info-light text-primary px-2.5 py-1 rounded-full uppercase tracking-wide">
                        {todaySessionsList.length} hoy
                      </span>
                    </div>
                    <AttendanceTracker sessions={todaySessionsList} selectedDate={selectedDate} />
                  </div>

                  {/* NOTAS DEL COACH */}
                  <div className="bg-[#0F172A] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <h3 className="font-bold uppercase tracking-widest text-sm text-white">Notas del Coach</h3>
                    </div>
                    <div className="space-y-3 relative z-10">
                      {dashboardData.notes?.length > 0 ? (
                        dashboardData.notes.map((n) => (
                          <div key={n.id} className="p-3 bg-white/5 rounded-xl text-xs text-slate-300 border border-white/5">
                            {n.content}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic">No hay notas recientes.</p>
                      )}
                      <p className="text-[10px] text-slate-500 pt-1">
                        Cargá notas desde el perfil de cada atleta (pestaña “Notas”).
                      </p>
                    </div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500 rounded-full blur-[60px] opacity-20 -mr-10 -mb-10"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProfessorDashboard;
