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

// Modales
import ClassSlotModal from './components/ClassSlotModal';
import ActivityManagerModal from './components/ActivityManagerModal';

// --- COMPONENTE INTERNO: TARJETA COMPACTA ---
const ScheduleCard = ({ cls, onClick }) => {
  const occupancy = Math.min((15 / cls.capacity) * 100, 100); // Esto a futuro lo conectas con los inscriptos reales
  const isFull = occupancy >= 100;
  const classColor = cls.class_types?.color || '#3b82f6'; // Fallback a blue-500 si no tiene color

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick(cls); }}
      className="group relative w-full rounded-xl border-l-[4px] p-2.5 shadow-sm bg-white border-y border-r border-slate-200 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer overflow-hidden flex flex-col gap-2"
      style={{ borderLeftColor: classColor }}
    >
      <div className="flex justify-between items-start gap-2 relative z-10">
        <h4 className="font-black text-[11px] md:text-xs uppercase tracking-tight leading-none truncate" style={{ color: classColor }}>
          {cls.class_types?.name}
        </h4>
        <span className="text-[9px] font-bold text-slate-500 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded-md">
          {cls.start_time.slice(0, 5)}
        </span>
      </div>

      <div className="flex items-center gap-2 relative z-10">
        {/* Avatares Profesores */}
        <div className="flex -space-x-1.5 overflow-hidden shrink-0">
          {cls.schedule_coaches?.length > 0 ? (
            cls.schedule_coaches.map((sc, i) => (
              <div key={i} className="w-5 h-5 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[8px] font-bold overflow-hidden border border-slate-200" title={sc.coaches?.profiles?.full_name}>
                {sc.coaches?.profiles?.avatar_url ? 
                  <img src={sc.coaches.profiles.avatar_url} alt="Profesor" className="w-full h-full object-cover" /> : 
                  sc.coaches?.profiles?.full_name?.charAt(0)}
              </div>
            ))
          ) : (
            <div className="w-5 h-5 rounded-full ring-2 ring-white bg-rose-50 flex items-center justify-center border border-rose-200" title="Sin profesor asignado">
              <Icon name="AlertCircle" size={10} className="text-rose-500" />
            </div>
          )}
        </div>
        
        {/* Barra de cupo */}
        <div className="flex-1 flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${isFull ? 'bg-rose-500' : 'bg-emerald-400'}`} 
              style={{ width: `${occupancy}%` }} 
            />
          </div>
          <span className={`text-[9px] font-black ${isFull ? 'text-rose-500' : 'text-slate-400'}`}>
            {cls.capacity}p
          </span>
        </div>
      </div>

      {/* Ícono de edición hover */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
        <Icon name="Edit" size={40} />
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
  
  const [mobileDayView, setMobileDayView] = useState(new Date().getDay() || 7); // 1 = Lunes, 7 = Domingo

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);
  
  // Definimos la grilla horaria (7 AM a 22 PM)
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

  const totalClasses = filteredSchedule.length;
  const totalHours = filteredSchedule.reduce((acc, curr) => acc + (parseInt(curr.end_time) - parseInt(curr.start_time)), 0);

  return (
    <>
      <Helmet><title>Agenda Maestra - DMG Fitness</title></Helmet>
      
      {/* NOTA UX: Usamos h-screen y overflow-hidden en el contenedor principal 
        para que la barra superior se quede fija y solo scrollee el calendario.
      */}
      <div className="flex flex-col h-screen bg-[#F8FAFC] w-full overflow-hidden">
        
        {/* --- HEADER Y TOOLBAR FIJOS --- */}
        <div className="bg-white border-b border-slate-200 z-30 flex-shrink-0 shadow-sm">
          <div className="px-4 md:px-6 py-4">
            
            {/* Fila 1: Títulos y Botones Principales */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <div className="hidden md:block scale-90 origin-left opacity-80 mb-1">
                  <BreadcrumbTrail items={[{ label: 'Gestión', path: '#' }, { label: 'Agenda Maestra', active: true }]} />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                  Planificación
                </h1>
                <p className="text-[11px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5">
                  Grilla Base Semanal
                </p>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button 
                  onClick={() => setShowActivityManager(true)} 
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-xs uppercase tracking-wider"
                >
                  <Icon name="Settings" size={16} /> <span className="hidden sm:inline">Actividades</span>
                </button>
                <button 
                  onClick={handleCopyPreviousWeek}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all text-xs uppercase tracking-wider"
                >
                  <Icon name="Save" size={16} /> <span>Guardar <span className="hidden sm:inline">Plantilla</span></span>
                </button>
              </div>
            </div>

            {/* Fila 2: Filtros y Navegación del Calendario */}
            <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-100">
              
              {/* Controles de Semana */}
              <div className="flex items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-full xl:w-auto justify-between">
                  <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors">
                    <Icon name="ChevronLeft" size={18} />
                  </button>
                  <div className="px-4 font-black text-xs min-w-[120px] text-center uppercase tracking-widest text-slate-700">
                    {format(weekStart, 'MMM yyyy', { locale: es })}
                  </div>
                  <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors">
                    <Icon name="ChevronRight" size={18} />
                  </button>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 hidden sm:block">
                  Hoy
                </button>
              </div>

              {/* Filtros y Stats */}
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
                
                {/* Stats (Desktop) */}
                <div className="hidden lg:flex items-center gap-4 mr-2 pr-4 border-r border-slate-200">
                  <div className="text-right">
                    <span className="block font-black text-slate-800 text-sm leading-none">{totalClasses}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Clases</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-black text-slate-800 text-sm leading-none">{totalHours}h</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Carga</span>
                  </div>
                </div>

                {/* Selects */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <select 
                    className="flex-1 sm:w-40 appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer" 
                    value={filterCoach} 
                    onChange={(e) => setFilterCoach(e.target.value)}
                  >
                    <option value="all">Todos los Profes</option>
                    {allCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select 
                    className="flex-1 sm:w-40 appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer" 
                    value={filterActivity} 
                    onChange={(e) => setFilterActivity(e.target.value)}
                  >
                    <option value="all">Todas las Clases</option>
                    {allActivities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          {/* SELECTOR DE DÍAS MOBILE (Estilo App Nativa) */}
          <div className="md:hidden flex bg-white border-t border-slate-100 p-2 overflow-x-auto no-scrollbar gap-1 shadow-sm relative z-20">
            {weekDays.map((day, idx) => {
              const dbDay = (idx + 1);
              const active = mobileDayView === dbDay;
              const today = isToday(day);
              return (
                <button 
                  key={idx}
                  onClick={() => setMobileDayView(dbDay)}
                  className={`flex-1 py-2 px-1 flex flex-col items-center min-w-[55px] rounded-xl transition-all ${
                    active 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                      : today 
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-transparent text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-blue-100' : ''}`}>
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span className="text-lg font-black leading-tight">
                    {format(day, 'd')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* --- ÁREA DEL CALENDARIO SCROLLABLE --- */}
        <div className="flex-1 overflow-auto bg-white relative custom-scrollbar">
          <div className="md:min-w-[1000px] lg:min-w-[1200px] h-full relative">
            
            {/* LÍNEA "AHORA" (Rediseñada) */}
            {isSameDay(currentDate, new Date()) && (
              <div 
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center group"
                style={{ top: `${(getHours(new Date()) - 7) * 120 + (getMinutes(new Date()) * 2)}px` }}
              >
                <div className="w-12 md:w-16 flex justify-end pr-2">
                  <div className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                    {format(new Date(), 'HH:mm')}
                  </div>
                </div>
                <div className="flex-1 border-t-2 border-rose-500 border-dashed opacity-50 relative">
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_0_4px_rgba(244,63,94,0.2)] animate-pulse"></div>
                </div>
              </div>
            )}

            {/* CABECERA DÍAS (Solo Desktop) */}
            <div className="hidden md:grid sticky top-0 z-30 grid-cols-[60px_repeat(7,_1fr)] border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
              <div className="h-14 border-r border-slate-100 flex items-center justify-center">
                <Icon name="Clock" size={16} className="text-slate-400" />
              </div>
              {weekDays.map((day, i) => {
                const today = isToday(day);
                return (
                  <div key={i} className={`h-14 border-r border-slate-100 last:border-r-0 flex flex-col items-center justify-center ${today ? 'bg-blue-50/50' : ''}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${today ? 'text-blue-600' : 'text-slate-400'}`}>
                      {format(day, 'EEEE', { locale: es })}
                    </span>
                    <span className={`text-base font-black leading-none mt-0.5 ${today ? 'text-blue-700' : 'text-slate-800'}`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* CUERPO DEL CALENDARIO - Grilla de Horas */}
            <div className="relative pb-10">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-[50px_1fr] md:grid-cols-[60px_repeat(7,_1fr)] min-h-[120px]">
                  
                  {/* Columna de la Hora (Izquierda) */}
                  <div className="sticky left-0 z-20 bg-white border-r border-slate-100 border-b border-dashed border-slate-100 flex justify-center items-start pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {hour}
                    </span>
                  </div>

                  {/* Celdas de los Días */}
                  {weekDays.map((day, dayIndex) => {
                    const dbDay = dayIndex + 1;
                    const classes = getClassesForCell(dbDay, hour);
                    const isVisible = mobileDayView === dbDay; // Lógica Mobile
                    const today = isToday(day);

                    return (
                      <div 
                        key={`${dbDay}-${hour}`}
                        className={`
                          relative border-r border-b border-slate-100 border-dashed p-1.5 flex flex-col gap-1.5
                          ${!isVisible ? 'hidden md:flex' : 'flex'} 
                          ${today ? 'bg-blue-50/10' : ''}
                          hover:bg-slate-50 transition-colors group
                        `}
                      >
                        {/* Botón flotante para agregar clase en ese horario */}
                        <button
                          onClick={() => handleSlotClick(dbDay, hour)}
                          className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all z-10"
                          title="Agregar Clase"
                        >
                          <Icon name="Plus" size={16} />
                        </button>

                        {/* Tarjetas de clases en este horario */}
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

      {/* Modales */}
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