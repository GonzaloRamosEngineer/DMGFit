import React from 'react';
import Icon from '../../../components/AppIcon';
import AlertBadge from '../../../components/ui/AlertBadge';
import Button from '../../../components/ui/Button';

const AlertFeed = ({ alerts, onActionClick, loading = false }) => {
  const severityConfig = {
    critical: { icon: 'AlertCircle', color: 'var(--color-error)', bgColor: 'bg-error/10', borderColor: 'border-error/30' },
    warning: { icon: 'AlertTriangle', color: 'var(--color-warning)', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' },
    info: { icon: 'Info', color: 'var(--color-accent)', bgColor: 'bg-accent/10', borderColor: 'border-accent/30' }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffDays = Math.floor((now - alertTime) / 86400000);
    if (diffDays === 0) return 'Hoy';
    return `Hace ${diffDays}d`;
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full flex flex-col animate-pulse">
        <div className="flex justify-between mb-4">
          <div className="h-6 bg-muted/50 rounded w-1/3"></div>
          <div className="h-6 bg-muted/50 rounded w-8"></div>
        </div>
        <div className="space-y-3 flex-1">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground">
          Alertas
        </h3>
        <AlertBadge count={alerts?.filter(a => a.severity === 'critical').length} severity="critical" position="inline" />
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar" style={{ maxHeight: '400px' }}>
        {alerts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center h-full">
            <Icon name="CheckCircle" size={48} color="var(--color-success)" className="mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">Todo en orden. No hay alertas.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const config = severityConfig[alert.severity] || severityConfig.info;
            return (
              <div
                key={alert.id}
                className={`${config.bgColor} border ${config.borderColor} rounded-lg p-3 md:p-4 transition-smooth hover:shadow-md`}
              >
                <div className="flex items-start space-x-3">
                  <Icon name={config.icon} size={20} color={config.color} className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-medium text-foreground line-clamp-1">{alert.title}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{alert.description}</p>
                    
                    {alert.athleteName && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Icon name="User" size={14} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{alert.athleteName}</span>
                      </div>
                    )}

                    {alert.actionable && (
                      <Button
                        variant="default"
                        size="xs"
                        className="mt-1"
                        onClick={() => onActionClick && onActionClick(alert.id, 'resolve')}
                      >
                        {alert.actionLabel || 'Resolver'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlertFeed;