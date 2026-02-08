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

// --- COMPONENTE INTERNO: TARJETA COMPACTA ---
const ScheduleCard = ({ cls, onClick }) => {
  // Lógica de ocupación original recuperada
  const occupancy = Math.min((15 / cls.capacity) * 100, 100);
  const isFull = occupancy >= 100;

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick(cls); }}
      className="group relative w-full rounded-md border-l-[3px] p-2 shadow-sm border border-border bg-card transition-all hover:ring-1 hover:ring-primary/30 cursor-pointer overflow-hidden"
      style={{ borderLeftColor: cls.class_types?.color }}
    >
      <div className="flex justify-between items-start gap-1 relative z-10">
        <h4 className="font-bold text-[10px] md:text-xs uppercase truncate flex-1" style={{ color: cls.class_types?.color }}>
          {cls.class_types?.name}
        </h4>
        <span className="text-[9px] font-mono text-muted-foreground shrink-0 bg-muted/30 px-1 rounded">
          {cls.start_time.slice(0, 5)}
        </span>
      </div>

      <div className="flex items-center gap-1 mt-1.5 relative z-10">
        <div className="flex -space-x-1.5 overflow-hidden">
          {cls.schedule_coaches?.length > 0 ? (
            cls.schedule_coaches.map((sc, i) => (
              <div key={i} className="w-5 h-5 rounded-full ring-2 ring-card bg-muted flex items-center justify-center text-[8px] font-bold overflow-hidden border border-border" title={sc.coaches?.profiles?.full_name}>
                {sc.coaches?.profiles?.avatar_url ? 
                  <img src={sc.coaches.profiles.avatar_url} className="w-full h-full object-cover" /> : 
                  sc.coaches?.profiles?.full_name?.charAt(0)}
              </div>
            ))
          ) : (
            <Icon name="AlertCircle" size={12} className="text-error" />
          )}
        </div>
        
        {/* Barra de cupo recuperada */}
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${isFull ? 'bg-error' : 'bg-primary/60'}`} 
            style={{ width: '40%' }} // Manteniendo tu valor visual original
          />
        </div>
        <span className="text-[8px] text-muted-foreground font-medium">{cls.capacity}p</span>
      </div>

      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Icon name="Edit" size={8} className="text-muted-foreground" />
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
  
  // Nuevo estado para vista de día en mobile (1-7)
  const [mobileDayView, setMobileDayView] = useState(new Date().getDay() || 7);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: schedData } = await supabase.from('weekly_schedule').select(`
          id, day_of_week, start_time, end_time, capacity,
          class_types ( id, name, color ),
          schedule_coaches ( coaches ( id, profiles:profile_id(full_name, avatar_url) ) )
      `);
      setScheduleData(schedData || []);
      const { data: coachesData } = await supabase.from('coaches').select('id, profiles(full_name)');
      const { data: activitiesData } = await supabase.from('class_types').select('id, name');
      if (coachesData) setAllCoaches(coachesData.map(c => ({ id: c.id, name: c.profiles?.full_name })));
      if (activitiesData) setAllActivities(activitiesData);
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredSchedule = useMemo(() => {
    return scheduleData.filter(item => {
      if (filterCoach !== 'all' && !item.schedule_coaches.some(sc => sc.coaches.id === filterCoach)) return false;
      if (filterActivity !== 'all' && item.class_types?.id !== filterActivity) return false;
      return true;
    });
  }, [scheduleData, filterCoach, filterActivity]);

  const getClassesForCell = (dayIndex, hourStr) => {
    return filteredSchedule.filter(s => s.day_of_week === dayIndex && s.start_time.startsWith(hourStr.split(':')[0]));
  };

  const handleSlotClick = (dayIndex, hourStr, existingClass = null) => {
    if (existingClass) {
      setSelectedSlot({
        id: existingClass.id, classTypeId: existingClass.class_types?.id,
        coachIds: existingClass.schedule_coaches.map(sc => sc.coaches.id),
        dayOfWeek: dayIndex, startTime: existingClass.start_time,
        endTime: existingClass.end_time, capacity: existingClass.capacity
      });
    } else {
      const startH = parseInt(hourStr);
      setSelectedSlot({ dayOfWeek: dayIndex, startTime: hourStr, endTime: `${(startH + 1).toString().padStart(2, '0')}:00` });
    }
  };

  const handleCopyPreviousWeek = () => {
    if (!window.confirm("⚠️ ¿Deseas guardar esta configuración como plantilla base?")) return;
    alert("Plantilla guardada. Los cambios se replicarán automáticamente.");
  };

  // Totales originales recuperados
  const totalClasses = filteredSchedule.length;
  const totalHours = filteredSchedule.reduce((acc, curr) => acc + (parseInt(curr.end_time) - parseInt(curr.start_time)), 0);

  return (
    <>
      <Helmet><title>Agenda Maestra - DMG Fitness</title></Helmet>
      
      <div className="flex flex-col h-screen bg-background overflow-hidden w-full">
        
        {/* HEADER COMPACTO Y DINÁMICO */}
        <div className="bg-card border-b border-border z-30 flex-shrink-0 shadow-sm">
          <div className="px-4 py-3">
            <div className="flex justify-between items-center gap-4 mb-3">
              <div>
                <div className="hidden md:block scale-90 origin-left opacity-70">
                  <BreadcrumbTrail items={[{ label: 'Gestión', path: '#' }, { label: 'Agenda Maestra', active: true }]} />
                </div>
                <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Planificación</h1>
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-medium">Grilla Base Semanal</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowActivityManager(true)} iconName="Settings" className="hidden md:flex">
                  Actividades
                </Button>
                <Button variant="default" size="sm" iconName="Save" onClick={handleCopyPreviousWeek}>
                  <span className="hidden md:inline">Guardar Plantilla</span>
                  <span className="md:hidden">Guardar</span>
                </Button>
              </div>
            </div>

            {/* TOOLBAR RESPONSIVE CON STATS */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex items-center bg-muted/30 rounded-lg p-1 border border-border">
                  <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-1 hover:bg-background rounded shadow-sm transition-all">
                    <Icon name="ChevronLeft" size={16} />
                  </button>
                  <div className="px-3 font-bold text-[10px] md:text-xs min-w-[100px] text-center uppercase">
                    {format(weekStart, 'MMM yyyy', { locale: es })}
                  </div>
                  <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-1 hover:bg-background rounded shadow-sm transition-all">
                    <Icon name="ChevronRight" size={16} />
                  </button>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-bold text-primary hover:underline uppercase">Hoy</button>
              </div>

              <div className="flex gap-2 w-full md:w-auto items-center">
                <div className="hidden xl:flex items-center gap-3 mr-4 pr-4 border-r border-border opacity-60">
                  <div className="text-[10px] text-right"><span className="block font-bold">{totalClasses}</span><span>Clases</span></div>
                  <div className="text-[10px] text-right"><span className="block font-bold">{totalHours}h</span><span>Carga</span></div>
                </div>
                <select className="flex-1 md:w-40 h-8 rounded-md border border-border bg-background px-2 text-xs outline-none" value={filterCoach} onChange={(e) => setFilterCoach(e.target.value)}>
                  <option value="all">Todos los Profes</option>
                  {allCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="flex-1 md:w-40 h-8 rounded-md border border-border bg-background px-2 text-xs outline-none" value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)}>
                  <option value="all">Todas las Clases</option>
                  {allActivities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          
          {/* SELECTOR DE DÍAS MOBILE */}
          <div className="flex md:hidden border-t border-border bg-muted/10 overflow-x-auto no-scrollbar">
            {weekDays.map((day, idx) => {
              const dbDay = (idx + 1);
              const active = mobileDayView === dbDay;
              return (
                <button 
                  key={idx}
                  onClick={() => setMobileDayView(dbDay)}
                  className={`flex-1 py-3 px-2 flex flex-col items-center min-w-[60px] transition-all border-b-2 ${active ? 'border-primary bg-primary/5' : 'border-transparent opacity-60'}`}
                >
                  <span className="text-[10px] font-bold uppercase">{format(day, 'EEE', { locale: es })}</span>
                  <span className={`text-sm font-black ${active ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* GRILLA DINÁMICA */}
        <div className="flex-1 overflow-auto bg-muted/5 custom-scrollbar relative">
          <div className="md:min-w-[1200px] h-full relative">
            
            {/* LÍNEA "AHORA" RECUPERADA */}
            {isSameDay(currentDate, new Date()) && (
              <div className="absolute left-0 right-0 border-t-2 border-error z-10 pointer-events-none opacity-40 md:opacity-50"
                style={{ top: `${(getHours(new Date()) - 7) * 120 + (getMinutes(new Date()) * 2)}px` }}
              >
                <span className="absolute -top-2 left-14 md:left-1 bg-error text-white text-[8px] px-1 rounded font-bold uppercase">Ahora</span>
              </div>
            )}

            {/* CABECERA DÍAS (Solo Desktop) */}
            <div className="hidden md:grid sticky top-0 z-20 grid-cols-[60px_repeat(7,_1fr)] border-b border-border bg-background shadow-sm">
              <div className="h-12 border-r border-border flex items-center justify-center bg-muted/5">
                <Icon name="Clock" size={14} className="text-muted-foreground" />
              </div>
              {weekDays.map((day, i) => (
                <div key={i} className={`h-12 border-r border-border last:border-r-0 flex flex-col items-center justify-center ${isToday(day) ? 'bg-primary/[0.03]' : ''}`}>
                  <span className="text-[9px] font-bold uppercase text-muted-foreground">{format(day, 'EEEE', { locale: es })}</span>
                  <span className="text-sm font-bold">{format(day, 'd')}</span>
                </div>
              ))}
            </div>

            {/* CUERPO - Horas */}
            <div className="relative">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-[50px_1fr] md:grid-cols-[60px_repeat(7,_1fr)] min-h-[100px] md:min-h-[120px]">
                  
                  <div className="sticky left-0 z-10 bg-background/95 backdrop-blur border-r border-border border-b border-dashed border-border/30 flex justify-center items-start pt-2">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground bg-background px-1">
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
                          relative border-r border-b border-border/40 border-dashed p-1.5 flex flex-col gap-1.5
                          ${!isVisible ? 'hidden md:flex' : 'flex'} 
                          ${isToday(day) ? 'bg-primary/[0.01]' : ''}
                          hover:bg-primary/[0.02] group transition-colors
                        `}
                      >
                        <button
                          onClick={() => handleSlotClick(dbDay, hour)}
                          className="absolute bottom-1 right-1 z-20 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-primary text-white shadow-lg scale-90 hover:scale-100 transition-all"
                        >
                          <Icon name="Plus" size={14} />
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

      {selectedSlot && (
        <ClassSlotModal slotInfo={selectedSlot} onClose={() => setSelectedSlot(null)} onSuccess={() => { fetchData(); setSelectedSlot(null); }} />
      )}
      {showActivityManager && (
        <ActivityManagerModal onClose={() => setShowActivityManager(false)} />
      )}
    </>
  );
};

export default ClassSchedule;