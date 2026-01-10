import React from 'react';
import Icon from '../../../components/AppIcon';
import AlertBadge from '../../../components/ui/AlertBadge';
import Button from '../../../components/ui/Button';

const AlertFeed = ({ alerts, onActionClick }) => {
  const severityConfig = {
    critical: {
      icon: 'AlertCircle',
      color: 'var(--color-error)',
      bgColor: 'bg-error/10',
      borderColor: 'border-error/30'
    },
    warning: {
      icon: 'AlertTriangle',
      color: 'var(--color-warning)',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30'
    },
    info: {
      icon: 'Info',
      color: 'var(--color-accent)',
      bgColor: 'bg-accent/10',
      borderColor: 'border-accent/30'
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now - alertTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground">
          Alertas Críticas
        </h3>
        <AlertBadge count={alerts?.length} severity="critical" position="inline" />
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        {alerts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon name="CheckCircle" size={48} color="var(--color-success)" className="mb-3" />
            <p className="text-sm text-muted-foreground">No hay alertas pendientes</p>
          </div>
        ) : (
          alerts?.map((alert) => {
            const config = severityConfig?.[alert?.severity];
            return (
              <div
                key={alert?.id}
                className={`${config?.bgColor} border ${config?.borderColor} rounded-lg p-3 md:p-4 transition-smooth hover:shadow-md`}
              >
                <div className="flex items-start space-x-3">
                  <Icon name={config?.icon} size={20} color={config?.color} className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-medium text-foreground line-clamp-1">
                        {alert?.title}
                      </h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatTimeAgo(alert?.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {alert?.description}
                    </p>
                    {alert?.athleteName && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Icon name="User" size={14} color="var(--color-muted-foreground)" />
                        <span className="text-xs text-muted-foreground">{alert?.athleteName}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => onActionClick && onActionClick(alert?.id, 'view')}
                      >
                        Ver Detalles
                      </Button>
                      {alert?.actionable && (
                        <Button
                          variant="default"
                          size="xs"
                          onClick={() => onActionClick && onActionClick(alert?.id, 'resolve')}
                        >
                          {alert?.actionLabel || 'Resolver'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <Button variant="ghost" fullWidth iconName="RefreshCw" iconPosition="left">
          Actualizar Alertas
        </Button>
      </div>
    </div>
  );
};

export default AlertFeed;