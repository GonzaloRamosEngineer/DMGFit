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

  // Valores derivados por sesión, compartidos entre la vista tabla y la de tarjetas.
  const getSessionView = (session) => {
    const status = getStatusConfig(session.status);
    const occupancyPercentage = session.capacity > 0
      ? (session.attendanceCount / session.capacity) * 100
      : 0;
    return { status, occupancyPercentage, isFull: occupancyPercentage >= 100 };
  };

  const CoachAvatar = ({ session, className = 'w-8 h-8' }) => (
    <div className={`${className} rounded-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center`}>
      {session.coachAvatar ? (
        <Image src={session.coachAvatar} alt={session.coachName} className="w-full h-full object-cover" />
      ) : (
        <Icon name="User" size={16} className="text-text-tertiary" />
      )}
    </div>
  );

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

  // Columnas del Grid (vista tabla). Anchos ajustados para entrar sin scroll cuando la tarjeta es ancha.
  const gridLayout = 'grid-cols-[76px_minmax(140px,2fr)_minmax(120px,1.5fr)_108px_96px]';

  const hasSessions = sessions?.length > 0;

  return (
    <Card padding="none" className="h-full min-h-[280px] flex flex-col overflow-hidden">
      {/* Cabecera */}
      <div className="p-5 border-b border-border flex items-center justify-between bg-muted/50 shrink-0">
        <div>
          <h3 className="text-lg font-black text-text-primary tracking-tight flex items-center gap-3">
            Agenda de Hoy
          </h3>
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1 capitalize">
            {todayStr}
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-info-light text-primary flex items-center justify-center shadow-inner">
          <Icon name="Calendar" size={22} />
        </div>
      </div>

      {/* Cuerpo: `@container` para decidir tabla vs. tarjetas según el ancho de la propia tarjeta. */}
      <div className="@container flex-1 min-h-0 overflow-auto custom-scrollbar">
        {!hasSessions ? (
          <EmptyState
            iconName="Coffee"
            title="Día Libre"
            description="No hay sesiones programadas para hoy."
          />
        ) : (
          <>
            {/* ---- Vista TABLA (contenedor ancho) ---- */}
            <div className="hidden @2xl:block min-w-[600px]">
              {/* Encabezados de Columna */}
              <div className={`grid ${gridLayout} gap-3 px-5 py-3 bg-muted border-b border-border text-[10px] font-black text-text-secondary uppercase tracking-widest items-center sticky top-0 z-card`}>
                <div>Hora</div>
                <div>Entrenador</div>
                <div>Programa</div>
                <div className="text-center">Asistencia</div>
                <div className="text-center">Estado</div>
              </div>

              {/* Filas */}
              <div className="flex flex-col divide-y divide-border pb-2">
                {sessions.map((session) => {
                  const { status, occupancyPercentage, isFull } = getSessionView(session);
                  return (
                    <div key={session.id} className={`grid ${gridLayout} gap-3 px-5 py-4 items-center hover:bg-muted/60 transition-colors group`}>
                      {/* Hora */}
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-border group-hover:bg-primary transition-colors"></div>
                        <span className="text-sm font-black text-text-secondary">
                          {session.time?.slice(0, 5)}
                        </span>
                      </div>

                      {/* Entrenador */}
                      <div className="flex items-center gap-3 min-w-0">
                        <CoachAvatar session={session} />
                        <span className="text-sm font-bold text-text-primary truncate">
                          {session.coachName}
                        </span>
                      </div>

                      {/* Programa */}
                      <div className="min-w-0">
                        <span className="inline-block max-w-full text-xs font-bold text-text-secondary bg-muted px-3 py-1.5 rounded-lg truncate align-middle">
                          {session.program}
                        </span>
                      </div>

                      {/* Asistencia (Barra y Texto) */}
                      <div className="flex flex-col items-center justify-center px-2">
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
                })}
              </div>
            </div>

            {/* ---- Vista TARJETAS (contenedor angosto) ---- */}
            <div className="@2xl:hidden flex flex-col divide-y divide-border pb-2">
              {sessions.map((session) => {
                const { status, occupancyPercentage, isFull } = getSessionView(session);
                return (
                  <div key={session.id} className="p-4 hover:bg-muted/60 transition-colors">
                    {/* Fila 1: hora + estado */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        <span className="text-sm font-black text-text-secondary">
                          {session.time?.slice(0, 5)}
                        </span>
                      </div>
                      <Badge variant={status.variant} size="sm" iconName={status.icon}>
                        {status.label}
                      </Badge>
                    </div>

                    {/* Fila 2: entrenador + programa */}
                    <div className="flex items-center gap-3 mb-3 min-w-0">
                      <CoachAvatar session={session} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {session.coachName}
                        </p>
                        <span className="inline-block max-w-full mt-0.5 text-xs font-bold text-text-secondary bg-muted px-2 py-0.5 rounded-lg truncate align-middle">
                          {session.program}
                        </span>
                      </div>
                    </div>

                    {/* Fila 3: asistencia */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-sm font-black ${isFull ? 'text-error' : 'text-text-primary'}`}>
                          {session.attendanceCount}
                        </span>
                        <span className="text-[10px] font-bold text-text-tertiary">
                          / {session.capacity}
                        </span>
                      </div>
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-error' : 'bg-primary'}`}
                          style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default SessionSummaryGrid;
