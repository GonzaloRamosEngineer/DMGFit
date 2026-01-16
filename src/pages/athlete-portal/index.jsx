import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabaseClient'; // Importamos supabase directo para queries custom

import { useAuth } from '../../contexts/AuthContext';
// Importamos los servicios existentes
import { fetchAthleteNotes } from '../../services/athletes';
import { fetchAttendanceByAthlete } from '../../services/attendance';
import { fetchMetricsByAthlete } from '../../services/metrics';
import { fetchPaymentsByAthlete } from '../../services/payments';
import { fetchPlanByAthlete } from '../../services/plans';
import { fetchUpcomingSessionsByAthlete } from '../../services/sessions';

// Componentes de tarjetas
import MyPlanCard from './components/MyPlanCard';
import UpcomingSessionsCard from './components/UpcomingSessionsCard';
import AttendanceCard from './components/AttendanceCard';
import MetricsCard from './components/MetricsCard';
import PaymentsCard from './components/PaymentsCard';
import CoachNotesCard from './components/CoachNotesCard';

const AthletePortal = () => {
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Data State
  const [plan, setPlan] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]); // Nuevo estado para molinete

  const athleteId = currentUser?.athleteId || currentUser?.athlete_id || currentUser?.id;

  useEffect(() => {
    let isMounted = true;

    const loadAthleteData = async () => {
      try {
        // Obtenemos el ID real del atleta si estamos logueados como usuario
        let realAthleteId = athleteId;
        
        // Si el ID parece ser el del usuario (auth.uid), buscamos el id de la tabla athletes
        if (currentUser?.role === 'atleta') {
             const { data: athData } = await supabase
               .from('athletes')
               .select('id')
               .eq('profile_id', currentUser.id)
               .single();
             if (athData) realAthleteId = athData.id;
        }

        if (!realAthleteId) return;

        const [planData, attendanceData, metricsData, notesData, sessionsData, paymentsData, accessLogsData] = await Promise.all([
          fetchPlanByAthlete(realAthleteId),
          fetchAttendanceByAthlete(realAthleteId),
          fetchMetricsByAthlete(realAthleteId),
          fetchAthleteNotes(realAthleteId),
          fetchUpcomingSessionsByAthlete(realAthleteId, 3),
          fetchPaymentsByAthlete(realAthleteId),
          // Fetch manual para access_logs
          supabase.from('access_logs')
            .select('*')
            .eq('athlete_id', realAthleteId)
            .order('check_in_time', { ascending: false })
            .limit(10)
        ]);

        if (!isMounted) return;

        setPlan(planData);
        setAttendance(attendanceData ?? []);
        setMetrics(metricsData ?? []);
        setNotes(notesData ?? []);
        setSessions(sessionsData ?? []);
        setPayments(paymentsData ?? []);
        setAccessLogs(accessLogsData?.data ?? []);
        
      } catch (error) {
        console.error('Error loading athlete portal data', error);
      }
    };

    if (currentUser) {
      loadAthleteData();
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser, athleteId]);

  const attendanceRate = useMemo(() => {
    if (!attendance?.length) return 0;
    const presentCount = attendance.filter(a => a?.status === 'present')?.length || 0;
    return Math.round((presentCount / attendance.length) * 100);
  }, [attendance]);

  const breadcrumbItems = [
    { label: 'Mi Portal', path: '/athlete-portal', active: true }
  ];

  return (
    <>
      <Helmet>
        <title>Mi Portal - DigitalMatch</title>
      </Helmet>
      <div className="flex min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          alertData={{}}
        />
        <div className={`flex-1 transition-smooth ${sidebarCollapsed ? 'ml-20' : 'ml-60'}`}>
          <div className="p-6 lg:p-8">
            <BreadcrumbTrail items={breadcrumbItems} />
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                  Mi Portal de Atleta
                </h1>
                <p className="text-muted-foreground">
                  Bienvenido, {currentUser?.name || 'Atleta'}
                </p>
              </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="TrendingUp" size={20} color="var(--color-primary)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{attendanceRate}%</p>
                    <p className="text-sm text-muted-foreground">Tasa Asistencia (Clases)</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="LogIn" size={20} color="var(--color-success)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">
                      {accessLogs.filter(l => l.access_granted).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Visitas Totales</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <Icon name="Award" size={20} color="var(--color-secondary)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{metrics?.length}</p>
                    <p className="text-sm text-muted-foreground">Métricas Registradas</p>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <MyPlanCard plan={plan} />
                
                {/* TARJETA DE ÚLTIMOS INGRESOS (MOLINETE) */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Icon name="Clock" size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Mis Últimos Ingresos</h3>
                  </div>
                  <div className="space-y-3">
                    {accessLogs.length > 0 ? (
                      accessLogs.slice(0, 5).map((log, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm p-2 hover:bg-muted/20 rounded-lg transition-colors">
                          <div className={`w-2 h-2 rounded-full ${log.access_granted ? 'bg-success' : 'bg-error'}`}></div>
                          <span className="text-foreground font-medium">
                            {new Date(log.check_in_time).toLocaleDateString()}
                          </span>
                          <span className="text-muted-foreground ml-auto font-mono">
                            {new Date(log.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2 text-center">Aún no has registrado ingresos por molinete.</p>
                    )}
                  </div>
                </div>

                <UpcomingSessionsCard sessions={sessions} />
              </div>

              <div className="space-y-6">
                <MetricsCard metrics={metrics} />
                <PaymentsCard payments={payments} />
                <CoachNotesCard notes={notes} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AthletePortal;