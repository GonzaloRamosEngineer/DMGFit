import React from 'react';


const AttendanceCalendar = ({ attendanceData, currentMonth }) => {
  const daysInMonth = 31;
  const startDay = 3;

  const getAttendanceForDay = (day) => {
    return attendanceData?.find(item => item?.day === day);
  };

  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case 'high':
        return 'bg-primary';
      case 'medium':
        return 'bg-warning';
      case 'low':
        return 'bg-accent';
      default:
        return 'bg-muted';
    }
  };

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const emptyDays = Array(startDay)?.fill(null);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 md:mb-3">
        {weekDays?.map((day, index) => (
          <div 
            key={index} 
            className="text-center text-xs md:text-sm font-medium text-muted-foreground py-1 md:py-2"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {emptyDays?.map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}
        
        {monthDays?.map((day) => {
          const attendance = getAttendanceForDay(day);
          const hasSession = attendance !== undefined;
          
          return (
            <div
              key={day}
              className={`
                aspect-square rounded-md md:rounded-lg flex items-center justify-center
                text-xs md:text-sm font-medium transition-smooth
                ${hasSession 
                  ? `${getIntensityColor(attendance?.intensity)} text-white cursor-pointer hover:opacity-80` 
                  : 'bg-muted/30 text-muted-foreground'
                }
              `}
              title={hasSession ? `${attendance?.type} - ${attendance?.intensity}` : 'Sin sesión'}
            >
              <span className="data-text">{day}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-primary" />
          <span className="text-xs md:text-sm text-muted-foreground">Alta intensidad</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-warning" />
          <span className="text-xs md:text-sm text-muted-foreground">Media intensidad</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-accent" />
          <span className="text-xs md:text-sm text-muted-foreground">Baja intensidad</span>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCalendar;