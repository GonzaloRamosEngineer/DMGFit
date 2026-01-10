import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';

import { useAuth } from '../../contexts/AuthContext';
import { getAthletePlan, getAthleteAttendance, getAthleteMetrics, getAthleteNotes, mockSessions } from '../../data/mockData';
import MyPlanCard from './components/MyPlanCard';
import UpcomingSessionsCard from './components/UpcomingSessionsCard';
import AttendanceCard from './components/AttendanceCard';
import MetricsCard from './components/MetricsCard';
import PaymentsCard from './components/PaymentsCard';
import CoachNotesCard from './components/CoachNotesCard';

const AthletePortal = () => {
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const athleteId = 'ATH001';
  const myPlan = getAthletePlan(athleteId);
  const myAttendance = getAthleteAttendance(athleteId);
  const myMetrics = getAthleteMetrics(athleteId);
  const myNotes = getAthleteNotes(athleteId);

  const upcomingSessions = mockSessions?.filter(s => {
    const sessionDate = new Date(s?.date);
    const today = new Date();
    return sessionDate >= today && s?.attendees?.includes(athleteId);
  })?.slice(0, 3);

  const attendanceRate = myAttendance?.length > 0
    ? Math.round((myAttendance?.filter(a => a?.status === 'present')?.length / myAttendance?.length) * 100)
    : 0;

  const mockPayments = [
    { id: 'PAY-001', date: '2026-01-01', amount: 150, status: 'paid', concept: 'Mensualidad Enero 2026' },
    { id: 'PAY-002', date: '2025-12-01', amount: 150, status: 'paid', concept: 'Mensualidad Diciembre 2025' },
    { id: 'PAY-003', date: '2025-11-01', amount: 150, status: 'paid', concept: 'Mensualidad Noviembre 2025' }
  ];

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
                    <p className="text-2xl font-heading font-bold text-foreground">{myAttendance?.filter(a => a?.status === 'present')?.length}</p>
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
                    <p className="text-2xl font-heading font-bold text-foreground">{myMetrics?.length}</p>
                    <p className="text-sm text-muted-foreground">Métricas Registradas</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <MyPlanCard plan={myPlan} />
                <UpcomingSessionsCard sessions={upcomingSessions} />
                <AttendanceCard attendance={myAttendance} attendanceRate={attendanceRate} />
              </div>

              <div className="space-y-6">
                <MetricsCard metrics={myMetrics} />
                <PaymentsCard payments={mockPayments} />
                <CoachNotesCard notes={myNotes} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AthletePortal;