import React from 'react';
import Icon from '../../../components/AppIcon';

const BulkActionsBar = ({ selectedCount, onAction, onClearSelection }) => {
  if (!selectedCount || selectedCount === 0) return null;

  const bulkActions = [
    { id: 'message', label: 'Mensaje', icon: 'MessageSquare', iconColor: 'text-blue-400' },
    { id: 'schedule', label: 'Programar', icon: 'Calendar', iconColor: 'text-violet-400' },
    { id: 'payment', label: 'Recordatorio', icon: 'Bell', iconColor: 'text-amber-400' },
    { id: 'export', label: 'Exportar', icon: 'Download', iconColor: 'text-slate-300' }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl animate-in slide-in-from-bottom-10 fade-in duration-300">
      
      {/* Contenedor Principal Oscuro */}
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-[2rem] shadow-2xl shadow-slate-900/20 p-3 pr-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Izquierda: Contador y Desmarcar */}
        <div className="flex items-center gap-4 pl-2 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-inner">
              {selectedCount}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white leading-none">
                Seleccionados
              </span>
              <button 
                onClick={onClearSelection}
                className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest text-left mt-1.5 transition-colors flex items-center gap-1"
              >
                <Icon name="X" size={10} /> Desmarcar
              </button>
            </div>
          </div>
          
          {/* Separador vertical (solo en desktop) */}
          <div className="h-8 w-px bg-slate-700/50 hidden sm:block ml-2"></div>
        </div>

        {/* Derecha: Botones de Acción */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
          {bulkActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Icon name={action.icon} size={16} className={action.iconColor} />
              <span className="hidden md:inline">{action.label}</span>
            </button>
          ))}
        </div>
        
      </div>
    </div>
  );
};

export default BulkActionsBar;