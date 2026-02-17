import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// UI Components
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

// Sub-Sections (Widgets)
import MyPlansSection from './components/MyPlansSection';
import MyAthletesSection from './components/MyAthletesSection';
import AttendanceTracker from './components/AttendanceTracker';
import QuickStats from './components/QuickStats';

const ProfessorDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Data State
  const [coachProfile, setCoachProfile] = useState(null);
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
        const [plansRes, athletesRes, sessionsRes, notesRes] = await Promise.all([
          
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
            .limit(5)
        ]);

        // 3. PROCESAMIENTO
        const rawPlans = plansRes.data?.map(pc => pc.plans).filter(Boolean) || [];
        const rawAthletes = athletesRes.data || [];
        
        // --- LOG DE DEPURACIÓN (MIRA ESTO EN LA CONSOLA F12) ---
        // console.log("Atletas Crudos recuperados:", rawAthletes); 
        // -------------------------------------------------------

        const rawSessions = sessionsRes.data || [];
        const rawNotes = notesRes.data || [];

        // Stats
        const todayStr = new Date().toISOString().split('T')[0];
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

  return (
    <>
      <Helmet><title>Panel del Entrenador | DMG Fitness</title></Helmet>
      
      <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 pb-24">
        <BreadcrumbTrail items={[{ label: 'Portal Staff', path: '/professor-dashboard', active: true }]} />
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 mt-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
               {coachProfile?.profiles?.avatar_url ? (
                 <img src={coachProfile.profiles.avatar_url} alt="Profile" className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover" />
               ) : (
                 <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                    {coachProfile?.profiles?.full_name?.charAt(0) || 'C'}
                 </div>
               )}
               <div>
                 <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                   Hola, {coachProfile?.profiles?.full_name?.split(' ')[0] || 'Coach'}
                 </h1>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                   {coachProfile?.specialization || 'Entrenador de Staff'}
                 </p>
               </div>
            </div>
          </div>

          <div className="flex gap-3">
             <div className="relative">
                <Icon name="Calendar" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
             </div>
             <button 
               onClick={() => navigate('/performance-analytics')}
               className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all text-xs uppercase tracking-wider"
             >
                <Icon name="BarChart2" size={16} /> Analytics
             </button>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
           </div>
        ) : (
          <div className="space-y-8">
            
            <QuickStats stats={dashboardData.stats} />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
               {/* COLUMNA IZQUIERDA (8/12) */}
               <div className="xl:col-span-8 space-y-8">
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 relative overflow-hidden">
                     <div className="flex justify-between items-center mb-6 relative z-10">
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                           <Icon name="CheckSquare" className="text-blue-600" />
                           Gestión de Clases
                        </h3>
                        <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full uppercase tracking-wide">
                           {todaySessionsList.length} Sesiones Hoy
                        </span>
                     </div>
                     <div className="relative z-10">
                        <AttendanceTracker sessions={todaySessionsList} selectedDate={selectedDate} />
                     </div>
                     <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-[80px] opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
                  </div>

                  <MyAthletesSection athletes={dashboardData.athletes} />
               </div>

               {/* COLUMNA DERECHA (4/12) */}
               <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-6">
                  <MyPlansSection plans={dashboardData.plans} />

                  <div className="bg-[#0F172A] text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
                     <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="font-bold uppercase tracking-widest text-sm">Notas del Coach</h3>
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