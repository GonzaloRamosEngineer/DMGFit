import React from 'react';
import Icon from '../../../components/AppIcon';

const UpcomingSessions = ({ sessions }) => {
  const getSessionTypeColor = (type) => {
    switch (type) {
      case 'fuerza':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'cardio':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'tecnica':
        return 'bg-secondary/20 text-secondary border-secondary/30';
      default:
        return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  const getSessionIcon = (type) => {
    switch (type) {
      case 'fuerza':
        return 'Dumbbell';
      case 'cardio':
        return 'Activity';
      case 'tecnica':
        return 'Target';
      default:
        return 'Calendar';
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
        Próximas Sesiones
      </h3>
      {sessions?.length === 0 ? (
        <div className="text-center py-6 md:py-8 text-muted-foreground">
          <Icon name="Calendar" size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm md:text-base">No hay sesiones programadas</p>
        </div>
      ) : (
        <div className="space-y-2 md:space-y-3">
          {sessions?.map((session) => (
            <div 
              key={session?.id}
              className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 transition-smooth hover:bg-muted/50"
            >
              <div className="flex items-start gap-2 md:gap-3">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center border ${getSessionTypeColor(session?.type)}`}>
                  <Icon name={getSessionIcon(session?.type)} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm md:text-base font-medium text-foreground mb-1 truncate">
                    {session?.title}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs md:text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Icon name="Calendar" size={14} />
                      <span>{session?.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="Clock" size={14} />
                      <span>{session?.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="MapPin" size={14} />
                      <span className="truncate">{session?.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingSessions;