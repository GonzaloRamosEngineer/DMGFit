import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

import { useAuth } from '../../contexts/AuthContext';
import { fetchAthleteNotes } from '../../services/athletes';
import { fetchAttendanceByAthlete } from '../../services/attendance';
import { fetchMetricsByAthlete } from '../../services/metrics';
import { fetchPaymentsByAthlete } from '../../services/payments';
import { fetchPlanByAthlete } from '../../services/plans';
import { fetchUpcomingSessionsByAthlete } from '../../services/sessions';
import MyPlanCard from './components/MyPlanCard';
import UpcomingSessionsCard from './components/UpcomingSessionsCard';
import AttendanceCard from './components/AttendanceCard';
import MetricsCard from './components/MetricsCard';
import PaymentsCard from './components/PaymentsCard';
import CoachNotesCard from './components/CoachNotesCard';

const AthletePortal = () => {
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plan, setPlan] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);

  const athleteId = 'ATH001';

  useEffect(() => {
    let isMounted = true;

    const loadAthleteData = async () => {
      try {
        const [planData, attendanceData, metricsData, notesData, sessionsData, paymentsData] = await Promise.all([
          fetchPlanByAthlete(athleteId),
          fetchAttendanceByAthlete(athleteId),
          fetchMetricsByAthlete(athleteId),
          fetchAthleteNotes(athleteId),
          fetchUpcomingSessionsByAthlete(athleteId, 3),
          fetchPaymentsByAthlete(athleteId)
        ]);

        if (!isMounted) {
          return;
        }

        setPlan(planData);
        setAttendance(attendanceData ?? []);
        setMetrics(metricsData ?? []);
        setNotes(notesData ?? []);
        setSessions(sessionsData ?? []);
        setPayments(paymentsData ?? []);
      } catch (error) {
        console.error('Error loading athlete portal data', error);
      }
    };

    if (athleteId) {
      loadAthleteData();
    }

    return () => {
      isMounted = false;
    };
  }, [athleteId]);

  const attendanceRate = useMemo(() => {
    if (!attendance?.length) {
      return 0;
    }

    const presentCount = attendance?.filter(a => a?.status === 'present')?.length || 0;
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="TrendingUp" size={20} color="var(--color-primary)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{attendanceRate}%</p>
                    <p className="text-sm text-muted-foreground">Asistencia</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="CheckCircle" size={20} color="var(--color-success)" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">
                      {attendance?.filter(a => a?.status === 'present')?.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Sesiones Completadas</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <MyPlanCard plan={plan} />
                <UpcomingSessionsCard sessions={sessions} />
                <AttendanceCard attendance={attendance} attendanceRate={attendanceRate} />
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
