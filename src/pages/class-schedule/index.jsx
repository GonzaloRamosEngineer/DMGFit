import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import NavigationSidebar from '../../components/ui/NavigationSidebar';
import BreadcrumbTrail from '../../components/ui/BreadcrumbTrail';
import Icon from '../../components/AppIcon';
import ClassSlotModal from './components/ClassSlotModal';

const ClassSchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null); // Para el modal

  // Configuración de la grilla
  const days = [
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
    { id: 6, name: 'Sábado' }
  ];
  
  // Generamos horas de 10:00 a 21:00
  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = i + 10;
    return `${h}:00`;
  });

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_schedule')
        .select(`
          id, day_of_week, start_time, end_time, capacity,
          class_types ( id, name, color ),
          coaches ( id, profiles:profile_id(full_name) )
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

  // Función para encontrar si hay clase en un día/hora específicos
  const getClassForSlot = (dayId, hourStr) => {
    // hourStr viene como "10:00". En DB start_time es "10:00:00"
    return schedule.find(s => 
      s.day_of_week === dayId && 
      s.start_time.startsWith(hourStr)
    );
  };

  const handleSlotClick = (dayId, hourStr, existingClass) => {
    if (existingClass) {
      // Editar existente
      setSelectedSlot({
        id: existingClass.id,
        classTypeId: existingClass.class_types?.id,
        coachId: existingClass.coaches?.id,
        dayOfWeek: dayId,
        startTime: existingClass.start_time,
        endTime: existingClass.end_time,
        capacity: existingClass.capacity
      });
    } else {
      // Crear nuevo en este hueco
      setSelectedSlot({
        dayOfWeek: dayId,
        startTime: hourStr,
        endTime: `${parseInt(hourStr) + 1}:00` // Por defecto 1 hora
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

          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-heading font-bold">Grilla de Clases</h1>
              <p className="text-muted-foreground">Define los horarios fijos de la semana</p>
            </div>
            {/* Aquí podríamos poner un botón para "Gestionar Tipos de Clase" */}
          </div>

          {/* LA GRILLA */}
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
                    {/* Columna Hora */}
                    <td className="p-3 border-b border-border text-center text-xs font-mono text-muted-foreground font-bold bg-muted/10">
                      {hour}
                    </td>

                    {/* Columnas Días */}
                    {days.map(day => {
                      const classInfo = getClassForSlot(day.id, hour);
                      return (
                        <td 
                          key={`${day.id}-${hour}`} 
                          className="border-b border-l border-border h-24 p-1 relative hover:bg-muted/10 transition-colors cursor-pointer"
                          onClick={() => handleSlotClick(day.id, hour, classInfo)}
                        >
                          {classInfo ? (
                            <div 
                              className="w-full h-full rounded-lg p-2 flex flex-col justify-center text-xs shadow-sm border border-black/5"
                              style={{ backgroundColor: classInfo.class_types?.color + '20', borderLeftColor: classInfo.class_types?.color, borderLeftWidth: '4px' }}
                            >
                              <span className="font-bold text-foreground truncate" style={{ color: classInfo.class_types?.color }}>
                                {classInfo.class_types?.name}
                              </span>
                              <span className="text-muted-foreground truncate">
                                {classInfo.coaches?.profiles?.full_name?.split(' ')[0]}
                              </span>
                              <div className="mt-1 flex items-center gap-1 opacity-70">
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
    </div>
  );
};

export default ClassSchedule;