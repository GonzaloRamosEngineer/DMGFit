import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { hoyLocal } from '../../utils/formatters';

// UI Components
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

// Sub-Sections (Widgets)
import MyPlansSection from './components/MyPlansSection';
import MyAthletesSection from './components/MyAthletesSection';
import AttendanceTracker from './components/AttendanceTracker';
import QuickStats from './components/QuickStats';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const ProfessorDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(hoyLocal());

  // Data State
  const [coachProfile, setCoachProfile] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    plans: [],
    athletes: [],
    sessions: [],
    notes: [],
    stats: {
      totalAthletes: 0,
      activePlans: 0,
      todaySessions: 0,
      completionRate: 0
    }
  });

  // --- DATA FETCHING (CORREGIDO) ---
  useEffect(() => {
    let isMounted = true;

    const loadCoachData = async () => {
      try {
        setLoading(true);
        if (!currentUser) return;

        // 1. IDENTIDAD
        // Nota: Aquí también simplificamos la query de profiles
        const { data: coachData, error: coachError } = await supabase
          .from('coaches')
          .select('id, bio, specialization, profiles (full_name, avatar_url)')
          .eq('profile_id', currentUser.id)
          .single();

        if (coachError || !coachData) {
          console.error("Coach no encontrado:", coachError);
          setLoading(false);
          return;
        }

        if (isMounted) setCoachProfile(coachData);
        const realCoachId = coachData.id;

        // 2. PARALLEL FETCH
        const [plansRes, athletesRes, sessionsRes, notesRes, turnosRes] = await Promise.all([

          // A) Planes
          supabase
            .from('plan_coaches')
            .select('plan_id, plans ( id, name, status, capacity, price, description )')
            .eq('coach_id', realCoachId),

          // B) ATLETAS (AQUÍ ESTABA EL PROBLEMA)
          // Quitamos los alias complejos "profiles:profile_id" y usamos directo "profiles" y "plans"
          supabase
            .from('athletes')
            .select(`
              id, status, phone,
              profiles (full_name, email, avatar_url), 
              plans (name)
            `)
            .eq('coach_id', realCoachId)
            .eq('status', 'active'),

          // C) Sesiones
          supabase
            .from('sessions')
            .select(`
              id, session_date, time, status, type, location, capacity,
              attendees:session_attendees(count)
            `)
            .eq('coach_id', realCoachId)
            .order('session_date', { ascending: false })
            .limit(20),

          // D) Notas
          supabase
            .from('notes')
            .select('*')
            .eq('coach_id', realCoachId)
            .order('date', { ascending: false })
            .limit(5),

          // E) Mis turnos asignados (agenda semanal)
          supabase
            .from('plan_schedule_slot_coaches')
            .select('day_of_week, start_time, end_time, weekly_schedule:weekly_schedule_id ( capacity ), slot:plan_schedule_slot_id ( plans ( name ) )')
            .eq('coach_id', realCoachId)
        ]);

        // 3. PROCESAMIENTO
        const rawPlans = plansRes.data?.map(pc => pc.plans).filter(Boolean) || [];
        const rawAthletes = athletesRes.data || [];
        
        // --- LOG DE DEPURACIÓN (MIRA ESTO EN LA CONSOLA F12) ---
        // console.log("Atletas Crudos recuperados:", rawAthletes); 
        // -------------------------------------------------------

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

        // Stats
        const todayStr = hoyLocal();
        const sessionsToday = rawSessions.filter(s => s.session_date === todayStr);
        const completed = rawSessions.filter(s => s.status === 'completed').length;
        const rate = rawSessions.length > 0 ? Math.round((completed / rawSessions.length) * 100) : 0;

        if (isMounted) {
          setDashboardData({
            plans: rawPlans,
            
            // MAPEO ROBUSTO
            athletes: rawAthletes.map(a => {
              // Ahora que simplificamos la query, 'profiles' debería venir directo.
              // Aún así, mantenemos la defensa Array vs Object por seguridad.
              const profileObj = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
              const planObj = Array.isArray(a.plans) ? a.plans[0] : a.plans;

              return {
                id: a.id,
                // Usamos el objeto extraído
                name: profileObj?.full_name || 'Sin Nombre (Revisar DB)',
                email: profileObj?.email,
                avatar: profileObj?.avatar_url,
                planName: planObj?.name || 'Sin Plan',
                status: a.status,
                phone: a.phone
              };
            }),

            sessions: rawSessions,
            notes: rawNotes,
            stats: {
              totalAthletes: rawAthletes.length,
              activePlans: rawPlans.length,
              todaySessions: sessionsToday.length,
              completionRate: rate
            }
          });
          setTurnos(rawTurnos);
        }

      } catch (err) {
        console.error("Error dashboard:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCoachData();
    return () => { isMounted = false; };
  }, [currentUser]);

  // Render Helpers
  const todaySessionsList = useMemo(() =>
    dashboardData.sessions.filter(s => s.session_date === selectedDate),
  [dashboardData.sessions, selectedDate]);

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

  return (
    <>
      <Helmet><title>Panel del Entrenador | DMG Fitness</title></Helmet>
      
      <div className="min-h-screen bg-background py-6 md:py-8 pb-24">
        <BreadcrumbTrail items={[{ label: 'Portal Staff', path: '/professor-dashboard', active: true }]} />
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 mt-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
               {coachProfile?.profiles?.avatar_url ? (
                 <img src={coachProfile.profiles.avatar_url} alt="Profile" className="w-12 h-12 rounded-full border-2 border-card shadow-sm object-cover" />
               ) : (
                 <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-lg">
                    {coachProfile?.profiles?.full_name?.charAt(0) || 'C'}
                 </div>
               )}
               <div>
                 <h1 className="text-3xl font-black text-text-primary tracking-tight">
                   Hola, {coachProfile?.profiles?.full_name?.split(' ')[0] || 'Coach'}
                 </h1>
                 <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
                   {coachProfile?.specialization || 'Entrenador de Staff'}
                 </p>
               </div>
            </div>
          </div>

          <div className="flex gap-3">
             <div className="relative">
                <Icon name="Calendar" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm font-bold text-text-secondary shadow-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                />
             </div>
             <button
               onClick={() => navigate('/performance-analytics')}
               className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/90 shadow-lg transition-all text-xs uppercase tracking-wider"
             >
                <Icon name="BarChart2" size={16} /> Analytics
             </button>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-2xl"></div>)}
           </div>
        ) : (
          <div className="space-y-8">
            
            <QuickStats stats={dashboardData.stats} />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
               {/* COLUMNA IZQUIERDA (8/12) */}
               <div className="xl:col-span-8 space-y-8">

                  {/* MIS TURNOS DE LA SEMANA */}
                  <div className="bg-card rounded-3xl border border-border shadow-sm p-8">
                     <div className="flex items-center gap-2 mb-6">
                        <Icon name="CalendarClock" className="text-primary" />
                        <h3 className="text-xl font-black text-text-primary">Mis Turnos de la Semana</h3>
                     </div>
                     {turnos.length === 0 ? (
                        <p className="text-sm text-text-tertiary">
                           Todavía no tenés turnos asignados. El administrador los asigna desde Planificación.
                        </p>
                     ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           {turnosByDay.map((g) => (
                              <div key={g.day} className="rounded-2xl border border-border bg-muted/60 p-4">
                                 <h4 className="text-xs font-black uppercase tracking-widest text-text-secondary mb-3">{g.day}</h4>
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

                  <div className="bg-card rounded-3xl border border-border shadow-sm p-8 relative overflow-hidden">
                     <div className="flex justify-between items-center mb-6 relative z-10">
                        <h3 className="text-xl font-black text-text-primary flex items-center gap-2">
                           <Icon name="CheckSquare" className="text-primary" />
                           Gestión de Clases
                        </h3>
                        <span className="text-xs font-bold bg-info-light text-primary px-3 py-1 rounded-full uppercase tracking-wide">
                           {todaySessionsList.length} Sesiones Hoy
                        </span>
                     </div>
                     <div className="relative z-10">
                        <AttendanceTracker sessions={todaySessionsList} selectedDate={selectedDate} />
                     </div>
                     <div className="absolute top-0 right-0 w-64 h-64 bg-info-light rounded-full blur-[80px] opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
                  </div>

                  <MyAthletesSection athletes={dashboardData.athletes} />
               </div>

               {/* COLUMNA DERECHA (4/12) */}
               <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-6">
                  <MyPlansSection plans={dashboardData.plans} />

                  <div className="bg-[#0F172A] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                     <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="font-bold uppercase tracking-widest text-sm text-white">Notas del Coach</h3>
                        <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                           <Icon name="Plus" size={16} />
                        </button>
                     </div>
                     <div className="space-y-3 relative z-10">
                        {dashboardData.notes?.length > 0 ? dashboardData.notes.map(n => (
                           <div key={n.id} className="p-3 bg-white/5 rounded-xl text-xs text-slate-300 border border-white/5">
                              {n.content}
                           </div>
                        )) : (
                           <p className="text-xs text-slate-500 italic">No hay notas recientes.</p>
                        )}
                     </div>
                     <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500 rounded-full blur-[60px] opacity-20 -mr-10 -mb-10"></div>
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
