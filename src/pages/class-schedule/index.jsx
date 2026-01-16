import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  isToday, 
  startOfDay, 
  getHours,
  getMinutes 
} from 'date-fns';
import { es } from 'date-fns/locale'; // Para fechas en Español

import { supabase } from '../../lib/supabaseClient';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

// Modales
import ClassSlotModal from './components/ClassSlotModal';
import ActivityManagerModal from './components/ActivityManagerModal';

// --- COMPONENTES INTERNOS PARA ORDEN Y CLARIDAD ---

// 1. Tarjeta de Clase Ultra Detallada
const ScheduleCard = ({ cls, onClick, styles }) => {
  // Calculamos porcentaje de ocupación visual
  const occupancy = Math.min((15 / cls.capacity) * 100, 100); // Dummy data: asumiendo 15 inscritos
  const isFull = occupancy >= 100;

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick(cls); }}
      className="group relative w-full rounded-lg border border-l-4 p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer bg-card overflow-hidden"
      style={{ borderLeftColor: cls.class_types?.color }}
    >
      {/* Fondo sutil con el color de la actividad */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundColor: cls.class_types?.color }} 
      />

      {/* Header: Hora y Actividad */}
      <div className="flex justify-between items-start mb-1 relative z-10">
        <span className="font-bold text-xs truncate pr-1" style={{ color: cls.class_types?.color }}>
          {cls.class_types?.name}
        </span>
        <div className="flex items-center text-[10px] font-mono text-muted-foreground bg-background/80 px-1 rounded border border-border">
          {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
        </div>
      </div>

      {/* Profesores (Avatares apilados) */}
      <div className="flex items-center justify-between mt-2 relative z-10">
        <div className="flex -space-x-1.5 overflow-hidden py-0.5">
          {cls.schedule_coaches?.length > 0 ? (
            cls.schedule_coaches.map((sc, idx) => (
              <div 
                key={idx} 
                className="w-6 h-6 rounded-full border border-background bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shadow-sm"
                title={sc.coaches?.profiles?.full_name}
              >
                {sc.coaches?.profiles?.avatar_url ? (
                  <img src={sc.coaches.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  sc.coaches?.profiles?.full_name?.substring(0, 2).toUpperCase() || '??'
                )}
              </div>
            ))
          ) : (
            <span className="text-[10px] text-error italic flex items-center gap-1">
              <Icon name="AlertCircle" size={10} /> Asignar
            </span>
          )}
        </div>
      </div>

      {/* Barra de Capacidad (Simulada para visual) */}
      <div className="mt-2 relative z-10">
        <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
          <span>Cupo</span>
          <span>{cls.capacity} pax</span>
        </div>
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${isFull ? 'bg-error' : 'bg-primary'}`} 
            style={{ width: '40%' }} // Aquí iría el % real de inscritos
          /> 
        </div>
      </div>

      {/* Botón de Edición Rápida (Solo Hover) */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="p-1 rounded bg-background shadow border border-border text-muted-foreground hover:text-primary">
          <Icon name="Edit" size={10} />
        </div>
      </div>
    </div>
  );
};

// 2. Línea de Tiempo Actual (El "Ahora")
const CurrentTimeLine = () => {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      // Si el gimnasio abre a las 6am, ajustamos el offset
      // Asumimos grilla de 06:00 a 23:00. Cada hora son aprox 140px (ajustable)
      // Esta lógica depende de la altura de tus filas.
      // Simplificación: Solo mostramos la línea si está dentro del rango visible
      if (hours < 6 || hours > 22) return;
      
      // Lógica visual simple: Top relativo
    };
    // updatePosition(); // Requiere cálculo de altura de pixeles exactos.
    // Para esta versión, usaremos un indicador en la columna de la izquierda.
  }, []);

  return null; // Implementación visual compleja, la omito para no romper el layout grid
};


// --- COMPONENTE PRINCIPAL ---

const ClassSchedule = () => {
  // --- ESTADOS ---
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState([]);
  
  // Navegación de Fechas
  const [currentDate, setCurrentDate] = useState(new Date()); // Fecha base para la semana
  
  // Filtros
  const [filterCoach, setFilterCoach] = useState('all');
  const [filterActivity, setFilterActivity] = useState('all');
  
  // Datos Maestros para Filtros
  const [allCoaches, setAllCoaches] = useState([]);
  const [allActivities, setAllActivities] = useState([]);

  // Modales
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showActivityManager, setShowActivityManager] = useState(false);

  // --- CÁLCULOS DE FECHAS ---
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // La semana arranca el Lunes
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Horas del Gimnasio (07:00 a 22:00)
  const hours = Array.from({ length: 16 }, (_, i) => {
    const h = i + 7;
    return `${h < 10 ? '0'+h : h}:00`;
  });

  // --- CARGA DE DATOS ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Schedule
      const { data: schedData, error: schedError } = await supabase
        .from('weekly_schedule')
        .select(`
          id, day_of_week, start_time, end_time, capacity,
          class_types ( id, name, color ),
          schedule_coaches (
            coaches ( id, profiles:profile_id(full_name, avatar_url) )
          )
        `);
      if (schedError) throw schedError;
      setScheduleData(schedData || []);

      // 2. Cargar Maestros para Filtros (Solo la primera vez idealmente, pero ok aquí)
      const { data: coachesData } = await supabase.from('coaches').select('id, profiles(full_name)');
      const { data: activitiesData } = await supabase.from('class_types').select('id, name');
      
      if (coachesData) setAllCoaches(coachesData.map(c => ({ id: c.id, name: c.profiles?.full_name })));
      if (activitiesData) setAllActivities(activitiesData);

    } catch (err) {
      console.error("Error fetching schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LÓGICA DE CLONACIÓN DE SEMANA (FEATURE PREMIUM) ---
  const handleCopyPreviousWeek = async () => {
    if (!window.confirm("⚠️ ¿Estás seguro? Esto borrará la semana actual y copiará la estructura base.")) return;
    // NOTA: Como estamos usando 'weekly_schedule' que es genérico (Lunes, Martes...), 
    // en realidad este botón no es necesario a menos que tengamos una tabla por fechas específicas.
    // Si tu tabla es 'weekly_schedule' (Lunes genérico), los cambios aplican a TODAS las semanas.
    // **ASUMIREMOS QUE LA GRILLA ES GENÉRICA SEMANAL PARA ESTA IMPLEMENTACIÓN.**
    alert("Como estás editando la 'Grilla Base Semanal', los cambios se replican automáticamente en todas las semanas futuras.");
  };

  // --- FILTRADO INTELIGENTE ---
  const filteredSchedule = useMemo(() => {
    return scheduleData.filter(item => {
      // Filtro Coach
      if (filterCoach !== 'all') {
        const hasCoach = item.schedule_coaches.some(sc => sc.coaches.id === filterCoach);
        if (!hasCoach) return false;
      }
      // Filtro Actividad
      if (filterActivity !== 'all') {
        if (item.class_types?.id !== filterActivity) return false;
      }
      return true;
    });
  }, [scheduleData, filterCoach, filterActivity]);

  // Helper para obtener clases de una celda
  const getClassesForCell = (dayIndex, hourStr) => {
    // dayIndex: 1 (Lunes) ... 7 (Domingo) -- date-fns usa 1=Lunes si configuramos isoWeek, o 0=Domingo
    // Ajuste: date-fns getDay() devuelve 0 para Domingo, 1 Lunes.
    // Nuestra DB: 1=Lunes ... 7=Domingo? O 0=Domingo?
    // Asumiremos standard ISO: 1=Lunes, 7=Domingo.
    
    // Convertimos date-fns day (0-6) a nuestro DB day.
    // Si weekDays[0] es Lunes, su .getDay() es 1.
    
    return filteredSchedule.filter(s => {
      // DB: 1=Lunes. Hour: "10:00"
      return s.day_of_week === dayIndex && s.start_time.startsWith(hourStr.split(':')[0]);
    });
  };

  // --- HANDLERS ---
  const handleSlotClick = (dayIndex, hourStr, existingClass = null) => {
    if (existingClass) {
      const coachIds = existingClass.schedule_coaches.map(sc => sc.coaches.id);
      setSelectedSlot({
        id: existingClass.id,
        classTypeId: existingClass.class_types?.id,
        coachIds: coachIds,
        dayOfWeek: dayIndex,
        startTime: existingClass.start_time,
        endTime: existingClass.end_time,
        capacity: existingClass.capacity
      });
    } else {
      // Nuevo Slot
      // hourStr es "07:00".
      const startH = parseInt(hourStr.split(':')[0]);
      const endH = startH + 1;
      const endStr = `${endH < 10 ? '0'+endH : endH}:00`;

      setSelectedSlot({
        dayOfWeek: dayIndex,
        startTime: hourStr,
        endTime: endStr
      });
    }
  };

  // Métricas Rápidas
  const totalClasses = filteredSchedule.length;
  const totalHours = filteredSchedule.reduce((acc, curr) => {
    const start = parseInt(curr.start_time.split(':')[0]);
    const end = parseInt(curr.end_time.split(':')[0]);
    return acc + (end - start);
  }, 0);


  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <NavigationSidebar userRole="admin" />
      
      <div className="flex-1 ml-20 lg:ml-60 transition-all flex flex-col h-screen overflow-hidden">
        
        {/* --- 1. HEADER PREMIUM --- */}
        <div className="bg-background border-b border-border shadow-sm z-30">
          <div className="px-6 py-4">
            <Helmet><title>Agenda Maestra - DigitalMatch</title></Helmet>
            
            {/* Título y Acciones Principales */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <BreadcrumbTrail items={[{ label: 'Gestión', path: '#' }, { label: 'Agenda Maestra', path: '#', active: true }]} />
                <h1 className="text-2xl font-heading font-bold text-foreground mt-1">Agenda Semanal</h1>
              </div>
              
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setShowActivityManager(true)} iconName="Settings">
                  Configurar Actividades
                </Button>
                <Button variant="default" size="sm" iconName="Save" onClick={handleCopyPreviousWeek}>
                  Guardar Plantilla
                </Button>
              </div>
            </div>

            {/* Barra de Herramientas (Navegación y Filtros) */}
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-end xl:items-center bg-muted/20 p-3 rounded-lg border border-border">
              
              {/* Navegación de Fechas (Visual) */}
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-card rounded-md border border-border shadow-sm p-1">
                  <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name="ChevronLeft" size={18} />
                  </button>
                  <div className="px-4 font-medium text-sm w-32 text-center">
                    {format(weekStart, 'MMM yyyy', { locale: es }).toUpperCase()}
                  </div>
                  <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name="ChevronRight" size={18} />
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Volver a Hoy
                </button>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Filter" size={14} />
                  <span className="font-bold text-xs uppercase">Filtros:</span>
                </div>
                
                <select 
                  className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[140px]"
                  value={filterCoach}
                  onChange={(e) => setFilterCoach(e.target.value)}
                >
                  <option value="all">Todos los Profes</option>
                  {allCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <select 
                  className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[140px]"
                  value={filterActivity}
                  onChange={(e) => setFilterActivity(e.target.value)}
                >
                  <option value="all">Todas las Clases</option>
                  {allActivities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                
                {/* Métricas en línea */}
                <div className="hidden md:flex items-center gap-4 ml-4 pl-4 border-l border-border opacity-70">
                  <div className="text-xs">
                    <span className="block font-bold text-foreground">{totalClasses}</span>
                    <span className="text-muted-foreground">Clases</span>
                  </div>
                  <div className="text-xs">
                    <span className="block font-bold text-foreground">{totalHours}h</span>
                    <span className="text-muted-foreground">Carga</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 2. GRILLA COMPLEJA (SCROLLABLE) --- */}
        <div className="flex-1 overflow-auto bg-white/50 custom-scrollbar relative">
          <div className="min-w-[1200px] pb-20"> {/* Ancho mínimo forzado para evitar squashing */}
            
            {/* Cabecera de Días (Sticky) */}
            <div className="sticky top-0 z-20 grid grid-cols-[60px_repeat(7,_1fr)] border-b border-border bg-background shadow-sm">
              <div className="p-4 border-r border-border bg-muted/5 flex items-center justify-center">
                <Icon name="Clock" size={16} className="text-muted-foreground" />
              </div>
              {weekDays.map((day, index) => {
                const isCurrentDay = isToday(day);
                return (
                  <div key={index} className={`p-3 border-r border-border last:border-r-0 text-center ${isCurrentDay ? 'bg-primary/5' : 'bg-muted/5'}`}>
                    <span className={`text-xs font-bold uppercase tracking-wider block ${isCurrentDay ? 'text-primary' : 'text-muted-foreground'}`}>
                      {format(day, 'EEE', { locale: es })}
                    </span>
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mt-1 text-sm font-bold ${isCurrentDay ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cuerpo del Calendario */}
            <div className="relative">
              {/* Indicador de Hora Actual (Línea Roja - Solo visual simplificado) */}
              {isSameDay(currentDate, new Date()) && (
                <div 
                  className="absolute left-0 right-0 border-t-2 border-error z-10 pointer-events-none opacity-50"
                  style={{ top: `${(getHours(new Date()) - 7) * 128 + (getMinutes(new Date()) * 2)}px` }} // Cálculo aproximado
                >
                  <span className="absolute -top-2.5 left-1 bg-error text-white text-[10px] px-1 rounded font-bold">AHORA</span>
                </div>
              )}

              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,_1fr)] min-h-[128px]"> {/* Altura fija para consistencia */}
                  
                  {/* Columna Hora */}
                  <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r border-border border-b border-dashed border-border/50 flex justify-center pt-2">
                    <span className="text-xs font-mono text-muted-foreground -mt-3 bg-background px-1">
                      {hour}
                    </span>
                  </div>

                  {/* Celdas de Días */}
                  {weekDays.map((day, dayIndex) => {
                    // Mapeamos el índice del loop (0-6) al índice DB (1-7, Lunes=1)
                    // getDay(): 0=Domingo, 1=Lunes.
                    // Ajustamos para que coincida con nuestra DB donde 1=Lunes.
                    const jsDay = day.getDay(); // 0 (Dom) a 6 (Sab)
                    const dbDay = jsDay === 0 ? 7 : jsDay; // Convertimos Domingo(0) a 7. 1=Lunes.

                    const classes = getClassesForCell(dbDay, hour);
                    const isCurrentDay = isToday(day);

                    return (
                      <div 
                        key={`${dbDay}-${hour}`}
                        className={`
                          relative border-r border-b border-border/50 border-dashed p-1 flex flex-col gap-1 transition-colors
                          ${isCurrentDay ? 'bg-primary/[0.02]' : ''}
                          hover:bg-muted/10 group
                        `}
                      >
                        {/* Botón Agregar (+) Fantasma */}
                        <div 
                          className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 flex justify-center items-center pointer-events-none"
                        >
                           {/* Click area catch */}
                        </div>
                        
                        <button
                          onClick={() => handleSlotClick(dbDay, hour)}
                          className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                          title="Crear clase"
                        >
                          <Icon name="Plus" size={12} />
                        </button>

                        {/* Renderizado de Clases */}
                        {classes.map(cls => (
                          <ScheduleCard 
                            key={cls.id} 
                            cls={cls} 
                            onClick={(c) => handleSlotClick(dbDay, hour, c)} 
                          />
                        ))}
                        
                        {/* Click area para celdas vacías */}
                        {classes.length === 0 && (
                          <div 
                            className="flex-1 cursor-pointer" 
                            onClick={() => handleSlotClick(dbDay, hour)}
                            title="Click para agregar clase"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALES --- */}
      {selectedSlot && (
        <ClassSlotModal 
          slotInfo={selectedSlot} 
          onClose={() => setSelectedSlot(null)}
          onSuccess={() => { fetchData(); setSelectedSlot(null); }}
        />
      )}

      {showActivityManager && (
        <ActivityManagerModal 
          onClose={() => setShowActivityManager(false)} 
        />
      )}
    </div>
  );
};

export default ClassSchedule;