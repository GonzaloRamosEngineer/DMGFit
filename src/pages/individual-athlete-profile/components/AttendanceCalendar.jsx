import React from 'react';

const AttendanceCalendar = ({ attendanceData, loading = false }) => {
  if (loading) {
    return (
      <div className="w-full animate-pulse">
        <div className="grid grid-cols-7 gap-2 mb-3">
          {[...Array(7)].map((_, i) => <div key={i} className="h-6 bg-muted/30 rounded"></div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[...Array(30)].map((_, i) => <div key={i} className="aspect-square bg-muted/20 rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  // Lógica para construir el calendario (simplificada para el mes actual)
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Dom, 1=Lun
  
  // Ajuste para que la semana empiece en Lunes (L=0, D=6)
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

  // Convertimos attendanceData en un Map para búsqueda rápida por día
  const attendanceMap = new Map();
  (attendanceData || []).forEach(record => {
    const d = new Date(record.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      attendanceMap.set(d.getDate(), record);
    }
  });

  const getIntensityColor = (status) => {
    // Mapeamos status a intensidad visual
    switch (status) {
      case 'present': return 'bg-primary'; // Alta (verde/primary)
      case 'late': return 'bg-warning'; // Media
      case 'absent': return 'bg-error'; // Baja/Negativa
      default: return 'bg-muted';
    }
  };

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const emptyDays = Array(adjustedStartDay).fill(null);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 md:mb-3">
        {weekDays.map((day, index) => (
          <div 
            key={index} 
            className="text-center text-xs md:text-sm font-medium text-muted-foreground py-1 md:py-2"
          >
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}
        
        {monthDays.map((day) => {
          const record = attendanceMap.get(day);
          const hasSession = !!record;
          
          return (
            <div
              key={day}
              className={`
                aspect-square rounded-md md:rounded-lg flex items-center justify-center
                text-xs md:text-sm font-medium transition-smooth
                ${hasSession 
                  ? `${getIntensityColor(record.status)} text-white cursor-pointer hover:opacity-80` 
                  : 'bg-muted/30 text-muted-foreground'
                }
              `}
              title={hasSession ? `Asistencia: ${record.status}` : 'Sin registro'}
            >
              <span className="data-text">{day}</span>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-primary" />
          <span className="text-xs md:text-sm text-muted-foreground">Presente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-warning" />
          <span className="text-xs md:text-sm text-muted-foreground">Tarde</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-error" />
          <span className="text-xs md:text-sm text-muted-foreground">Ausente</span>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendar;