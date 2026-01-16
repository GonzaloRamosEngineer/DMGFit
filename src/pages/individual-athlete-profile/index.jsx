import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Usamos useParams ahora
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

//context
import { useAuth } from '../../contexts/AuthContext';

// UI Components
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';

// Profile Components
import AthleteHeader from './components/AthleteHeader';
import MetricCard from './components/MetricCard';
import PerformanceChart from './components/PerformanceChart';
import AttendanceCalendar from './components/AttendanceCalendar';
import PaymentHistory from './components/PaymentHistory';
import CoachNotes from './components/CoachNotes';
import UpcomingSessions from './components/UpcomingSessions';
import HealthMetrics from './components/HealthMetrics';
import { generateAthletePDF } from '../../utils/pdfExport';

const IndividualAthleteProfile = () => {


  const { id: athleteId } = useParams(); // ID desde la URL
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('performance');
  const [loading, setLoading] = useState(true);

  // Estado unificado de datos
  const [profileData, setProfileData] = useState({
    athlete: null,
    metrics: [], // Historial completo para gráficos
    latestMetrics: {}, // Para tarjetas de salud (peso actual, altura, etc)
    attendance: [],
    payments: [],
    notes: [],
    sessions: [] // Próximas sesiones
  });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!athleteId) return;
      setLoading(true);

      try {
        // 1. Datos del Atleta (Join con Profiles)
        const { data: athlete, error: athleteError } = await supabase
          .from('athletes')
          .select(`
            id, join_date, status, membership_type, phone,
            profiles:profile_id ( full_name, email, avatar_url )
          `)
          .eq('id', athleteId)
          .single();

        if (athleteError) throw athleteError;

        // 2. Cargas Paralelas de Datos Relacionados
        const [metricsRes, attendanceRes, paymentsRes, notesRes, sessionsRes] = await Promise.all([
          // Métricas (Ordenadas por fecha para obtener la última y el historial)
          supabase.from('metrics') // Vista o tabla performance_metrics
            .select('*')
            .eq('athlete_id', athleteId)
            .order('date', { ascending: true }),

          // Asistencia
          supabase.from('attendance')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('date', { ascending: false }),

          // Pagos
          supabase.from('payments')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('payment_date', { ascending: false }),

          // Notas
          supabase.from('notes')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('date', { ascending: false }),

          // Próximas Sesiones (Join con workout_sessions o sessions generales)
          // Aquí buscamos donde el atleta esté inscrito (lógica simplificada por ahora)
          supabase.from('session_attendees')
            .select(`
              session:session_id (
                id, session_date, time, type, location
              )
            `)
            .eq('athlete_id', athleteId)
            // Filtramos en cliente o usamos gte en query si la fecha es texto/date
        ]);

        // 3. Procesar Métricas de Salud (Peso, Altura, IMC)
        const metricsList = metricsRes.data || [];
        const latestValues = {};
        
        // Extraemos el último valor conocido de cada tipo
        ['Peso Corporal', 'Altura', 'Grasa Corporal'].forEach(key => {
          const found = [...metricsList].reverse().find(m => m.name === key);
          if (found) latestValues[key] = found;
        });

        // Calcular IMC si tenemos peso y altura
        if (latestValues['Peso Corporal'] && latestValues['Altura']) {
          const weight = Number(latestValues['Peso Corporal'].value);
          const heightM = Number(latestValues['Altura'].value) / 100;
          if (heightM > 0) {
            latestValues['IMC'] = { 
              value: (weight / (heightM * heightM)).toFixed(1),
              unit: 'kg/m²',
              date: latestValues['Peso Corporal'].date // Usamos fecha del peso
            };
          }
        }

        // 4. Formatear Sesiones Futuras
        const today = new Date().toISOString().split('T')[0];
        const upcoming = (sessionsRes.data || [])
          .map(item => item.session)
          .filter(s => s && s.session_date >= today)
          .sort((a, b) => new Date(a.session_date) - new Date(b.session_date))
          .slice(0, 3); // Solo las próximas 3

        setProfileData({
          athlete: {
            ...athlete,
            name: athlete.profiles?.full_name,
            email: athlete.profiles?.email,
            photo: athlete.profiles?.avatar_url
          },
          metrics: metricsList,
          latestMetrics: latestValues,
          attendance: attendanceRes.data || [],
          payments: paymentsRes.data || [],
          notes: notesRes.data || [],
          sessions: upcoming
        });

      } catch (error) {
        console.error("Error cargando perfil:", error);
        // Aquí podrías redirigir a 404 o mostrar alerta
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [athleteId]);

  // --- KPIs CALCULADOS ---
  const kpiStats = useMemo(() => {
    if (!profileData.attendance.length) return [];
    
    // Tasa Asistencia
    const totalAtt = profileData.attendance.length;
    const present = profileData.attendance.filter(a => a.status === 'present').length;
    const rate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;

    return [
      {
        title: "Tasa de Asistencia",
        value: `${rate}`,
        unit: "%",
        change: "Global",
        changeType: rate >= 80 ? "positive" : "warning",
        icon: "Calendar",
        iconColor: "var(--color-primary)"
      },
      {
        title: "Sesiones Totales",
        value: `${totalAtt}`,
        unit: "sesiones",
        change: "Histórico",
        changeType: "neutral",
        icon: "Activity",
        iconColor: "var(--color-accent)"
      },
      // Puedes agregar más KPIs calculados aquí
    ];
  }, [profileData.attendance]);

  // --- HANDLERS ---
  const handleAddNote = async (content) => {
    try {
      const { data, error } = await supabase.from('notes').insert({
        athlete_id: athleteId,
        content: content,
        date: new Date().toISOString().split('T')[0],
        type: 'general',
        coach_id: currentUser?.coachId // Asegurar que currentUser tenga coachId
      }).select().single();

      if (error) throw error;
      setProfileData(prev => ({ ...prev, notes: [data, ...prev.notes] }));
    } catch (err) {
      console.error("Error guardando nota:", err);
      alert("No se pudo guardar la nota.");
    }
  };

  const handleExportPDF = async () => {
    if (!profileData.athlete) return;
    await generateAthletePDF(
      profileData.athlete,
      profileData.metrics, // Pasamos historial para gráficos
      profileData.attendance,
      profileData.payments,
      profileData.notes
    );
  };

  return (
    <>
      <Helmet>
        <title>{profileData.athlete ? `${profileData.athlete.name} - Perfil` : 'Cargando...'} - DigitalMatch</title>
      </Helmet>
      
      <div className="flex min-h-screen bg-background">
        <NavigationSidebar
          isCollapsed={sidebarCollapsed}
          userRole={currentUser?.role || 'profesor'}
          alertData={{ dashboard: 2 }} // Dato dummy para badge
        />

        <div className={`flex-1 transition-smooth ${sidebarCollapsed ? 'ml-20' : 'ml-60'}`}>
          <div className="p-6 lg:p-8">
            <BreadcrumbTrail 
              items={[
                { label: 'Gestión de Atletas', path: '/athletes-management' },
                { label: profileData.athlete?.name || 'Perfil', path: '#', active: true }
              ]} 
            />

            {/* HEADER */}
            <AthleteHeader 
              athlete={profileData.athlete} 
              loading={loading}
              onExport={handleExportPDF}
            />

            {/* KPI STRIP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {loading ? (
                 [1,2,3,4].map(i => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse"></div>)
              ) : (
                 kpiStats.map((stat, i) => <MetricCard key={i} {...stat} />)
              )}
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* LEFT COLUMN (2/3) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* TABS DE NAVEGACIÓN */}
                <div className="bg-card border border-border rounded-xl p-1 overflow-x-auto">
                  <div className="flex space-x-1 min-w-max">
                    {['performance', 'attendance', 'payments'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeTab === tab 
                            ? 'bg-primary text-primary-foreground shadow-sm' 
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CONTENIDO DE TABS */}
                <div className="min-h-[400px]">
                  {activeTab === 'performance' && (
                    <PerformanceChart 
                      data={profileData.metrics} 
                      loading={loading} 
                    />
                  )}
                  {activeTab === 'attendance' && (
                    <AttendanceCalendar 
                      data={profileData.attendance} 
                      loading={loading} 
                    />
                  )}
                  {activeTab === 'payments' && (
                    <PaymentHistory 
                      payments={profileData.payments} 
                      loading={loading} 
                    />
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN (1/3) */}
              <div className="space-y-6">
                <HealthMetrics 
                  metrics={profileData.latestMetrics} 
                  loading={loading} 
                />
                
                <UpcomingSessions 
                  sessions={profileData.sessions} 
                  loading={loading} 
                />
                
                <CoachNotes 
                  notes={profileData.notes} 
                  onAddNote={handleAddNote} 
                  loading={loading} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IndividualAthleteProfile;