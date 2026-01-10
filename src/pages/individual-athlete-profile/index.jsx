import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
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
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('performance');
  const [viewPeriod, setViewPeriod] = useState('monthly');

  const athleteData = {
    id: "ATH-2024-001",
    name: "Carlos Rodríguez Martínez",
    email: "carlos.rodriguez@email.com",
    phone: "+34 612 345 678",
    photo: "https://img.rocket.new/generatedImages/rocket_gen_img_1fa9e44fc-1763295892954.png",
    photoAlt: "Atleta masculino hispano de 28 años con cabello corto negro, sonrisa confiada, vistiendo camiseta deportiva roja de entrenamiento",
    joinDate: "15/03/2024",
    status: "active",
    membershipType: "premium"
  };

  const metricsData = [
  {
    title: "Tasa de Asistencia",
    value: "92",
    unit: "%",
    change: "+5%",
    changeType: "positive",
    icon: "Calendar",
    iconColor: "var(--color-primary)"
  },
  {
    title: "Evolución de Rendimiento",
    value: "85",
    unit: "/100",
    change: "+12%",
    changeType: "positive",
    icon: "TrendingUp",
    iconColor: "var(--color-success)"
  },
  {
    title: "Estado de Pago",
    value: "Al día",
    unit: "",
    change: "0 pendientes",
    changeType: "neutral",
    icon: "CheckCircle",
    iconColor: "var(--color-success)"
  },
  {
    title: "Valoración Coach",
    value: "4.8",
    unit: "/5",
    change: "+0.3",
    changeType: "positive",
    icon: "Star",
    iconColor: "var(--color-secondary)"
  },
  {
    title: "Sesiones Completadas",
    value: "48",
    unit: "sesiones",
    change: "+8",
    changeType: "positive",
    icon: "Activity",
    iconColor: "var(--color-accent)"
  },
  {
    title: "Próxima Sesión",
    value: "Mañana",
    unit: "10:00",
    change: "Fuerza",
    changeType: "neutral",
    icon: "Clock",
    iconColor: "var(--color-warning)"
  }];


  const performanceData = [
  { date: "Ene", fuerza: 65, resistencia: 70, tecnica: 68 },
  { date: "Feb", fuerza: 68, resistencia: 72, tecnica: 70 },
  { date: "Mar", fuerza: 72, resistencia: 75, tecnica: 73 },
  { date: "Abr", fuerza: 75, resistencia: 78, tecnica: 76 },
  { date: "May", fuerza: 78, resistencia: 80, tecnica: 79 },
  { date: "Jun", fuerza: 82, resistencia: 83, tecnica: 82 },
  { date: "Jul", fuerza: 85, resistencia: 85, tecnica: 84 },
  { date: "Ago", fuerza: 87, resistencia: 87, tecnica: 86 }];


  const attendanceData = [
  { day: 2, type: "Fuerza", intensity: "high" },
  { day: 4, type: "Cardio", intensity: "medium" },
  { day: 7, type: "Técnica", intensity: "low" },
  { day: 9, type: "Fuerza", intensity: "high" },
  { day: 11, type: "Cardio", intensity: "medium" },
  { day: 14, type: "Técnica", intensity: "low" },
  { day: 16, type: "Fuerza", intensity: "high" },
  { day: 18, type: "Cardio", intensity: "high" },
  { day: 21, type: "Técnica", intensity: "medium" },
  { day: 23, type: "Fuerza", intensity: "high" },
  { day: 25, type: "Cardio", intensity: "medium" },
  { day: 28, type: "Técnica", intensity: "low" },
  { day: 30, type: "Fuerza", intensity: "high" }];


  const paymentHistory = [
  {
    id: "PAY-001",
    description: "Mensualidad Agosto 2026",
    amount: "150.00",
    date: "01/08/2026",
    status: "paid",
    method: "Tarjeta de crédito"
  },
  {
    id: "PAY-002",
    description: "Mensualidad Julio 2026",
    amount: "150.00",
    date: "01/07/2026",
    status: "paid",
    method: "Transferencia bancaria"
  },
  {
    id: "PAY-003",
    description: "Mensualidad Junio 2026",
    amount: "150.00",
    date: "01/06/2026",
    status: "paid",
    method: "Tarjeta de crédito"
  },
  {
    id: "PAY-004",
    description: "Sesión Personal Extra",
    amount: "45.00",
    date: "15/05/2026",
    status: "paid",
    method: "Efectivo"
  }];


  const [coachNotes, setCoachNotes] = useState([
  {
    id: "NOTE-001",
    author: "Entrenador Miguel Sánchez",
    timestamp: "08/01/2026 14:30",
    content: "Excelente progreso en ejercicios de fuerza. Ha aumentado su capacidad de levantamiento en un 15% este mes. Recomiendo mantener la intensidad actual y añadir ejercicios de estabilidad core."
  },
  {
    id: "NOTE-002",
    author: "Entrenador Miguel Sánchez",
    timestamp: "02/01/2026 10:15",
    content: "Mostró gran determinación durante la sesión de cardio de alta intensidad. Necesita trabajar en la técnica de respiración para optimizar el rendimiento en ejercicios prolongados."
  },
  {
    id: "NOTE-003",
    author: "Entrenador Ana López",
    timestamp: "28/12/2025 16:45",
    content: "Sesión de evaluación completada. El atleta muestra mejoras significativas en flexibilidad y movilidad articular. Continuar con estiramientos dinámicos pre-entrenamiento."
  }]
  );

  const upcomingSessions = [
  {
    id: "SES-001",
    title: "Entrenamiento de Fuerza - Tren Superior",
    type: "fuerza",
    date: "11/01/2026",
    time: "10:00 - 11:30",
    location: "Sala Principal"
  },
  {
    id: "SES-002",
    title: "Cardio HIIT Avanzado",
    type: "cardio",
    date: "13/01/2026",
    time: "18:00 - 19:00",
    location: "Zona Cardio"
  },
  {
    id: "SES-003",
    title: "Técnica y Movilidad",
    type: "tecnica",
    date: "15/01/2026",
    time: "09:00 - 10:00",
    location: "Sala de Estiramientos"
  }];


  const healthMetrics = [
  {
    type: "weight",
    label: "Peso Corporal",
    value: "78.5",
    unit: "kg",
    change: -2.3,
    lastUpdate: "10/01/2026"
  },
  {
    type: "height",
    label: "Altura",
    value: "178",
    unit: "cm",
    change: null,
    lastUpdate: "15/03/2024"
  },
  {
    type: "bmi",
    label: "Índice de Masa Corporal",
    value: "24.8",
    unit: "IMC",
    change: -1.5,
    lastUpdate: "10/01/2026"
  },
  {
    type: "bodyFat",
    label: "Grasa Corporal",
    value: "15.2",
    unit: "%",
    change: -3.8,
    lastUpdate: "10/01/2026"
  },
  {
    type: "heartRate",
    label: "Frecuencia Cardíaca en Reposo",
    value: "58",
    unit: "bpm",
    change: -5.2,
    lastUpdate: "10/01/2026"
  },
  {
    type: "bloodPressure",
    label: "Presión Arterial",
    value: "120/80",
    unit: "mmHg",
    change: null,
    lastUpdate: "10/01/2026"
  }];


  const handleScheduleSession = () => {
    console.log("Programar sesión para:", athleteData?.name);
  };

  const handleSendMessage = () => {
    console.log("Enviar mensaje a:", athleteData?.name);
  };

  const handlePaymentReminder = () => {
    console.log("Enviar recordatorio de pago a:", athleteData?.name);
  };

  const handleAddNote = (noteContent) => {
    const newNote = {
      id: `NOTE-${String(coachNotes?.length + 1)?.padStart(3, '0')}`,
      author: "Entrenador Miguel Sánchez",
      timestamp: new Date()?.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      content: noteContent
    };
    setCoachNotes([newNote, ...coachNotes]);
  };

  const handleExportPDF = async () => {
    try {
      await generateAthletePDF(
        athleteData,
        performanceData,
        attendanceData,
        paymentHistory,
        coachNotes
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
    }
  };

  const tabs = [
  { id: 'performance', label: 'Rendimiento', icon: 'TrendingUp' },
  { id: 'attendance', label: 'Asistencia', icon: 'Calendar' },
  { id: 'payments', label: 'Pagos', icon: 'CreditCard' }];


  const periodOptions = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
  { id: 'yearly', label: 'Anual' }];


  return (
    <div className="min-h-screen bg-background">
      <NavigationSidebar
        isCollapsed={isSidebarCollapsed}
        userRole="coach"
        alertData={{ dashboard: 3, atletas: 5, rendimiento: 2, pagos: 8 }} />

      <div className={`transition-smooth ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <BreadcrumbTrail
            currentPath={location?.pathname}
            entityData={{
              athleteName: athleteData?.name,
              athleteId: athleteData?.id
            }} />


          <AthleteHeader
            athlete={athleteData}
            onScheduleSession={handleScheduleSession}
            onSendMessage={handleSendMessage}
            onPaymentReminder={handlePaymentReminder} />


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-6 mb-4 md:mb-6">
            {metricsData?.map((metric, index) =>
            <MetricCard key={index} {...metric} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              <div className="bg-card border border-border rounded-lg p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                    {tabs?.map((tab) =>
                    <button
                      key={tab?.id}
                      onClick={() => setActiveTab(tab?.id)}
                      className={`
                          flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm md:text-base font-medium
                          transition-smooth whitespace-nowrap flex-shrink-0
                          ${activeTab === tab?.id ?
                      'bg-primary text-primary-foreground shadow-glow-primary' :
                      'text-muted-foreground hover:text-foreground hover:bg-muted'}
                        `
                      }>

                        <Icon name={tab?.icon} size={18} />
                        <span>{tab?.label}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {periodOptions?.map((period) =>
                    <button
                      key={period?.id}
                      onClick={() => setViewPeriod(period?.id)}
                      className={`
                          px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-smooth
                          ${viewPeriod === period?.id ?
                      'bg-accent/20 text-accent border border-accent/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
                        `
                      }>

                        {period?.label}
                      </button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      iconName="Download"
                      iconPosition="left"
                      onClick={handleExportPDF}
                      className="ml-2">

                      <span className="hidden sm:inline">Exportar</span>
                      <span className="sm:hidden">PDF</span>
                    </Button>
                  </div>
                </div>

                {activeTab === 'performance' &&
                <div>
                    <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
                      Evolución de Rendimiento
                    </h3>
                    <PerformanceChart data={performanceData} period={viewPeriod} />
                    <div className="mt-4 md:mt-6 p-3 md:p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-start gap-2 md:gap-3">
                        <Icon name="Target" size={20} color="var(--color-secondary)" className="flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm md:text-base font-medium text-foreground mb-1">
                            Objetivo Actual: Alcanzar 90 puntos en todas las métricas
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            Progreso: 85/90 (94% completado) - Fecha objetivo: 31/12/2026
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                }

                {activeTab === 'attendance' &&
                <div>
                    <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
                      Calendario de Asistencia - Enero 2026
                    </h3>
                    <AttendanceCalendar
                    attendanceData={attendanceData}
                    currentMonth="Enero 2026" />

                  </div>
                }

                {activeTab === 'payments' &&
                <div>
                    <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
                      Historial de Pagos
                    </h3>
                    <PaymentHistory payments={paymentHistory} />
                  </div>
                }
              </div>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="bg-card border border-border rounded-lg p-4 md:p-6">
                <CoachNotes notes={coachNotes} onAddNote={handleAddNote} />
              </div>

              <div className="bg-card border border-border rounded-lg p-4 md:p-6">
                <UpcomingSessions sessions={upcomingSessions} />
              </div>

              <div className="bg-card border border-border rounded-lg p-4 md:p-6">
                <HealthMetrics metrics={healthMetrics} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

};

export default IndividualAthleteProfile;