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
    <div className="mb-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mt-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Dashboard Operativo
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Estado diario de cobros, accesos y agenda en DMG Fitness
          </p>
        </div>

        <button
          onClick={onRefreshToggle}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm w-full sm:w-auto ${
            autoRefresh
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 shadow-emerald-100'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Icon
            name="RefreshCw"
            size={16}
            className={autoRefresh ? 'animate-[spin_3s_linear_infinite]' : ''}
          />
          {autoRefresh ? 'Auto-Sync ON' : 'Auto-Sync OFF'}
        </button>
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200/60">
        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center justify-center w-3 h-3">
            {autoRefresh && (
              <div className="absolute w-full h-full bg-emerald-400 rounded-full animate-ping opacity-75"></div>
            )}
            <div
              className={`relative w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-300'}`}
            ></div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {autoRefresh ? 'Conexión en vivo' : 'Actualización manual'}
          </span>
        </div>

        <div className="w-1 h-1 rounded-full bg-slate-200"></div>

        <div className="flex items-center gap-1.5">
          <Icon name="Clock" size={12} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Actualizado: {formatLastUpdated(lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
