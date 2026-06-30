import React from 'react';
import Icon from '../../../components/AppIcon';
import { Card } from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';

const AlertFeed = ({ alerts, onActionClick, loading = false }) => {
  // Severidad → tokens de marca (no colores ad-hoc).
  const severityConfig = {
    critical: { icon: 'AlertCircle', iconColor: 'text-error', bgColor: 'bg-error-light', containerBg: 'bg-card', borderColor: 'border-error/15' },
    warning: { icon: 'AlertTriangle', iconColor: 'text-warning', bgColor: 'bg-warning-light', containerBg: 'bg-card', borderColor: 'border-warning/15' },
    info: { icon: 'Info', iconColor: 'text-info', bgColor: 'bg-info-light', containerBg: 'bg-muted', borderColor: 'border-border' },
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffDays = Math.floor((now - alertTime) / 86400000);
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    return `Hace ${diffDays}d`;
  };

  if (loading) {
    return (
      <Card padding="lg" className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-6 w-8 rounded-full" />
        </div>
        <div className="space-y-4 flex-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const criticalCount = alerts?.filter((a) => a.severity === 'critical').length || 0;

  return (
    <Card padding="lg" className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-error-light text-error flex items-center justify-center">
            <Icon name="Bell" size={20} />
          </div>
          <h3 className="text-xl font-black text-text-primary tracking-tight">Notificaciones</h3>
        </div>
        {criticalCount > 0 && (
          <Badge variant="error" size="md">
            {criticalCount} Nuevas
          </Badge>
        )}
      </div>

      {/* Feed (Lista con Scroll) */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar" style={{ maxHeight: '450px' }}>
        {alerts?.length === 0 ? (
          <EmptyState
            iconName="CheckCircle"
            title="Todo en orden"
            description="No hay alertas pendientes."
          />
        ) : (
          alerts.map((alert) => {
            const config = severityConfig[alert.severity] || severityConfig.info;

            return (
              <div
                key={alert.id}
                className={`${config.containerBg} border ${config.borderColor} rounded-2xl p-4 transition-all hover:shadow-md group`}
              >
                <div className="flex items-start gap-3">
                  {/* Icono de la alerta */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bgColor} ${config.iconColor}`}>
                    <Icon name={config.icon} size={20} />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-black text-text-primary line-clamp-1 pr-2">
                        {alert.title}
                      </h4>
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest whitespace-nowrap bg-muted px-2 py-0.5 rounded-md">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-text-secondary line-clamp-2 mb-2">
                      {alert.description}
                    </p>

                    {alert.athleteName && (
                      <div className="flex items-center gap-1.5 mb-3 bg-muted w-fit px-2.5 py-1 rounded-lg border border-border">
                        <Icon name="User" size={12} className="text-text-tertiary" />
                        <span className="text-[11px] font-bold text-text-secondary truncate max-w-[150px]">
                          {alert.athleteName}
                        </span>
                      </div>
                    )}

                    {/* Botón de Acción Integrado */}
                    {alert.actionable && (
                      <button
                        onClick={() => onActionClick && onActionClick(alert.id, 'view')}
                        className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors ${
                          alert.severity === 'critical' ? 'text-error hover:opacity-80' : 'text-primary hover:opacity-80'
                        }`}
                      >
                        {alert.actionLabel || 'Resolver'}
                        <Icon name="ArrowRight" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default AlertFeed;
