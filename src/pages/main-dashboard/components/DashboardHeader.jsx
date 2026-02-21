import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const DashboardHeader = ({ 
  onDateRangeChange, 
  onRefreshToggle, 
  autoRefresh = false,
  lastUpdated 
}) => {
  const [selectedFacility, setSelectedFacility] = useState('all');
  const [selectedRange, setSelectedRange] = useState('today');

  const facilityOptions = [
    { value: 'all', label: 'Todas las Instalaciones' },
    { value: 'central', label: 'Centro Principal' },
    { value: 'norte', label: 'Sucursal Norte' },
    { value: 'sur', label: 'Sucursal Sur' }
  ];

  const dateRangeOptions = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: 'quarter', label: 'Este Trimestre' }
  ];

  const handleRangeChange = (e) => {
    const value = e.target.value;
    setSelectedRange(value);
    if (onDateRangeChange) {
      onDateRangeChange(value);
    }
  };

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Nunca';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="mb-8">
      {/* Título y Controles */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mt-2">
        
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Panel de Control
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Monitoreo en tiempo real de rendimiento y asistencia
          </p>
        </div>

        {/* Filtros y Acciones */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
          
          {/* Select: Instalación */}
          <div className="relative flex-1 sm:flex-none">
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="w-full sm:w-48 appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
            >
              {facilityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Icon name="MapPin" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>

          {/* Select: Rango de Fechas */}
          <div className="relative flex-1 sm:flex-none">
            <select
              value={selectedRange}
              onChange={handleRangeChange}
              className="w-full sm:w-40 appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
            >
              {dateRangeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Icon name="Calendar" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>

          {/* Botón Auto-Refresh */}
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
      </div>

      {/* Barra de Estado Inferior */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200/60">
        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center justify-center w-3 h-3">
            {autoRefresh && <div className="absolute w-full h-full bg-emerald-400 rounded-full animate-ping opacity-75"></div>}
            <div className={`relative w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
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