import React from 'react';
import Icon from '../../../components/AppIcon';

const UpcomingSessionsCard = ({ sessions }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-foreground">Próximas Sesiones</h2>
        <Icon name="Calendar" size={24} color="var(--color-accent)" />
      </div>

      {sessions && sessions?.length > 0 ? (
        <div className="space-y-3">
          {sessions?.map((session) => (
            <div key={session?.id} className="p-4 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-foreground">{session?.type}</h3>
                <span className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded">
                  {session?.date}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Clock" size={14} />
                  <span>{session?.time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="MapPin" size={14} />
                  <span>{session?.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="User" size={14} />
                  <span>{session?.professor}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon name="CalendarOff" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
          <p className="text-muted-foreground">No hay sesiones próximas programadas</p>
        </div>
      )}
    </div>
  );
};

export default UpcomingSessionsCard;