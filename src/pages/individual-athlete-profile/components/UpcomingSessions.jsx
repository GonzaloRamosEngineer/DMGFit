import React from 'react';
import Icon from '../../../components/AppIcon';

const UpcomingSessions = ({ sessions, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/2 mb-6"></div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  const getSessionIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'fuerza': return 'Dumbbell';
      case 'cardio': return 'Activity';
      case 'tecnica': return 'Target';
      default: return 'Calendar';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
        Próximas Sesiones
      </h3>
      
      {!sessions || sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
          <Icon name="Calendar" size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay sesiones programadas</p>
        </div>
      ) : (
        <div className="space-y-2 md:space-y-3">
          {sessions.map((session) => (
            <div 
              key={session.id}
              className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 transition-smooth hover:bg-muted/50"
            >
              <div className="flex items-start gap-2 md:gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                  <Icon name={getSessionIcon(session.type)} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1 truncate">
                    {session.type || 'Entrenamiento'}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Icon name="Calendar" size={14} />
                      <span>{new Date(session.session_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="Clock" size={14} />
                      <span>{session.time?.slice(0, 5)}</span>
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