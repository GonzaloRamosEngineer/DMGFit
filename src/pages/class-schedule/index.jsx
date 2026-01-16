import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button'; // Importamos Button

import ClassSlotModal from './components/ClassSlotModal';
import ActivityManagerModal from './components/ActivityManagerModal'; // Import nuevo

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
      // OJO AL CAMBIO DE QUERY: Ahora traemos schedule_coaches
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

  const getClassForSlot = (dayId, hourStr) => {
    return schedule.find(s => 
      s.day_of_week === dayId && 
      s.start_time.startsWith(hourStr)
    );
  };

  const handleSlotClick = (dayId, hourStr, existingClass) => {
    if (existingClass) {
      // Mapeamos los profes al formato que espera el modal (array de IDs)
      const coachIds = existingClass.schedule_coaches.map(sc => sc.coaches.id);
      
      setSelectedSlot({
        id: existingClass.id,
        classTypeId: existingClass.class_types?.id,
        coachIds: coachIds, // IDs para los checkboxes
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
              <p className="text-muted-foreground">Define los horarios y asignaciones de profesores</p>
            </div>
            
            {/* BOTÓN PARA GESTIONAR ACTIVIDADES */}
            <Button 
              variant="outline" 
              iconName="Settings" 
              onClick={() => setShowActivityManager(true)}
            >
              Gestionar Actividades
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr>
                  <th className="p-3 border-b border-border w-20 bg-muted/30"></th>
                  {days.map(d => (
                    <th key={d.id} className="p-3 border-b border-l border-border font-bold text-foreground text-center bg-muted/30">
                      {d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map(hour => (
                  <tr key={hour}>
                    <td className="p-3 border-b border-border text-center text-xs font-mono text-muted-foreground font-bold bg-muted/10">
                      {hour}
                    </td>

                    {days.map(day => {
                      const classInfo = getClassForSlot(day.id, hour);
                      
                      // Preparamos nombres de profes para mostrar
                      const coachNames = classInfo?.schedule_coaches?.map(sc => 
                        sc.coaches?.profiles?.full_name?.split(' ')[0]
                      ) || [];
                      
                      const coachLabel = coachNames.length > 0 
                        ? (coachNames.length > 1 ? `${coachNames[0]} +${coachNames.length - 1}` : coachNames[0])
                        : 'Sin Profe';

                      return (
                        <td 
                          key={`${day.id}-${hour}`} 
                          className="border-b border-l border-border h-24 p-1 relative hover:bg-muted/10 transition-colors cursor-pointer"
                          onClick={() => handleSlotClick(day.id, hour, classInfo)}
                        >
                          {classInfo ? (
                            <div 
                              className="w-full h-full rounded-lg p-2 flex flex-col justify-center text-xs shadow-sm border border-black/5 relative overflow-hidden"
                              style={{ 
                                backgroundColor: classInfo.class_types?.color + '20', 
                                borderLeft: `4px solid ${classInfo.class_types?.color}` 
                              }}
                            >
                              <span className="font-bold text-foreground truncate" style={{ color: classInfo.class_types?.color }}>
                                {classInfo.class_types?.name}
                              </span>
                              
                              <div className="flex items-center gap-1 mt-1 text-muted-foreground font-medium">
                                <Icon name="User" size={10} />
                                <span className="truncate">{coachLabel}</span>
                              </div>
                              
                              <div className="mt-1 flex items-center gap-1 opacity-70 text-[10px]">
                                <Icon name="Users" size={10} />
                                <span>{classInfo.capacity}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 group">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Icon name="Plus" size={16} />
                              </div>
                            </div>
                          )}
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