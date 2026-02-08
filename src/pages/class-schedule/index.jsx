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
  getHours,
  getMinutes 
} from 'date-fns';
import { es } from 'date-fns/locale';

import { supabase } from '../../lib/supabaseClient';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

// Modales
import ClassSlotModal from './components/ClassSlotModal';
import ActivityManagerModal from './components/ActivityManagerModal';

// --- COMPONENTES INTERNOS ---

const ScheduleCard = ({ cls, onClick }) => {
  // Mantenemos tu lógica original de ocupación
  const occupancy = Math.min((15 / cls.capacity) * 100, 100);
  const isFull = occupancy >= 100;

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick(cls); }}
      className="group relative w-full rounded-lg border border-l-4 p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer bg-card overflow-hidden"
      style={{ borderLeftColor: cls.class_types?.color }}
    >
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundColor: cls.class_types?.color }} 
      />

      <div className="flex justify-between items-start mb-1 relative z-10">
        <span className="font-bold text-[10px] md:text-xs truncate pr-1" style={{ color: cls.class_types?.color }}>
          {cls.class_types?.name}
        </span>
        <div className="flex items-center text-[9px] md:text-[10px] font-mono text-muted-foreground bg-background/80 px-1 rounded border border-border">
          {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 relative z-10">
        <div className="flex -space-x-1.5 overflow-hidden py-0.5">
          {cls.schedule_coaches?.length > 0 ? (
            cls.schedule_coaches.map((sc, idx) => (
              <div 
                key={idx} 
                className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-background bg-muted flex items-center justify-center text-[8px] md:text-[9px] font-bold text-muted-foreground shadow-sm"
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
            <span className="text-[9px] md:text-[10px] text-error italic flex items-center gap-1">
              <Icon name="AlertCircle" size={10} /> Asignar
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 relative z-10">
        <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
          <span>Cupo</span>
          <span>{cls.capacity} pax</span>
        </div>
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${isFull ? 'bg-error' : 'bg-primary'}`} 
            style={{ width: '40%' }} // Mantengo tu valor estático original del 40% o puedes usar `${occupancy}%`
          /> 
        </div>
      </div>

      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="p-1 rounded bg-background shadow border border-border text-muted-foreground hover:text-primary">
          <Icon name="Edit" size={10} />
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

const ClassSchedule = () => {
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterCoach, setFilterCoach] = useState('all');
  const [filterActivity, setFilterActivity] = useState('all');
  const [allCoaches, setAllCoaches] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showActivityManager, setShowActivityManager] = useState(false);
  
  // Nuevo estado para la vista mobile (Día actual por defecto)
  const [mobileDayView, setMobileDayView] = useState(new Date().getDay() || 7);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const hours = Array.from({ length: 16 }, (_, i) => {
    const h = i + 7;
    return `${h < 10 ? '0'+h : h}:00`;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
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

  useEffect(() => { fetchData(); }, []);

  const handleCopyPreviousWeek = async () => {
    if (!window.confirm("⚠️ ¿Estás seguro? Esto borrará la semana actual y copiará la estructura base.")) return;
    alert("Como estás editando la 'Grilla Base Semanal', los cambios se replican automáticamente.");
  };

  const filteredSchedule = useMemo(() => {
    return scheduleData.filter(item => {
      if (filterCoach !== 'all' && !item.schedule_coaches.some(sc => sc.coaches.id === filterCoach)) return false;
      if (filterActivity !== 'all' && item.class_types?.id !== filterActivity) return false;
      return true;
    });
  }, [scheduleData, filterCoach, filterActivity]);

  const getClassesForCell = (dayIndex, hourStr) => {
    return filteredSchedule.filter(s => {
      return s.day_of_week === dayIndex && s.start_time.startsWith(hourStr.split(':')[0]);
    });
  };

  const handleSlotClick = (dayIndex, hourStr, existingClass = null) => {
    if (existingClass) {
      setSelectedSlot({
        id: existingClass.id,
        classTypeId: existingClass.class_types?.id,
        coachIds: existingClass.schedule_coaches.map(sc => sc.coaches.id),
        dayOfWeek: dayIndex,
        startTime: existingClass.start_time,
        endTime: existingClass.end_time,
        capacity: existingClass.capacity
      });
    } else {
      const startH = parseInt(hourStr.split(':')[0]);
      const endStr = `${startH + 1 < 10 ? '0'+(startH+1) : startH + 1}:00`;
      setSelectedSlot({ dayOfWeek: dayIndex, startTime: hourStr, endTime: endStr });
    }
  };

  // Mantenemos tus cálculos de totales originales
  const totalClasses = filteredSchedule.length;
  const totalHours = filteredSchedule.reduce((acc, curr) => {
    const start = parseInt(curr.start_time.split(':')[0]);
    const end = parseInt(curr.end_time.split(':')[0]);
    return acc + (end - start);
  }, 0);

  return (
    <>
      <Helmet><title>Agenda Maestra - DMG Fitness</title></Helmet>
      
      <div className="flex flex-col h-screen overflow-hidden w-full bg-background">
        
        {/* HEADER REDISEÑADO PERO CON TUS DATOS */}
        <div className="bg-card border-b border-border shadow-sm z-30 flex-shrink-0">
          <div className="px-4 md:px-6 py-4">
            
            <div className="flex justify-between items-center gap-4 mb-4">
              <div>
                <BreadcrumbTrail 
                  items={[
                    { label: 'Gestión', path: '#' }, 
                    { label: 'Agenda Maestra', active: true }
                  ]} 
                />
                <h1 className="text-xl md:text-3xl font-heading font-bold text-foreground mt-1">
                  Agenda Semanal
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowActivityManager(true)} iconName="Settings" className="hidden md:flex">
                  Configurar
                </Button>
                <Button variant="default" size="sm" iconName="Save" onClick={handleCopyPreviousWeek}>
                  <span className="hidden md:inline">Guardar Plantilla</span>
                  <span className="md:hidden">Guardar</span>
                </Button>
              </div>
            </div>

            {/* Toolbar con tus filtros y stats */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-muted/20 p-2 rounded-lg border border-border">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex items-center bg-card rounded-md border border-border p-1">
                  <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-1 hover:bg-muted rounded transition-colors">
                    <Icon name="ChevronLeft" size={16} />
                  </button>
                  <div className="px-2 font-bold text-[10px] md:text-xs w-24 md:w-32 text-center uppercase">
                    {format(weekStart, 'MMM yyyy', { locale: es })}
                  </div>
                  <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-1 hover:bg-muted rounded transition-colors">
                    <Icon name="ChevronRight" size={16} />
                  </button>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-bold text-primary hover:underline uppercase">Hoy</button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select className="flex-1 md:w-40 h-8 rounded-md border border-border bg-card px-2 text-xs outline-none" value={filterCoach} onChange={(e) => setFilterCoach(e.target.value)}>
                  <option value="all">Todos los Profes</option>
                  {allCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="flex-1 md:w-40 h-8 rounded-md border border-border bg-card px-2 text-xs outline-none" value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)}>
                  <option value="all">Todas las Clases</option>
                  {allActivities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                
                {/* Stats recuperados */}
                <div className="hidden lg:flex items-center gap-3 ml-2 pl-3 border-l border-border opacity-70">
                  <div className="text-[10px]"><span className="block font-bold leading-none">{totalClasses}</span><span className="text-muted-foreground uppercase">Clases</span></div>
                  <div className="text-[10px]"><span className="block font-bold leading-none">{totalHours}h</span><span className="text-muted-foreground uppercase">Carga</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Selector de días para Mobile */}
          <div className="flex md:hidden border-t border-border bg-muted/5 overflow-x-auto no-scrollbar">
            {weekDays.map((day, idx) => {
              const dbDay = (idx + 1);
              const active = mobileDayView === dbDay;
              return (
                <button 
                  key={idx}
                  onClick={() => setMobileDayView(dbDay)}
                  className={`flex-1 py-3 px-2 flex flex-col items-center min-w-[55px] transition-all border-b-2 ${active ? 'border-primary bg-primary/5' : 'border-transparent opacity-50'}`}
                >
                  <span className="text-[9px] font-bold uppercase">{format(day, 'EEE', { locale: es })}</span>
                  <span className={`text-sm font-black ${active ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* GRILLA UNIFICADA */}
        <div className="flex-1 overflow-auto bg-white/50 custom-scrollbar relative">
          <div className="md:min-w-[1200px] pb-20">
            
            {/* Cabecera Desktop */}
            <div className="hidden md:grid sticky top-0 z-20 grid-cols-[60px_repeat(7,_1fr)] border-b border-border bg-background shadow-sm">
              <div className="p-4 border-r border-border bg-muted/5 flex items-center justify-center">
                <Icon name="Clock" size={16} className="text-muted-foreground" />
              </div>
              {weekDays.map((day, index) => (
                <div key={index} className={`p-3 border-r border-border last:border-r-0 text-center ${isToday(day) ? 'bg-primary/5' : 'bg-muted/5'}`}>
                  <span className={`text-xs font-bold uppercase block ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>{format(day, 'EEE', { locale: es })}</span>
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mt-1 text-sm font-bold ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>{format(day, 'd')}</div>
                </div>
              ))}
            </div>

            {/* Cuerpo */}
            <div className="relative">
              {/* Línea de TIEMPO REAL (Recuperada) */}
              {isSameDay(currentDate, new Date()) && (
                <div className="absolute left-0 right-0 border-t-2 border-error z-10 pointer-events-none opacity-40 md:opacity-50"
                  style={{ top: `${(getHours(new Date()) - 7) * 128 + (getMinutes(new Date()) * 2.1)}px` }}
                >
                  <span className="absolute -top-2.5 left-14 md:left-1 bg-error text-white text-[8px] md:text-[10px] px-1 rounded font-bold uppercase">Ahora</span>
                </div>
              )}

              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-[50px_1fr] md:grid-cols-[60px_repeat(7,_1fr)] min-h-[100px] md:min-h-[128px]">
                  
                  <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r border-border border-b border-dashed border-border/50 flex justify-center pt-2">
                    <span className="text-[10px] md:text-xs font-mono text-muted-foreground -mt-3 bg-background px-1">
                      {hour}
                    </span>
                  </div>

                  {weekDays.map((day, dayIndex) => {
                    const dbDay = dayIndex + 1;
                    const classes = getClassesForCell(dbDay, hour);
                    const isVisible = mobileDayView === dbDay;

                    return (
                      <div 
                        key={`${dbDay}-${hour}`}
                        className={`
                          relative border-r border-b border-border/50 border-dashed p-1 flex flex-col gap-1 transition-colors
                          ${!isVisible ? 'hidden md:flex' : 'flex'}
                          ${isToday(day) ? 'bg-primary/[0.02]' : ''}
                          hover:bg-muted/10 group
                        `}
                      >
                        <button
                          onClick={() => handleSlotClick(dbDay, hour)}
                          className="absolute bottom-1 right-1 z-20 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-primary text-white shadow-lg transition-all scale-90 hover:scale-100"
                        >
                          <Icon name="Plus" size={12} />
                        </button>

                        {classes.map(cls => (
                          <ScheduleCard key={cls.id} cls={cls} onClick={(c) => handleSlotClick(dbDay, hour, c)} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODALES MANTENIDOS IGUAL */}
      {selectedSlot && (
        <ClassSlotModal 
          slotInfo={selectedSlot} 
          onClose={() => setSelectedSlot(null)}
          onSuccess={() => { fetchData(); setSelectedSlot(null); }}
        />
      )}
      {showActivityManager && (
        <ActivityManagerModal onClose={() => setShowActivityManager(false)} />
      )}
    </>
  );
};

export default ClassSchedule;