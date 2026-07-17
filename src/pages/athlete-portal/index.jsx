import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// UI Global
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import {
  ATHLETE_PORTAL_SECTION_IDS,
  ATHLETE_PORTAL_SECTIONS,
  DEFAULT_ATHLETE_PORTAL_SECTION,
} from '../../config/athletePortalSections';

// Servicios
import { fetchAthleteNotes } from '../../services/athletes';
import { fetchAttendanceByAthlete } from '../../services/attendance';
import { fetchMetricsByAthlete } from '../../services/metrics';
import { fetchPaymentsByAthlete } from '../../services/payments';
import { fetchPlanByAthlete } from '../../services/plans';
import { fetchUpcomingSessionsByAthlete } from '../../services/sessions';
import { fetchKioskRemaining } from '../../services/kiosk';

// COMPONENTES PREMIUM (Nivel Ingeniería Minimalista)
import StatsOverview from './components/StatsOverview';      // HUD Superior
import AchievementsHub from './components/AchievementsHub';  // Gamificación
import PerformanceChart from './components/PerformanceChart';// Gráfico Lineal Principal
import MetricsCard from './components/MetricsCard';          // Grid de Métricas Vivas
import AthleteRadar from './components/AthleteRadar';        // Perfil Radar
import MetricEntryForm from './components/MetricEntryForm';  // Mediciones y tests
import ExerciseProgressCard from './components/workout/ExerciseProgressCard'; // Progreso por ejercicio (workouts)
import UpcomingSessionsCard from './components/UpcomingSessionsCard'; // Agenda Boarding Pass
import MyPlanCard from './components/MyPlanCard';            // Membership Black Card
import MyScheduleCard from './components/MyScheduleCard';    // Auto-gestión de turnos (preferencia)
import MyDataCard from './components/MyDataCard';            // Autoservicio: mis datos
import PaymentsCard from './components/PaymentsCard';        // Wallet Financiera
import AttendanceCard from './components/AttendanceCard';    // Monitor de Hábito
import CoachNotesCard from './components/CoachNotesCard';    // Feed de Feedback
import WorkoutSection from './components/workout/WorkoutSection'; // Registrador de entrenamiento + biblioteca

const runPortalTask = async (key, task, fallback) => {
  try {
    return { key, data: await task(), error: null };
  } catch (error) {
    console.error(`Error cargando ${key}:`, error);
    return { key, data: fallback, error };
  }
};

const SectionTitle = ({ label }) => (
  <h2 className="text-xs font-black text-text-tertiary uppercase tracking-widest mb-3 ml-1">
    {label}
  </h2>
);

const AthletePortal = () => {
  const { currentUser } = useAuth();
  const { section } = useParams();
  const activeSection = section || DEFAULT_ATHLETE_PORTAL_SECTION;
  
  // --- Estados de Datos ---
  const [athlete, setAthlete] = useState(null);
  const [plan, setPlan] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [kioskRemaining, setKioskRemaining] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({});
  
  // --- Lógica de Identificación ---
  const [calculatedAthleteId, setCalculatedAthleteId] = useState(null);
  const initialAthleteId = currentUser?.athleteId || currentUser?.athlete_id || currentUser?.id;

  // --- Recarga Inteligente (Optimistic Updates) ---
  const refreshMetrics = async () => {
    if (calculatedAthleteId) {
      try {
        const updatedMetrics = await fetchMetricsByAthlete(calculatedAthleteId);
        setMetrics(updatedMetrics ?? []);
      } catch (error) { console.error("Error refrescando métricas:", error); }
    }
  };

  // --- Carga Inicial ---
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!currentUser) return;

      setIsLoading(true);
      setLoadErrors({});

      try {
        let realId = initialAthleteId;
        let athleteRow = null;

        if (currentUser?.role === 'atleta') {
          const { data, error } = await supabase
            .from('athletes')
            .select('*')
            .eq('profile_id', currentUser.id)
            .maybeSingle();

          if (error) throw error;
          if (data) {
            realId = data.id;
            athleteRow = data;
          }
        }
        
        if (!realId) {
          if (isMounted) setIsLoading(false);
          return;
        }

        if (!athleteRow) {
          const { data, error } = await supabase
            .from('athletes')
            .select('*')
            .eq('id', realId)
            .maybeSingle();

          if (error) console.warn('No se pudo cargar el perfil de atleta:', error);
          athleteRow = data ?? null;
        }

        if (isMounted) {
          setCalculatedAthleteId(realId);
          setAthlete(athleteRow);
        }

        const results = await Promise.all([
          runPortalTask('plan', () => fetchPlanByAthlete(realId), null),
          runPortalTask('attendance', () => fetchAttendanceByAthlete(realId), []),
          runPortalTask('metrics', () => fetchMetricsByAthlete(realId), []),
          runPortalTask('notes', () => fetchAthleteNotes(realId), []),
          runPortalTask('sessions', () => fetchUpcomingSessionsByAthlete(realId, 5), []),
          runPortalTask('payments', () => fetchPaymentsByAthlete(realId), []),
          runPortalTask('kioskRemaining', () => fetchKioskRemaining({ athleteId: realId }), null),
        ]);

        const dataByKey = Object.fromEntries(results.map((result) => [result.key, result.data]));
        const errorsByKey = Object.fromEntries(
          results
            .filter((result) => result.error)
            .map((result) => [result.key, result.error?.message || 'No disponible'])
        );

        if (isMounted) {
          setPlan(dataByKey.plan);
          setAttendance(dataByKey.attendance ?? []);
          setMetrics(dataByKey.metrics ?? []);
          setNotes(dataByKey.notes ?? []);
          setSessions(dataByKey.sessions ?? []);
          setPayments(dataByKey.payments ?? []);
          setKioskRemaining(dataByKey.kioskRemaining);
          setLoadErrors(errorsByKey);
        }
      } catch (e) { 
        console.error("Error cargando dashboard:", e); 
        if (isMounted) setLoadErrors({ dashboard: e?.message || 'No se pudo cargar el portal' });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [currentUser, initialAthleteId]);

  const currentSection = ATHLETE_PORTAL_SECTIONS.find((item) => item.id === activeSection) ?? ATHLETE_PORTAL_SECTIONS[0];

  // KPI Derivado: Tasa de Asistencia
  const attendanceRate = useMemo(() => {
    if (!attendance?.length) return 0;
    const present = attendance.filter(a => a?.status === 'present')?.length || 0;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  const planForDisplay = useMemo(() => {
    if (!plan) return null;

    const tierPrice = Number(athlete?.plan_tier_price);
    const visitsPerWeek = Number(athlete?.visits_per_week);

    return {
      ...plan,
      base_price: plan.price,
      price: Number.isFinite(tierPrice) && tierPrice > 0 ? tierPrice : plan.price,
      visits_per_week: Number.isFinite(visitsPerWeek) && visitsPerWeek > 0 ? visitsPerWeek : null,
      athlete_status: athlete?.status,
      athlete_join_date: athlete?.join_date,
    };
  }, [athlete, plan]);

  // Fecha actual para el saludo
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const loadErrorCount = Object.keys(loadErrors).length;

  if (!ATHLETE_PORTAL_SECTION_IDS.has(activeSection)) {
    return <Navigate to="/athlete-portal" replace />;
  }

  return (
    <>
      <Helmet><title>Portal del Atleta | DMG Fitness</title></Helmet>
      
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-[1600px] mx-auto p-6 pt-1 md:p-10 md:pt-2 lg:pt-10 space-y-8">
          
          <BreadcrumbTrail
            items={
              activeSection === DEFAULT_ATHLETE_PORTAL_SECTION
                ? [{ label: 'Portal', path: '/athlete-portal', active: true }]
                : [
                    { label: 'Portal', path: '/athlete-portal' },
                    { label: currentSection.label, path: currentSection.path, active: true },
                  ]
            }
          />
          
          {/* HEADER: Saludo Personalizado */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-1 first-letter:uppercase">
                {today}
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-text-primary tracking-tight">
                Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{currentUser?.name?.split(' ')[0] || 'atleta'}</span>
              </h1>
            </div>
            {/* Status Badge */}
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-full border border-border shadow-sm">
                <div className={`w-2 h-2 rounded-full ${planForDisplay ? 'bg-success animate-pulse' : 'bg-text-tertiary'}`}></div>
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">
                    {isLoading ? 'Sincronizando' : planForDisplay ? 'Atleta Activo' : 'Cuenta Invitado'}
                </span>
            </div>
          </header>

          {loadErrorCount > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <Icon name="AlertTriangle" size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold">Algunos datos no se actualizaron.</p>
                <p className="text-xs font-semibold opacity-80">
                  El portal sigue disponible con la información que pudo cargarse.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'inicio' && (
            <>
              <StatsOverview metrics={metrics} attendanceRate={attendanceRate} />
              <section>
                <SectionTitle label="Resumen" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                  <MyPlanCard plan={planForDisplay} kioskRemaining={kioskRemaining} />
                  <UpcomingSessionsCard sessions={sessions} />
                  <CoachNotesCard notes={notes} />
                </div>
              </section>
            </>
          )}

          {activeSection === 'cuenta' && (
            <section>
              <SectionTitle label="Mi cuenta" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                <MyPlanCard plan={planForDisplay} kioskRemaining={kioskRemaining} />
                <MyDataCard />
                <PaymentsCard payments={payments} />
              </div>
            </section>
          )}

          {activeSection === 'agenda' && (
            <section>
              <SectionTitle label="Agenda" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  <MyScheduleCard />
                  <UpcomingSessionsCard sessions={sessions} />
                </div>
                <AttendanceCard attendance={attendance} attendanceRate={attendanceRate} />
              </div>
            </section>
          )}

          {activeSection === 'progreso' && (
            <section>
              <SectionTitle label="Mi progreso" />
              <div className="space-y-5">
                {/* Fuerza: derivada de los entrenamientos registrados en Entrenar */}
                <ExerciseProgressCard athleteId={calculatedAthleteId} />

                {/* Mediciones y tests: métricas corporales / evaluaciones (metrics) */}
                <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
                  <PerformanceChart metrics={metrics} compact />
                  <AthleteRadar metrics={metrics} compact />
                </div>

                <div className="rounded-3xl border border-border bg-card shadow-[0_24px_70px_-34px_rgba(15,23,42,0.22)] overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-tertiary">
                        Mediciones y tests
                      </p>
                      <h3 className="text-xl font-black text-text-primary">
                        Cargá tu peso, medidas o evaluaciones
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-xs font-black uppercase tracking-wider text-text-secondary">
                      <Icon name="Ruler" size={15} className="text-primary" />
                      Los ejercicios se registran en Entrenar
                    </div>
                  </div>

                  <div className="p-5">
                    <MetricEntryForm
                      athleteId={calculatedAthleteId}
                      onSuccess={refreshMetrics}
                      embedded
                      compact
                    />
                  </div>
                </div>

                {metrics.length > 0 && (
                  <MetricsCard metrics={metrics} />
                )}
              </div>
            </section>
          )}

          {activeSection === 'entrenar' && (
            <section>
              <SectionTitle label="Entrenamiento" />
              <WorkoutSection athleteId={calculatedAthleteId} />
            </section>
          )}

          {activeSection === 'coach' && (
            <section>
              <SectionTitle label="Coach" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <div className="lg:col-span-2">
                  <CoachNotesCard notes={notes} />
                </div>
                <AttendanceCard attendance={attendance} attendanceRate={attendanceRate} />
              </div>
            </section>
          )}

          {activeSection === 'logros' && (
            <AchievementsHub metrics={metrics} attendanceRate={attendanceRate} />
          )}

        </div>
      </div>
    </>
  );
};

export default AthletePortal;
