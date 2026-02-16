import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// UI Global (Rutas confirmadas según estructura del proyecto)
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

// Servicios
import { fetchAthleteNotes } from '../../services/athletes';
import { fetchAttendanceByAthlete } from '../../services/attendance';
import { fetchMetricsByAthlete } from '../../services/metrics';
import { fetchPaymentsByAthlete } from '../../services/payments';
import { fetchPlanByAthlete } from '../../services/plans';
import { fetchUpcomingSessionsByAthlete } from '../../services/sessions';

// COMPONENTES ELITE (Dashboard de Alto Rendimiento)
// import StatsOverview from './components/StatsOverview';      // KPIs Superiores
import AchievementsHub from './components/AchievementsHub'; // AGREGAR ESTE
import PerformanceChart from './components/PerformanceChart'; // Gráfico de Evolución
import AthleteRadar from './components/AthleteRadar';         // Gráfico de Araña
import MetricEntryForm from './components/MetricEntryForm';   // Carga de Datos
import UpcomingSessionsCard from './components/UpcomingSessionsCard';
import MyPlanCard from './components/MyPlanCard';
import CoachNotesCard from './components/CoachNotesCard';

const AthletePortal = () => {
  const { currentUser } = useAuth();
  
  // --- Estados de Datos ---
  const [plan, setPlan] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  // (Opcional) Payments si decidimos mostrarlo
  // const [payments, setPayments] = useState([]); 
  
  // --- Lógica de Identificación ---
  const [calculatedAthleteId, setCalculatedAthleteId] = useState(null);
  const initialAthleteId = currentUser?.athleteId || currentUser?.athlete_id || currentUser?.id;

  // --- Función para recargar solo métricas tras una nueva entrada ---
  const refreshMetrics = async () => {
    if (calculatedAthleteId) {
      try {
        const updatedMetrics = await fetchMetricsByAthlete(calculatedAthleteId);
        setMetrics(updatedMetrics ?? []);
      } catch (error) { console.error("Error refrescando métricas:", error); }
    }
  };

  // --- Carga Inicial de Datos ---
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        // 1. Resolver ID real del atleta
        let realId = initialAthleteId;
        if (currentUser?.role === 'atleta') {
             const { data } = await supabase.from('athletes').select('id').eq('profile_id', currentUser.id).single();
             if (data) realId = data.id;
        }
        
        if (!realId) return;
        if (isMounted) setCalculatedAthleteId(realId);

        // 2. Fetch Paralelo de todos los servicios
        const [planD, attD, metD, noteD, sessD] = await Promise.all([
          fetchPlanByAthlete(realId),
          fetchAttendanceByAthlete(realId),
          fetchMetricsByAthlete(realId),
          fetchAthleteNotes(realId),
          fetchUpcomingSessionsByAthlete(realId, 5) // Traemos las próximas 5
        ]);

        if (isMounted) {
          setPlan(planD);
          setAttendance(attD ?? []);
          setMetrics(metD ?? []);
          setNotes(noteD ?? []);
          setSessions(sessD ?? []);
        }
      } catch (e) { 
        console.error("Error cargando dashboard:", e); 
      }
    };

    if (currentUser) loadData();
    return () => { isMounted = false; };
  }, [currentUser, initialAthleteId]);

  // --- Cálculo de KPIs Derivados ---
  const attendanceRate = useMemo(() => {
    if (!attendance?.length) return 0;
    const present = attendance.filter(a => a?.status === 'present')?.length || 0;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  return (
    <>
      <Helmet><title>Panel Atleta | Elite Performance</title></Helmet>
      
      <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto bg-[#F8FAFC] min-h-screen">
        <BreadcrumbTrail items={[{ label: 'Mi Portal', path: '/athlete-portal', active: true }]} />
        
        {/* HEADER: Identidad y Estado */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 mt-2">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Hola, {currentUser?.name?.split(' ')[0]}
            </h1>
            <p className="text-gray-500 font-medium">Resumen de Alto Rendimiento</p>
          </div>
          
          {/* Badge de Estado del Plan (Visual) */}
          {plan && (
            <div className="hidden md:block text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Membresía Activa</p>
                <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold text-gray-800">{plan.name}</span>
                </div>
            </div>
          )}
        </div>

        {/* 1. SECCIÓN SUPERIOR: KPIs Críticos (HUD)
        {/* Reemplaza las tarjetas simples antiguas por un panel consolidado */}
        {/* <StatsOverview metrics={metrics} attendanceRate={attendanceRate} /> */}


        {/* 1. SECCIÓN SUPERIOR: Gamificación y Nivel */}
<AchievementsHub metrics={metrics} attendanceRate={attendanceRate} />

        {/* 2. GRID PRINCIPAL ASIMÉTRICO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          
          {/* COLUMNA IZQUIERDA (2/3): Análisis y Evolución (El foco principal) */}
          <div className="lg:col-span-2 space-y-6">
             
             {/* Gráfico de Evolución Avanzado */}
             <PerformanceChart metrics={metrics} />

             {/* Carga de Datos (Diseño integrado) */}
             {calculatedAthleteId && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Icon name="PlusCircle" className="text-blue-600" size={20} />
                        <h3 className="font-bold text-gray-900">Registrar Nuevo Progreso</h3>
                    </div>
                    <MetricEntryForm 
                        athleteId={calculatedAthleteId} 
                        onSuccess={refreshMetrics} 
                    />
                </div>
             )}
          </div>

          {/* COLUMNA DERECHA (1/3): Perfil, Agenda y Feedback */}
          <div className="space-y-6">
             
             {/* Gráfico de Radar (Perfil Atlético) */}
             <AthleteRadar metrics={metrics} />

             {/* Tarjeta de Plan (Estilo Credencial) */}
             <MyPlanCard plan={plan} />
             
             {/* Línea de Tiempo de Sesiones */}
             <UpcomingSessionsCard sessions={sessions} />
             
             {/* Feedback del Entrenador */}
             <CoachNotesCard notes={notes} />
          </div>

        </div>
      </div>
    </>
  );
};

export default AthletePortal;