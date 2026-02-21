import React from 'react';
import Icon from '../../../components/AppIcon';
import AlertBadge from '../../../components/ui/AlertBadge';

const AlertFeed = ({ alerts, onActionClick, loading = false }) => {
  // Configuración de estilos Tailwind unificada
  const severityConfig = {
    critical: { icon: 'AlertCircle', iconColor: 'text-rose-500', bgColor: 'bg-rose-50', containerBg: 'bg-white', borderColor: 'border-rose-100' },
    warning: { icon: 'AlertTriangle', iconColor: 'text-amber-500', bgColor: 'bg-amber-50', containerBg: 'bg-white', borderColor: 'border-amber-100' },
    info: { icon: 'Info', iconColor: 'text-blue-500', bgColor: 'bg-blue-50', containerBg: 'bg-slate-50', borderColor: 'border-slate-100' }
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
      <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 h-full flex flex-col animate-pulse shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 bg-slate-100 rounded w-1/3"></div>
          <div className="h-6 bg-slate-100 rounded-full w-8"></div>
        </div>
        <div className="space-y-4 flex-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex-shrink-0"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                <div className="h-3 bg-slate-50 rounded w-full"></div>
                <div className="h-3 bg-slate-50 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const criticalCount = alerts?.filter(a => a.severity === 'critical').length || 0;

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 h-full flex flex-col shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <Icon name="Bell" size={20} />
          </div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">
            Notificaciones
          </h3>
        </div>
        {criticalCount > 0 && (
          <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg">
            {criticalCount} NUEVAS
          </span>
        )}
      </div>
      
      {/* Feed (Lista con Scroll) */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar" style={{ maxHeight: '450px' }}>
        {alerts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center h-full border-2 border-dashed border-slate-100 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <Icon name="CheckCircle" size={32} className="text-emerald-500" />
            </div>
            <p className="text-sm font-black text-slate-700">Todo en orden</p>
            <p className="text-xs font-medium text-slate-400 mt-1">No hay alertas pendientes.</p>
          </div>
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
                      <h4 className="text-sm font-black text-slate-800 line-clamp-1 pr-2">
                        {alert.title}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded-md">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>
                    
                    <p className="text-xs font-medium text-slate-500 line-clamp-2 mb-2">
                      {alert.description}
                    </p>
                    
                    {alert.athleteName && (
                      <div className="flex items-center gap-1.5 mb-3 bg-slate-50 w-fit px-2.5 py-1 rounded-lg border border-slate-100">
                        <Icon name="User" size={12} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-600 truncate max-w-[150px]">
                          {alert.athleteName}
                        </span>
                      </div>
                    )}

                    {/* Botón de Acción Integrado */}
                    {alert.actionable && (
                      <button
                        onClick={() => onActionClick && onActionClick(alert.id, 'view')}
                        className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors ${
                          alert.severity === 'critical' ? 'text-rose-600 hover:text-rose-700' : 'text-blue-600 hover:text-blue-700'
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
    </div>
  );
};

export default AlertFeed;