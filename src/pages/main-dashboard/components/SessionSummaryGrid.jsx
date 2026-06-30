import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import { Card } from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';

const SessionSummaryGrid = ({ sessions, loading = false }) => {
  // Estado de sesión → tokens de marca (variant de Badge).
  const getStatusConfig = (status) => {
    const styles = {
      completed: { variant: 'success', label: 'Completada', icon: 'CheckCircle' },
      ongoing: { variant: 'info', label: 'En Curso', icon: 'PlayCircle' },
      scheduled: { variant: 'warning', label: 'Programada', icon: 'Clock' },
      cancelled: { variant: 'error', label: 'Cancelada', icon: 'XCircle' },
    };
    return styles[status] || styles.scheduled;
  };

  const todayStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (loading) {
    return (
      <Card padding="lg" className="">
        <div className="flex justify-between items-center mb-8">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="w-12 h-12 rounded-2xl" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  // Definición de las columnas del Grid
  const gridLayout = 'grid-cols-[80px_minmax(180px,2fr)_minmax(150px,1.5fr)_120px_100px]';

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      {/* Cabecera */}
      <div className="p-6 md:p-8 border-b border-border flex items-center justify-between bg-muted/50">
        <div>
          <h3 className="text-xl font-black text-text-primary tracking-tight flex items-center gap-3">
            Agenda de Hoy
          </h3>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1 capitalize">
            {todayStr}
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-info-light text-primary flex items-center justify-center shadow-inner">
          <Icon name="Calendar" size={24} />
        </div>
      </div>

      {/* Contenedor con Scroll horizontal para pantallas pequeñas */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Encabezados de Columna */}
          <div className={`grid ${gridLayout} gap-4 px-8 py-4 bg-muted border-b border-border text-[10px] font-black text-text-secondary uppercase tracking-widest items-center`}>
            <div>Hora</div>
            <div>Entrenador</div>
            <div>Programa</div>
            <div className="text-center">Asistencia</div>
            <div className="text-center">Estado</div>
          </div>

          {/* Filas */}
          <div className="flex flex-col divide-y divide-border pb-2">
            {sessions?.length === 0 ? (
              <EmptyState
                iconName="Coffee"
                title="Día Libre"
                description="No hay sesiones programadas para hoy."
              />
            ) : (
              sessions.map((session) => {
                const status = getStatusConfig(session.status);
                const occupancyPercentage = session.capacity > 0 ? (session.attendanceCount / session.capacity) * 100 : 0;
                const isFull = occupancyPercentage >= 100;

                return (
                  <div key={session.id} className={`grid ${gridLayout} gap-4 px-8 py-4 items-center hover:bg-muted/60 transition-colors group`}>
                    {/* Hora */}
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-border group-hover:bg-primary transition-colors"></div>
                      <span className="text-sm font-black text-text-secondary">
                        {session.time?.slice(0, 5)}
                      </span>
                    </div>

                    {/* Entrenador */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                        {session.coachAvatar ? (
                          <Image src={session.coachAvatar} alt={session.coachName} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="User" size={16} className="text-text-tertiary" />
                        )}
                      </div>
                      <span className="text-sm font-bold text-text-primary truncate">
                        {session.coachName}
                      </span>
                    </div>

                    {/* Programa */}
                    <div className="truncate">
                      <span className="text-xs font-bold text-text-secondary bg-muted px-3 py-1.5 rounded-lg truncate">
                        {session.program}
                      </span>
                    </div>

                    {/* Asistencia (Barra y Texto) */}
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="flex items-center gap-1 mb-1">
                        <span className={`text-sm font-black ${isFull ? 'text-error' : 'text-text-primary'}`}>
                          {session.attendanceCount}
                        </span>
                        <span className="text-[10px] font-bold text-text-tertiary">
                          / {session.capacity}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-error' : 'bg-primary'}`}
                          style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Estado */}
                    <div className="flex justify-center">
                      <Badge variant={status.variant} size="sm" iconName={status.icon}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SessionSummaryGrid;
