import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// UI Components
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';

// Sub-Sections
import MyPlansSection from './components/MyPlansSection';
import MyAthletesSection from './components/MyAthletesSection';
import AttendanceTracker from './components/AttendanceTracker';
import QuickStats from './components/QuickStats';

// Analytics reuse
import PerformanceEvolutionChart from '../performance-analytics/components/PerformanceEvolutionChart';

const ProfessorDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // UI State
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Data State
  const [dashboardData, setDashboardData] = useState({
    plans: [],
    athletes: [],
    sessions: [],
    notes: [],
    stats: {
      totalAthletes: 0,
      totalPlans: 0,
      completedSessions: 0,
      avgAttendance: 0
    }
  });

  const professorName = currentUser?.name || 'Entrenador';
  const coachId = currentUser?.coachId || currentUser?.id;

  // --- DATA FETCHING OPTIMIZED ---
  useEffect(() => {
    const loadData = async () => {
      // Si no hay coachId aún, esperamos (el auth context puede tardar unos ms)
      if (!coachId) return;
      
      setLoading(true);

      try {
        // 1. Cargar Datos Principales en Paralelo
        const [plansRes, athletesRes, sessionsRes, notesRes] = await Promise.all([
          
          // A) CORRECCIÓN AQUÍ: Quitamos 'enrolled' y pedimos la relación enrollments(count)
          supabase.from('plans')
            .select('id, name, status, capacity, enrollments(count)')
            .eq('status', 'active'), 

          // B) Atletas del Coach
          supabase.from('athletes')
            .select('id, status, profiles:profile_id(full_name, email, avatar_url)')
            .eq('coach_id', coachId),

          // C) Sesiones
          supabase.from('sessions')
            .select('id, session_date, time, status, type, location')
            .eq('coach_id', coachId)
            .order('session_date', { ascending: false }),

          // D) Notas Recientes
          supabase.from('notes')
            .select('*')
            .eq('coach_id', coachId)
            .order('date', { ascending: false })
            .limit(5)
        ]);

        if (plansRes.error) throw plansRes.error;
        if (athletesRes.error) throw athletesRes.error;
        if (sessionsRes.error) throw sessionsRes.error;

        // 2. Procesar Datos
        const athletesList = athletesRes.data || [];
        const sessionsList = sessionsRes.data || [];
        
        // Mapeo de Planes (Ajuste para leer el conteo)
        const mappedPlans = (plansRes.data || []).map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          capacity: p.capacity,
          description: 'Plan activo', // Default si no lo trajimos
          // Supabase devuelve enrollments como [{count: 5}] o []
          enrolled: p.enrollments?.[0]?.count || 0 
        }));

        setDashboardData({
          plans: mappedPlans,
          athletes: athletesList.map(a => ({
            id: a.id,
            name: a.profiles?.full_name || 'Sin Nombre',
            email: a.profiles?.email,
            avatar: a.profiles?.avatar_url,
            status: a.status
          })),
          sessions: sessionsList,
          notes: notesRes.data || [],
          stats: {
            totalAthletes: athletesList.length,
            totalPlans: mappedPlans.length,
            completedSessions: sessionsList.filter(s => s.status === 'completed').length,
            avgAttendance: 85 // Dato simulado o calculado si trajéramos attendance
          }
        });

      } catch (error) {
        console.error("Error cargando dashboard profesor:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [coachId]);

  // --- DERIVED DATA ---
  const todaySessions = useMemo(() => {
    return dashboardData.sessions.filter(s => s.session_date === selectedDate);
  }, [dashboardData.sessions, selectedDate]);

  // --- TABS CONFIG ---
  const tabs = [
    { id: 'overview', label: 'Resumen', icon: 'LayoutDashboard' },
    { id: 'plans', label: 'Mis Planes', icon: 'Package' },
    { id: 'athletes', label: 'Mis Atletas', icon: 'Users' },
    { id: 'attendance', label: 'Asistencia', icon: 'Calendar' }
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard Profesor - DigitalMatch</title>
      </Helmet>
      
      <div className="p-4 md:p-6 lg:p-8 w-full">
        <BreadcrumbTrail items={[{ label: 'Dashboard', path: '/professor-dashboard', active: true }]} />
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Hola, {professorName}
            </h1>
            <p className="text-muted-foreground">
              Aquí tienes el resumen de tu actividad hoy.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 px-4 bg-input border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary transition-smooth"
            />
            <Button
              variant="default"
              iconName="Plus"
              onClick={() => navigate('/performance-analytics')}
            >
              Nueva Nota
            </Button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-smooth border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon name={tab.icon} size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* 1. KPIs */}
                <QuickStats
                  totalAthletes={dashboardData.stats.totalAthletes}
                  totalPlans={dashboardData.stats.totalPlans}
                  completedSessions={dashboardData.stats.completedSessions}
                  avgAttendance={dashboardData.stats.avgAttendance}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 2. Sesiones de Hoy */}
                  <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-heading font-semibold text-foreground">
                        Sesiones para Hoy ({todaySessions.length})
                      </h3>
                      <Icon name="Calendar" size={20} color="var(--color-primary)" />
                    </div>
                    
                    {todaySessions.length > 0 ? (
                      <div className="space-y-3">
                        {todaySessions.map((session) => (
                          <div key={session.id} className="p-4 bg-muted/30 rounded-lg border border-border/50 flex justify-between items-center hover:bg-muted/50 transition-smooth">
                            <div>
                              <p className="font-medium text-foreground">{session.type || 'Entrenamiento'}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Icon name="Clock" size={14} className="text-muted-foreground"/>
                                <span className="text-sm text-muted-foreground">{session.time?.slice(0,5)}</span>
                                {session.location && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm text-muted-foreground">{session.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              session.status === 'completed' ? 'bg-success/10 text-success' : 
                              session.status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                            }`}>
                              {session.status === 'scheduled' ? 'Programada' : session.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Icon name="Coffee" size={48} className="mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No tienes sesiones hoy. ¡Disfruta tu día!</p>
                      </div>
                    )}
                  </div>

                  {/* 3. Notas Recientes */}
                  <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-heading font-semibold text-foreground">Notas Rápidas</h3>
                      <Button variant="ghost" size="sm" iconName="Plus" />
                    </div>
                    <div className="space-y-3">
                      {dashboardData.notes.length > 0 ? (
                        dashboardData.notes.map((note) => (
                          <div key={note.id} className="p-3 bg-muted/30 rounded-lg text-sm">
                            <p className="text-foreground line-clamp-2">{note.content}</p>
                            <p className="text-xs text-muted-foreground mt-2 text-right">
                              {new Date(note.date).toLocaleDateString()}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No hay notas recientes.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Gráfico Evolución */}
                <div className="mt-8">
                  <h3 className="text-lg font-heading font-semibold text-foreground mb-4">Tendencias de Rendimiento</h3>
                  <PerformanceEvolutionChart /> 
                </div>
              </div>
            )}

            {activeTab === 'plans' && (
              <MyPlansSection plans={dashboardData.plans} />
            )}

            {activeTab === 'athletes' && (
              <MyAthletesSection
                athletes={dashboardData.athletes}
                athleteIds={dashboardData.athletes.map(a => a.id)}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceTracker sessions={dashboardData.sessions} selectedDate={selectedDate} />
            )}
          </>
        )}
      </div>
    </>
  );
};

// Componente Skeleton Interno
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted/30 rounded-xl"></div>)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-64 bg-muted/30 rounded-xl"></div>
      <div className="h-64 bg-muted/30 rounded-xl"></div>
    </div>
  </div>
);

export default ProfessorDashboard;