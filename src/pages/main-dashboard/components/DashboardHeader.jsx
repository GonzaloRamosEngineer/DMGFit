import React from 'react';
import Icon from '../../../components/AppIcon';

const DashboardHeader = ({ onRefreshToggle, autoRefresh = false, lastUpdated }) => {
  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Nunca';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
          Dashboard Operativo
        </h1>
        <p className="text-sm text-text-secondary font-medium mt-0.5">
          Estado diario de cobros, accesos y agenda en DMG Fitness
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Estado / última actualización (chip compacto) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
          <div className="relative flex items-center justify-center w-3 h-3">
            {autoRefresh && (
              <div className="absolute w-full h-full bg-success rounded-full animate-ping opacity-75"></div>
            )}
            <div className={`relative w-2 h-2 rounded-full ${autoRefresh ? 'bg-success' : 'bg-border'}`}></div>
          </div>
          <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
            {formatLastUpdated(lastUpdated)}
          </span>
        </div>

        <button
          onClick={onRefreshToggle}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm ${
            autoRefresh
              ? 'bg-success-light text-success border border-success/20 hover:opacity-90'
              : 'bg-card text-text-secondary border border-border hover:bg-muted'
          }`}
        >
          <Icon
            name="RefreshCw"
            size={15}
            className={autoRefresh ? 'animate-[spin_3s_linear_infinite]' : ''}
          />
          <span className="hidden sm:inline">{autoRefresh ? 'Auto-Sync ON' : 'Auto-Sync OFF'}</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;
