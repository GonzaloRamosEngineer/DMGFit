import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { fetchPlansByCoach } from '../../services/plans';
import { fetchAthletesByCoach } from '../../services/athletes';
import { fetchSessionsByCoach } from '../../services/sessions';
import MyPlansSection from './components/MyPlansSection';
import MyAthletesSection from './components/MyAthletesSection';
import AttendanceTracker from './components/AttendanceTracker';
import QuickStats from './components/QuickStats';
import PerformanceEvolutionChart from '../performance-analytics/components/PerformanceEvolutionChart';

const ProfessorDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState(new Date()?.toISOString()?.split('T')?.[0]);
  const [plans, setPlans] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [athleteRoutines, setAthleteRoutines] = useState([]);
  const [workoutResults, setWorkoutResults] = useState([]);
  const [routineFilter, setRoutineFilter] = useState('all');
  const [trackingFilter, setTrackingFilter] = useState('all');

  const professorName = currentUser?.name || 'Ana García';
  const coachId = currentUser?.coach_id || currentUser?.coachId || currentUser?.id;

  useEffect(() => {
    let isMounted = true;

    const loadProfessorData = async () => {
      if (!coachId) {
        return;
      }

      try {
        const [plansData, athletesData, sessionsData] = await Promise.all([
          fetchPlansByCoach(coachId),
          fetchAthletesByCoach(coachId),
          fetchSessionsByCoach(coachId)
        ]);

        const sessionIds = sessionsData?.map((session) => session?.id).filter(Boolean) || [];
        let attendanceData = [];

        if (sessionIds?.length > 0) {
          const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .in('session_id', sessionIds);

          if (error) {
            throw error;
          }

          attendanceData = data ?? [];
        }

        const { data: notesData, error: notesError } = await supabase
          .from('notes')
          .select('*')
          .eq('coach_id', coachId)
          .order('date', { ascending: false });

        if (notesError) {
          throw notesError;
        }

        const { data: routinesData, error: routinesError } = await supabase
          .from('routines')
          .select('*')
          .eq('coach_id', coachId)
          .order('created_at', { ascending: false });

        if (routinesError) {
          throw routinesError;
        }

        const athleteIds = athletesData?.map((athlete) => athlete?.id).filter(Boolean) ?? [];
        let athleteRoutinesData = [];
        let workoutResultsData = [];

        if (athleteIds?.length) {
          const { data: athleteRoutinesResponse, error: athleteRoutinesError } = await supabase
            .from('athlete_routines')
            .select('*')
            .in('athlete_id', athleteIds);

          if (athleteRoutinesError) {
            throw athleteRoutinesError;
          }

          athleteRoutinesData = athleteRoutinesResponse ?? [];

          const { data: workoutResultsResponse, error: workoutResultsError } = await supabase
            .from('workout_results')
            .select('*')
            .in('athlete_id', athleteIds);

          if (workoutResultsError) {
            throw workoutResultsError;
          }

          workoutResultsData = workoutResultsResponse ?? [];
        }

        const attendanceByAthlete = (attendanceData ?? []).reduce((acc, record) => {
          const athleteId = record?.athlete_id;
          if (!athleteId) {
            return acc;
          }
          acc[athleteId] = acc[athleteId] || [];
          acc[athleteId].push(record);
          return acc;
        }, {});

        const enrichedAthletes = (athletesData ?? []).map((athlete) => {
          const athleteAttendance = attendanceByAthlete?.[athlete?.id] ?? [];
          const presentCount = athleteAttendance?.filter((record) => record?.status === 'present')?.length || 0;
          const attendanceRate = athleteAttendance?.length
            ? Math.round((presentCount / athleteAttendance.length) * 100)
            : 0;
          return {
            ...athlete,
            attendanceRate
          };
        });

        if (!isMounted) {
          return;
        }

        setPlans(plansData ?? []);
        setAthletes(enrichedAthletes ?? []);
        setSessions(sessionsData ?? []);
        setAttendance(attendanceData ?? []);
        setNotes(notesData ?? []);
        setRoutines(routinesData ?? []);
        setAthleteRoutines(athleteRoutinesData ?? []);
        setWorkoutResults(workoutResultsData ?? []);
      } catch (error) {
        console.error('Error loading professor dashboard data', error);
      }
    };

    loadProfessorData();

    return () => {
      isMounted = false;
    };
  }, [coachId]);

  const myPlans = plans;
  const myAthletes = athletes;
  const myAthleteIds = myAthletes?.map((athlete) => athlete?.id) ?? [];
  const mySessions = sessions;
  const myNotes = notes;

  const todaySessions = mySessions?.filter(s => s?.date === selectedDate);
  const totalAthletes = myAthleteIds?.length || 0;
  const completedSessions = mySessions?.filter(s => s?.status === 'completed')?.length || 0;
  const avgAttendance = Math.round(
    (attendance?.filter(a => a?.status === 'present')?.length / Math.max(attendance?.length, 1)) * 100
  );

  const athleteRoutinesByAthlete = useMemo(() => {
    return (athleteRoutines ?? []).reduce((acc, record) => {
      const athleteId = record?.athlete_id;
      const routineId = record?.routine_id;
      if (!athleteId || !routineId) {
        return acc;
      }
      acc[athleteId] = acc[athleteId] || new Set();
      acc[athleteId].add(routineId);
      return acc;
    }, {});
  }, [athleteRoutines]);

  const workoutResultsByAthlete = useMemo(() => {
    return (workoutResults ?? []).reduce((acc, result) => {
      const athleteId = result?.athlete_id;
      if (!athleteId) {
        return acc;
      }
      acc[athleteId] = acc[athleteId] || [];
      acc[athleteId].push(result);
      return acc;
    }, {});
  }, [workoutResults]);

  const filteredAthletes = useMemo(() => {
    const now = new Date();
    return (myAthletes ?? []).filter((athlete) => {
      const athleteId = athlete?.id;
      const routinesForAthlete = athleteRoutinesByAthlete?.[athleteId];
      const matchesRoutine =
        routineFilter === 'all' || (routinesForAthlete && routinesForAthlete.has(routineFilter));

      if (!matchesRoutine) {
        return false;
      }

      if (trackingFilter === 'all') {
        return true;
      }

      const athleteResults = workoutResultsByAthlete?.[athleteId] ?? [];
      const lastResultDate = athleteResults
        .map((result) => new Date(result?.recorded_at || result?.created_at || result?.date))
        .filter((date) => !Number.isNaN(date?.getTime()))
        .sort((a, b) => b - a)[0];

      if (trackingFilter === 'no-results') {
        return !lastResultDate;
      }

      if (!lastResultDate) {
        return false;
      }

      const diffDays = Math.ceil((now - lastResultDate) / (1000 * 60 * 60 * 24));

      if (trackingFilter === 'recent') {
        return diffDays <= 14;
      }

      if (trackingFilter === 'stale') {
        return diffDays > 14;
      }

      return true;
    });
  }, [myAthletes, athleteRoutinesByAthlete, routineFilter, trackingFilter, workoutResultsByAthlete]);

  const evolutionChartData = useMemo(() => {
    const eligibleAthleteIds = filteredAthletes?.map((athlete) => String(athlete?.id)) ?? [];
    const selectedRoutineId = routineFilter !== 'all' ? routineFilter : null;
    const filteredResults = (workoutResults ?? []).filter((result) => {
      if (!eligibleAthleteIds.includes(String(result?.athlete_id))) {
        return false;
      }
      if (!selectedRoutineId) {
        return true;
      }
      return (
        result?.routine_id === selectedRoutineId ||
        result?.routineId === selectedRoutineId ||
        result?.routine === selectedRoutineId
      );
    });

    const grouped = filteredResults.reduce((acc, result) => {
      const date = new Date(result?.recorded_at || result?.created_at || result?.date);
      if (Number.isNaN(date?.getTime())) {
        return acc;
      }
      const monthKey = date?.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      const sortKey = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const athleteId = String(result?.athlete_id);
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, sortKey };
      }
      if (!acc[monthKey][athleteId]) {
        acc[monthKey][athleteId] = [];
      }
      const value = Number(result?.value ?? result?.score ?? result?.metric_value ?? result?.result ?? result?.performance);
      if (Number.isFinite(value)) {
        acc[monthKey][athleteId].push(value);
      }
      return acc;
    }, {});

    return Object.values(grouped)
      .map((entry) => {
        const dataPoint = { month: entry.month, sortKey: entry.sortKey };
        eligibleAthleteIds?.forEach((athleteId) => {
          const values = entry?.[athleteId] || [];
          if (values?.length) {
            dataPoint[athleteId] = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
          }
        });
        return dataPoint;
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...entry }) => entry);
  }, [filteredAthletes, routineFilter, workoutResults]);

  const evolutionAthletes = useMemo(() => {
    const palette = ['#FF4444', '#FFD700', '#00D4FF', '#30D158', '#BF5AF2', '#FF9F0A'];
    return (filteredAthletes ?? []).slice(0, 4).map((athlete, index) => ({
      id: String(athlete?.id),
      name: athlete?.name,
      dataKey: String(athlete?.id),
      color: palette[index % palette.length]
    }));
  }, [filteredAthletes]);

  const alertData = {
    dashboard: 2,
    atletas: 3,
    rendimiento: 1,
    pagos: 0
  };

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/professor-dashboard', active: true }
  ];

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
      <div className="flex min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          alertData={alertData}
        />
        <div className={`flex-1 transition-smooth ${sidebarCollapsed ? 'ml-20' : 'ml-60'}`}>
          <div className="p-6 lg:p-8">
            <BreadcrumbTrail items={breadcrumbItems} />
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                  Dashboard del Profesor
                </h1>
                <p className="text-muted-foreground">
                  Bienvenido, {professorName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e?.target?.value)}
                  className="h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                />
                <Button
                  variant="default"
                  size="md"
                  iconName="Plus"
                  onClick={() => navigate('/performance-analytics')}
                >
                  Nueva Nota
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {tabs?.map((tab) => (
                <button
                  key={tab?.id}
                  onClick={() => setActiveTab(tab?.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-smooth whitespace-nowrap ${
                    activeTab === tab?.id
                      ? 'bg-primary text-primary-foreground shadow-glow-primary'
                      : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon name={tab?.icon} size={18} />
                  {tab?.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-6">
                <QuickStats
                  totalAthletes={totalAthletes}
                  totalPlans={myPlans?.length}
                  completedSessions={completedSessions}
                  avgAttendance={avgAttendance}
                />

                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-heading font-semibold text-foreground">Filtros de Rutinas y Seguimiento</h3>
                      <p className="text-sm text-muted-foreground">
                        Filtra atletas por rutina asignada y ritmo de seguimiento usando workouts reales.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        <label className="text-xs text-muted-foreground">Rutina</label>
                        <select
                          value={routineFilter}
                          onChange={(event) => setRoutineFilter(event?.target?.value)}
                          className="h-10 px-3 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="all">Todas las rutinas</option>
                          {routines?.map((routine) => (
                            <option key={routine?.id} value={routine?.id}>
                              {routine?.name || routine?.title || 'Rutina'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        <label className="text-xs text-muted-foreground">Seguimiento</label>
                        <select
                          value={trackingFilter}
                          onChange={(event) => setTrackingFilter(event?.target?.value)}
                          className="h-10 px-3 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="all">Todos</option>
                          <option value="recent">Resultados recientes</option>
                          <option value="stale">Seguimiento pendiente</option>
                          <option value="no-results">Sin resultados</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground">Atletas filtrados</p>
                      <p className="text-2xl font-semibold text-foreground">{filteredAthletes?.length}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground">Rutinas disponibles</p>
                      <p className="text-2xl font-semibold text-foreground">{routines?.length || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground">Resultados registrados</p>
                      <p className="text-2xl font-semibold text-foreground">{workoutResults?.length || 0}</p>
                    </div>
                  </div>
                </div>

                {evolutionChartData?.length > 0 && evolutionAthletes?.length > 0 && (
                  <PerformanceEvolutionChart
                    data={evolutionChartData}
                    athletes={evolutionAthletes}
                  />
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-heading font-semibold text-foreground">Sesiones de Hoy</h3>
                      <Icon name="Calendar" size={20} color="var(--color-primary)" />
                    </div>
                    {todaySessions?.length > 0 ? (
                      <div className="space-y-3">
                        {todaySessions?.map((session) => (
                          <div key={session?.id} className="p-3 bg-muted/50 rounded-lg border border-border/50">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-foreground">{session?.type}</p>
                                <p className="text-sm text-muted-foreground">{session?.time}</p>
                                <p className="text-xs text-muted-foreground mt-1">{session?.location}</p>
                              </div>
                              <span className="px-2 py-1 bg-success/10 text-success text-xs font-medium rounded">
                                {session?.attendees?.length} atletas
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Icon name="CalendarOff" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
                        <p className="text-muted-foreground">No hay sesiones programadas para hoy</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-heading font-semibold text-foreground">Notas Recientes</h3>
                      <Icon name="FileText" size={20} color="var(--color-secondary)" />
                    </div>
                    {myNotes?.length > 0 ? (
                      <div className="space-y-3">
                        {myNotes?.slice(0, 3)?.map((note) => (
                          <div key={note?.id} className="p-3 bg-muted/50 rounded-lg border border-border/50">
                            <div className="flex items-start gap-2">
                              <Icon
                                name={note?.type === 'positive' ? 'ThumbsUp' : 'AlertCircle'}
                                size={16}
                                color={note?.type === 'positive' ? 'var(--color-success)' : 'var(--color-warning)'}
                                className="flex-shrink-0 mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground line-clamp-2">{note?.content}</p>
                                <p className="text-xs text-muted-foreground mt-1">{note?.date}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Icon name="FileText" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
                        <p className="text-muted-foreground">No hay notas recientes</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'plans' && (
              <MyPlansSection plans={myPlans} />
            )}

            {activeTab === 'athletes' && (
              <MyAthletesSection
                athletes={filteredAthletes}
                athleteIds={filteredAthletes?.map((athlete) => athlete?.id)}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceTracker sessions={mySessions} selectedDate={selectedDate} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfessorDashboard;
