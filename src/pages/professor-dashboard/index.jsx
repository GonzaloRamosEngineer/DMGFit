import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { getPlansByProfessor, getAthletesByProfessor, mockSessions, mockAttendance, mockNotes } from '../../data/mockData';
import MyPlansSection from './components/MyPlansSection';
import MyAthletesSection from './components/MyAthletesSection';
import AttendanceTracker from './components/AttendanceTracker';
import QuickStats from './components/QuickStats';

const ProfessorDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState(new Date()?.toISOString()?.split('T')?.[0]);

  const professorName = currentUser?.name || 'Ana García';
  const myPlans = getPlansByProfessor(professorName);
  const myAthleteIds = getAthletesByProfessor(professorName);
  const mySessions = mockSessions?.filter(s => s?.professor === professorName);
  const myNotes = mockNotes?.filter(n => n?.professorName === professorName);

  const todaySessions = mySessions?.filter(s => s?.date === selectedDate);
  const totalAthletes = myAthleteIds?.length || 0;
  const completedSessions = mySessions?.filter(s => s?.status === 'completed')?.length || 0;
  const avgAttendance = Math.round(
    (mockAttendance?.filter(a => a?.status === 'present')?.length / Math.max(mockAttendance?.length, 1)) * 100
  );

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
              <MyAthletesSection athleteIds={myAthleteIds} />
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