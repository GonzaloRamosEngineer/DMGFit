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
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
    { id: 6, name: 'Sábado' }
  ];
  
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
            coaches ( id, profiles:profile_id(full_name) )
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

  // CAMBIO CLAVE: Devolvemos un ARRAY de clases, no una sola
  const getClassesForSlot = (dayId, hourStr) => {
    return schedule.filter(s => 
      s.day_of_week === dayId && 
      s.start_time.startsWith(hourStr)
    );
  };

  const handleSlotClick = (dayId, hourStr, existingClass = null) => {
    if (existingClass) {
      // Editar existente
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
      // Crear nuevo
      setSelectedSlot({
        dayOfWeek: dayId,
        startTime: hourStr,
        endTime: `${parseInt(hourStr) + 1}:00`
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationSidebar userRole="admin" />
      
      <div className="flex-1 ml-20 lg:ml-60 transition-all">
        <div className="p-6 lg:p-8">
          <Helmet><title>Grilla de Horarios - DigitalMatch</title></Helmet>
          <BreadcrumbTrail items={[{ label: 'Planificación Semanal', path: '#' }]} />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-heading font-bold">Grilla de Clases</h1>
              <p className="text-muted-foreground">Define actividades paralelas y profesores</p>
            </div>
            
            <Button 
              variant="outline" 
              iconName="Settings" 
              onClick={() => setShowActivityManager(true)}
            >
              Gestionar Actividades
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full min-w-[1000px] border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="p-3 border-b border-border w-20 bg-muted/30 sticky left-0 z-10"></th>
                  {days.map(d => (
                    <th key={d.id} className="p-3 border-b border-l border-border font-bold text-foreground text-center bg-muted/30 w-40">
                      {d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map(hour => (
                  <tr key={hour}>
                    <td className="p-3 border-b border-border text-center text-xs font-mono text-muted-foreground font-bold bg-muted/10 sticky left-0 z-10">
                      {hour}
                    </td>

                    {days.map(day => {
                      // Obtenemos TODAS las clases de esa hora
                      const classes = getClassesForSlot(day.id, hour);

                      return (
                        <td 
                          key={`${day.id}-${hour}`} 
                          className="border-b border-l border-border h-32 p-1 align-top relative group hover:bg-muted/5 transition-colors"
                        >
                          {/* Contenedor de Tarjetas (Scroll si hay muchas) */}
                          <div className="flex flex-col gap-1 h-full overflow-y-auto custom-scrollbar pr-1">
                            
                            {/* Renderizamos cada clase encontrada */}
                            {classes.map(cls => {
                              const coachNames = cls.schedule_coaches?.map(sc => 
                                sc.coaches?.profiles?.full_name?.split(' ')[0]
                              ) || [];
                              const coachLabel = coachNames.length > 0 
                                ? (coachNames.length > 1 ? `${coachNames[0]} +${coachNames.length - 1}` : coachNames[0])
                                : 'Sin Profe';

                              return (
                                <div 
                                  key={cls.id}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Evitar que clickee en el fondo
                                    handleSlotClick(day.id, hour, cls);
                                  }}
                                  className="w-full rounded p-1.5 flex flex-col justify-center text-xs shadow-sm border border-black/5 cursor-pointer hover:brightness-95 transition-all shrink-0"
                                  style={{ 
                                    backgroundColor: cls.class_types?.color + '25', // 25 = transparencia
                                    borderLeft: `3px solid ${cls.class_types?.color}` 
                                  }}
                                >
                                  <div className="flex justify-between items-start">
                                    <span className="font-bold truncate text-[11px]" style={{ color: cls.class_types?.color }}>
                                      {cls.class_types?.name}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1 mt-0.5 text-muted-foreground font-medium text-[10px]">
                                    <Icon name="User" size={10} />
                                    <span className="truncate max-w-[80px]">{coachLabel}</span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Botón fantasma para agregar (siempre visible al hacer hover en la celda) */}
                            <button
                              onClick={() => handleSlotClick(day.id, hour)}
                              className="w-full py-1 rounded border border-dashed border-border text-muted-foreground text-[10px] opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all flex items-center justify-center gap-1 shrink-0 mt-auto"
                            >
                              <Icon name="Plus" size={10} /> Agregar
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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