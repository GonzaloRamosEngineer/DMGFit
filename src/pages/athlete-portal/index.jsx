import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// UI Global
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

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
import MetricEntryForm from './components/MetricEntryForm';  // Input Avanzado
import UpcomingSessionsCard from './components/UpcomingSessionsCard'; // Agenda Boarding Pass
import MyPlanCard from './components/MyPlanCard';            // Membership Black Card
import MyScheduleCard from './components/MyScheduleCard';    // Auto-gestión de turnos (preferencia)
import MyDataCard from './components/MyDataCard';            // Autoservicio: mis datos
import PaymentsCard from './components/PaymentsCard';        // Wallet Financiera
import AttendanceCard from './components/AttendanceCard';    // Monitor de Hábito
import CoachNotesCard from './components/CoachNotesCard';    // Feed de Feedback

const AthletePortal = () => {
  const { currentUser } = useAuth();
  
  // --- Estados de Datos ---
  const [plan, setPlan] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [kioskRemaining, setKioskRemaining] = useState(null);
  
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
      try {
        let realId = initialAthleteId;
        if (currentUser?.role === 'atleta') {
             const { data } = await supabase.from('athletes').select('id').eq('profile_id', currentUser.id).single();
             if (data) realId = data.id;
        }
        
        if (!realId) return;
        if (isMounted) setCalculatedAthleteId(realId);

        const [planD, attD, metD, noteD, sessD, payD, remD] = await Promise.all([
          fetchPlanByAthlete(realId),
          fetchAttendanceByAthlete(realId),
          fetchMetricsByAthlete(realId),
          fetchAthleteNotes(realId),
          fetchUpcomingSessionsByAthlete(realId, 5),
          fetchPaymentsByAthlete(realId),
          fetchKioskRemaining({ athleteId: realId }).catch(() => null)
        ]);

        if (isMounted) {
          setPlan(planD);
          setAttendance(attD ?? []);
          setMetrics(metD ?? []);
          setNotes(noteD ?? []);
          setSessions(sessD ?? []);
          setPayments(payD ?? []);
          setKioskRemaining(remD);
        }
      } catch (e) { 
        console.error("Error cargando dashboard:", e); 
      }
    };

    if (currentUser) loadData();
    return () => { isMounted = false; };
  }, [currentUser, initialAthleteId]);

  // KPI Derivado: Tasa de Asistencia
  const attendanceRate = useMemo(() => {
    if (!attendance?.length) return 0;
    const present = attendance.filter(a => a?.status === 'present')?.length || 0;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  // Fecha actual para el saludo
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <Helmet><title>Portal del Atleta | DMG Fitness</title></Helmet>
      
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-[1600px] mx-auto p-6 md:p-10 space-y-8">
          
          <BreadcrumbTrail items={[{ label: 'Portal', path: '/athlete-portal', active: true }]} />
          
          {/* HEADER: Saludo Personalizado */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-1 first-letter:uppercase">
                {today}
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-text-primary tracking-tight">
                Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{currentUser?.name?.split(' ')[0]}</span>
              </h1>
            </div>
            {/* Status Badge */}
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-full border border-border shadow-sm">
                <div className={`w-2 h-2 rounded-full ${plan ? 'bg-success animate-pulse' : 'bg-text-tertiary'}`}></div>
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">
                    {plan ? 'Atleta Activo' : 'Cuenta Invitado'}
                </span>
            </div>
          </header>

          {/* NIVEL 1: HUD (KPIs rápidos) */}
          <StatsOverview metrics={metrics} attendanceRate={attendanceRate} />

          {/* NIVEL 2: MI CUENTA (autoservicio, lo más útil arriba) */}
          <section>
            <h2 className="text-xs font-black text-text-tertiary uppercase tracking-widest mb-3 ml-1">Mi cuenta</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
              <MyPlanCard plan={plan} kioskRemaining={kioskRemaining} />
              <MyScheduleCard />
              <MyDataCard />
            </div>
          </section>

          {/* NIVEL 3: MI PROGRESO (métricas + rendimiento) */}
          <section>
            <h2 className="text-xs font-black text-text-tertiary uppercase tracking-widest mb-3 ml-1">Mi progreso</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              <div className="lg:col-span-2 space-y-5">
                <PerformanceChart metrics={metrics} />
                <MetricEntryForm athleteId={calculatedAthleteId} onSuccess={refreshMetrics} />
                <MetricsCard metrics={metrics} />
              </div>
              <div className="space-y-5">
                <AthleteRadar metrics={metrics} />
                <AttendanceCard attendance={attendance} attendanceRate={attendanceRate} />
              </div>
            </div>
          </section>

          {/* NIVEL 4: ACTIVIDAD (agenda, feedback, pagos) */}
          <section>
            <h2 className="text-xs font-black text-text-tertiary uppercase tracking-widest mb-3 ml-1">Actividad</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
              <UpcomingSessionsCard sessions={sessions} />
              <CoachNotesCard notes={notes} />
              <PaymentsCard payments={payments} />
            </div>
          </section>

          {/* NIVEL 5: LOGROS (gamificación, al final) */}
          <AchievementsHub metrics={metrics} attendanceRate={attendanceRate} />

        </div>
      </div>
    </>
  );
};

export default AthletePortal;