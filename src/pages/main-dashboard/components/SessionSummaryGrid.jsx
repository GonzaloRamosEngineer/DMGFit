import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const SessionSummaryGrid = ({ sessions, loading = false }) => {
  const getStatusColor = (status) => {
    const colors = {
      completed: 'text-success bg-success/10',
      ongoing: 'text-accent bg-accent/10',
      scheduled: 'text-warning bg-warning/10',
      cancelled: 'text-error bg-error/10'
    };
    return colors[status] || colors.scheduled;
  };

  const getStatusLabel = (status) => {
    const labels = {
      completed: 'Completada',
      ongoing: 'En Curso',
      scheduled: 'Programada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-muted/30 rounded w-full"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground">
            Sesiones de Hoy
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Icon name="Calendar" size={24} color="var(--color-primary)" />
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 text-xs md:text-sm font-medium text-muted-foreground">Hora</th>
              <th className="text-left py-3 px-2 text-xs md:text-sm font-medium text-muted-foreground">Entrenador</th>
              <th className="text-left py-3 px-2 text-xs md:text-sm font-medium text-muted-foreground">Programa</th>
              <th className="text-center py-3 px-2 text-xs md:text-sm font-medium text-muted-foreground">Asistencia</th>
              <th className="text-center py-3 px-2 text-xs md:text-sm font-medium text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sessions?.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-muted-foreground">
                  No hay sesiones programadas para hoy.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="border-b border-border hover:bg-muted/50 transition-smooth">
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      <Icon name="Clock" size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">
                        {session.time?.slice(0, 5)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      {session.coachAvatar ? (
                        <Image
                          src={session.coachAvatar}
                          alt={session.coachName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon name="User" size={14} className="text-primary" />
                        </div>
                      )}
                      <span className="text-sm text-foreground">{session.coachName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-sm text-foreground">{session.program}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-sm font-medium text-foreground">{session.attendanceCount}</span>
                      <span className="text-xs text-muted-foreground">/ {session.capacity}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1 max-w-[100px] mx-auto">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-smooth"
                        style={{ width: `${Math.min((session.attendanceCount / session.capacity) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {getStatusLabel(session.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SessionSummaryGrid;