import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

import ClassSlotModal from './components/ClassSlotModal';
import ActivityManagerModal from './components/ActivityManagerModal';

const ClassSchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showActivityManager, setShowActivityManager] = useState(false);

  const days = [
    { id: 1, name: 'Lunes', short: 'LUN' },
    { id: 2, name: 'Martes', short: 'MAR' },
    { id: 3, name: 'Miércoles', short: 'MIÉ' },
    { id: 4, name: 'Jueves', short: 'JUE' },
    { id: 5, name: 'Viernes', short: 'VIE' },
    { id: 6, name: 'Sábado', short: 'SÁB' }
  ];
  
  // Generamos horas (10 a 21)
  const hours = Array.from({ length: 12 }, (_, i) => `${i + 10}:00`);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_schedule')
        .select(`
          id, day_of_week, start_time, end_time, capacity,
          class_types ( id, name, color ),
          schedule_coaches (
            coaches ( id, profiles:profile_id(full_name, avatar_url) )
          )
        `);
      
      if (error) throw error;
      setSchedule(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const getClassesForSlot = (dayId, hourStr) => {
    return schedule.filter(s => 
      s.day_of_week === dayId && 
      s.start_time.startsWith(hourStr)
    );
  };

  const handleSlotClick = (dayId, hourStr, existingClass = null) => {
    if (existingClass) {
      const coachIds = existingClass.schedule_coaches.map(sc => sc.coaches.id);
      setSelectedSlot({
        id: existingClass.id,
        classTypeId: existingClass.class_types?.id,
        coachIds: coachIds,
        dayOfWeek: dayId,
        startTime: existingClass.start_time,
        endTime: existingClass.end_time,
        capacity: existingClass.capacity
      });
    } else {
      setSelectedSlot({
        dayOfWeek: dayId,
        startTime: hourStr,
        endTime: `${parseInt(hourStr) + 1}:00`
      });
    }
  };

  // Helper para las iniciales del avatar
  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : '??';
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50"> {/* Fondo más sutil */}
      <NavigationSidebar userRole="admin" />
      
      <div className="flex-1 ml-20 lg:ml-60 transition-all flex flex-col h-screen overflow-hidden">
        
        {/* HEADER FIJO */}
        <div className="p-6 lg:p-8 pb-4 shrink-0 bg-background z-20">
          <Helmet><title>Grilla de Horarios - DigitalMatch</title></Helmet>
          <BreadcrumbTrail items={[{ label: 'Planificación Semanal', path: '#' }]} />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Grilla de Clases</h1>
              <p className="text-muted-foreground">Gestiona la oferta de actividades y profesores</p>
            </div>
            
            <Button 
              variant="outline" 
              iconName="Settings" 
              onClick={() => setShowActivityManager(true)}
              className="shadow-sm"
            >
              Gestionar Actividades
            </Button>
          </div>
        </div>

        {/* CONTENEDOR DE LA GRILLA (Scrollable) */}
        <div className="flex-1 overflow-auto p-6 lg:p-8 pt-0 custom-scrollbar">
          <div className="bg-card border border-border rounded-xl shadow-sm min-w-[1000px] relative">
            
            {/* CABECERA DE DÍAS (Sticky Top) */}
            <div className="grid grid-cols-[80px_repeat(6,_1fr)] sticky top-0 z-10 bg-card border-b border-border shadow-sm">
              <div className="p-4 border-r border-border bg-muted/5"></div> {/* Esquina vacía */}
              {days.map(d => (
                <div key={d.id} className="p-4 border-r border-border last:border-r-0 text-center bg-muted/5">
                  <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">{d.short}</span>
                  <span className="block text-lg font-bold text-foreground">{d.name}</span>
                </div>
              ))}
            </div>

            {/* CUERPO DE LA GRILLA */}
            <div className="divide-y divide-border">
              {hours.map(hour => (
                <div key={hour} className="grid grid-cols-[80px_repeat(6,_1fr)] min-h-[140px]">
                  
                  {/* COLUMNA HORA (Sticky Left) */}
                  <div className="sticky left-0 bg-card z-0 flex flex-col items-center justify-start pt-4 border-r border-border">
                    <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                      {hour}
                    </span>
                  </div>

                  {/* CELDAS DE DÍAS */}
                  {days.map(day => {
                    const classes = getClassesForSlot(day.id, hour);
                    
                    return (
                      <div 
                        key={`${day.id}-${hour}`} 
                        className="border-r border-border last:border-r-0 p-2 relative group transition-colors hover:bg-muted/5 flex flex-col gap-2"
                      >
                        {/* BOTÓN FLOTANTE "AGREGAR" (Solo visible en hover) */}
                        <div 
                          className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center pointer-events-none"
                        >
                           {/* Este div detecta el click en el espacio vacío */}
                        </div>
                        <button
                          onClick={() => handleSlotClick(day.id, hour)}
                          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-110 transition-all"
                          title="Agregar clase aquí"
                        >
                          <Icon name="Plus" size={14} />
                        </button>

                        {/* TARJETAS DE CLASES */}
                        {classes.map(cls => (
                          <div 
                            key={cls.id}
                            onClick={(e) => { e.stopPropagation(); handleSlotClick(day.id, hour, cls); }}
                            className="relative z-10 w-full rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-all border-l-4 group/card hover:-translate-y-0.5"
                            style={{ 
                              backgroundColor: 'var(--color-card)', // Fondo blanco/oscuro
                              borderLeftColor: cls.class_types?.color,
                              borderTop: '1px solid var(--color-border)',
                              borderRight: '1px solid var(--color-border)',
                              borderBottom: '1px solid var(--color-border)',
                            }}
                          >
                            {/* Header de Tarjeta */}
                            <div className="flex justify-between items-start mb-2">
                              <span 
                                className="font-bold text-sm leading-tight"
                                style={{ color: cls.class_types?.color }}
                              >
                                {cls.class_types?.name}
                              </span>
                              {/* Badge de Capacidad */}
                              <div className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                <Icon name="Users" size={10} />
                                <span>{cls.capacity}</span>
                              </div>
                            </div>
                            
                            {/* Avatares de Profes */}
                            <div className="flex items-center justify-between mt-auto">
                              <div className="flex -space-x-2 overflow-hidden py-1">
                                {cls.schedule_coaches && cls.schedule_coaches.length > 0 ? (
                                  cls.schedule_coaches.map((sc, idx) => (
                                    <div 
                                      key={idx} 
                                      className="w-7 h-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground"
                                      title={sc.coaches?.profiles?.full_name}
                                    >
                                      {sc.coaches?.profiles?.avatar_url ? (
                                        <img src={sc.coaches.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                      ) : (
                                        getInitials(sc.coaches?.profiles?.full_name)
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-error italic">Sin profe</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Espacio clickeable para agregar si está vacío */}
                        {classes.length === 0 && (
                           <div 
                             className="flex-1 min-h-[80px] cursor-pointer" 
                             onClick={() => handleSlotClick(day.id, hour)}
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

      {selectedSlot && (
        <ClassSlotModal 
          slotInfo={selectedSlot} 
          onClose={() => setSelectedSlot(null)}
          onSuccess={() => { fetchSchedule(); setSelectedSlot(null); }}
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